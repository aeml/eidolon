package game

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

// This exercises the production asynchronous death/loot pipeline, not a seeded
// drop probability. Guardian fragments are guaranteed; only ordinary equipment
// uses the existing isolated QA guarantee as a publication-completion marker.
func TestChronicleWorldDropsCannotExceedRemainingPersonalObjective(t *testing.T) {
	for _, partySize := range []int{1, 2} {
		t.Run(fmt.Sprintf("party_%d", partySize), func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			players := make([]*Entity, partySize)
			for i := range players {
				p := newTestPlayer(fmt.Sprintf("collector-%d", i), "Fighter")
				p.Quests = newCollectionBalancePlayer(t).Quests
				p.Quests[0].Count = 7
				p.Inventory = make([]Item, MaxInventorySize)
				p.Inventory[0] = Item{ID: "chronicle-item-owned", Name: p.Quests[0].Target, Type: ItemRelic, Stack: 7, MaxStack: 8}
				w.AddEntity(p)
				players[i] = p
			}
			if partySize > 1 {
				party := w.CreateParty(players[0].ID)
				if err := w.JoinParty(party.ID, players[1].ID); err != nil {
					t.Fatal(err)
				}
			}
			const deaths = 20
			for i := 0; i < deaths; i++ {
				players[0].Mu.Lock()
				players[0].QAGuaranteedLoot = true
				players[0].Mu.Unlock()
				enemy := &Entity{ID: fmt.Sprintf("budget-enemy-%d", i), Type: TypeEnemy, SubType: "InfernoTitan", Level: 1, Health: 1, MaxHealth: 1, State: "IDLE"}
				w.AddEntity(enemy)
				enemy.Mu.Lock()
				w.handleDeath(enemy, players[0], nil)
				enemy.Mu.Unlock()
			}
			deadline := time.Now().Add(5 * time.Second)
			for {
				w.Mu.RLock()
				publishedEquipment := 0
				for _, entity := range w.Entities {
					if entity.Type == TypeLoot && strings.HasPrefix(entity.ID, "loot-") && entity.LootItem != nil &&
						entity.LootItem.Type != ItemMaterial && entity.LootItem.Type != ItemRelic && entity.LootItem.Type != ItemGem {
						publishedEquipment++
					}
				}
				w.Mu.RUnlock()
				if publishedEquipment == deaths {
					break
				}
				if time.Now().After(deadline) {
					t.Fatalf("only %d/%d deaths published loot", publishedEquipment, deaths)
				}
				time.Sleep(time.Millisecond)
			}
			w.Mu.RLock()
			defer w.Mu.RUnlock()
			for _, player := range players {
				drops := 0
				for _, entity := range w.Entities {
					if entity.Type == TypeLoot && entity.LootOwnerID == player.ID && entity.LootItem != nil && IsChronicleQuestItem(*entity.LootItem) {
						drops += entity.LootItem.Stack
					}
				}
				if drops != 1 {
					t.Errorf("%s has %d world fragments with only one still needed", player.ID, drops)
				}
				player.Mu.RLock()
				if player.Quests[0].Count != 7 || player.Quests[0].Completed {
					t.Error("world drops must not grant pickup/turn-in credit")
				}
				player.Mu.RUnlock()
			}
		})
	}
}

func TestChronicleWorldDropBudgetPreservesPityAndReleasesOnRemoval(t *testing.T) {
	w := newTestWorld()
	p := newCollectionBalancePlayer(t)
	p.Quests[0].Count = 7
	p.Inventory[0] = Item{ID: "chronicle-item-owned", Name: p.Quests[0].Target, Type: ItemRelic, Stack: 7, MaxStack: 8}
	w.AddEntity(p)
	spawn := func(roll float64) *Entity {
		w.Mu.Lock()
		defer w.Mu.Unlock()
		return w.spawnChronicleDropLocked(p.ID, "Skeleton", "", 0, 0, roll)
	}
	first := spawn(0)
	if first == nil {
		t.Fatal("missing first personal fragment")
	}
	p.Quests[0].DropMisses = 4
	if spawn(.99) != nil || p.Quests[0].DropMisses != 4 {
		t.Fatal("covered objective consumed pity or spawned surplus")
	}
	// The actual lifecycle removal releases the reservation; no stale saved
	// counter can keep suppressing fragments after despawn or instance cleanup.
	w.RemoveEntity(first.ID)
	replacement := spawn(.99)
	if replacement == nil || p.Quests[0].DropMisses != 0 {
		t.Fatal("removed loot did not release the guaranteed replacement")
	}
	if _, ok, reason := w.PerformPickup(p.ID, replacement.ID); !ok {
		t.Fatalf("pickup failed: %s", reason)
	}
	if p.Quests[0].Count != 8 || p.Quests[0].Completed || spawn(0) != nil {
		t.Fatal("pickup must fill, not complete or overfill, the objective")
	}
}

func TestChronicleWorldDropBudgetCountsOnlyOwnedQuestFragments(t *testing.T) {
	w := newTestWorld()
	p := newCollectionBalancePlayer(t)
	p.Quests[0].Count = 7
	w.AddEntity(p)
	for i, fixture := range []struct{ owner, name, itemID string }{
		{"another-player", p.Quests[0].Target, "chronicle-item-other"},
		{p.ID, "Moon-Tide Pearl", "chronicle-item-other-realm"},
		{p.ID, p.Quests[0].Target, "ordinary-nonquest-item"},
	} {
		item := &Item{ID: fixture.itemID, Name: fixture.name, Stack: 8}
		w.AddEntity(&Entity{ID: fmt.Sprintf("unrelated-%d", i), Type: TypeLoot, LootOwnerID: fixture.owner, LootItem: item})
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if w.spawnChronicleDropLocked(p.ID, "Skeleton", "", 0, 0, 0) == nil {
		t.Fatal("unrelated drops blocked this character's objective")
	}
}

func TestChronicleWorldDropBudgetFullBagAndInstanceSwitch(t *testing.T) {
	w := newTestWorld()
	p := newCollectionBalancePlayer(t)
	for i := range p.Inventory {
		p.Inventory[i] = Item{ID: fmt.Sprintf("keep-%d", i), Type: ItemWeapon, MaxStack: 1, Stack: 1}
	}
	w.AddEntity(p)
	var drops []*Entity
	for i := 0; i < 12; i++ {
		w.Mu.Lock()
		drop := w.spawnChronicleDropLocked(p.ID, "Skeleton", "", 0, 0, 0)
		w.Mu.Unlock()
		if drop != nil {
			drops = append(drops, drop)
		}
	}
	if len(drops) != 8 {
		t.Fatalf("full bag reserved %d fragments instead of eight", len(drops))
	}
	if _, ok, reason := w.PerformPickup(p.ID, drops[0].ID); ok || reason != "inventory_full" {
		t.Fatal("full bag should retain the real world item")
	}
	if w.GetEntity(drops[0].ID) == nil || p.Quests[0].Count != 0 {
		t.Fatal("full bag lost item or awarded credit")
	}
	p.Quests[0].DropMisses = 4
	p.InstanceID = "different-scene"
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if w.spawnChronicleDropLocked(p.ID, "Skeleton", "", 0, 0, .99) != nil || p.Quests[0].DropMisses != 4 {
		t.Fatal("old scene published loot or consumed current pity")
	}
}

func BenchmarkChronicleWorldDropBudget(b *testing.B) {
	w := &World{Entities: make(map[string]*Entity), Grid: NewSpatialMap(50)}
	var definition Quest
	for _, quest := range chronicleQuestCatalog() {
		if quest.Type == "COLLECT" {
			definition = quest
			break
		}
	}
	definition.Accepted, definition.Count = true, 7
	p := &Entity{ID: "benchmark-player", Type: TypePlayer, Level: 10, Quests: []Quest{definition}}
	w.Entities[p.ID] = p
	for i := 0; i < 10000; i++ {
		id := fmt.Sprintf("scenery-%d", i)
		w.Entities[id] = &Entity{ID: id, Type: TypeFence}
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w.Mu.Lock()
		loot := w.spawnChronicleDropLocked(p.ID, "Skeleton", "", 0, 0, 0)
		if loot != nil {
			w.Grid.Remove(loot)
			delete(w.Entities, loot.ID)
		}
		w.Mu.Unlock()
	}
}
