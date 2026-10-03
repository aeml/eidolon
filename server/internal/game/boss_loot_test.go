package game

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestBossLootDeathSaveHookSeesCompletePartyEffectsBeforeCheckpoint(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	const instanceID = "boss-save-hook-run"
	layout := DungeonLayout{Rooms: []DungeonRoom{{Type: "boss", Width: 40, Height: 40}}}
	instance := &DungeonInstance{ID: instanceID, DungeonType: "tempest_spire", RunLevel: 30, Difficulty: DifficultyNormal,
		Layout: layout, RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
	w.InstanceLayouts[instanceID] = instance
	var players []*Entity
	for index, class := range []string{"Fighter", "Cleric", "Wizard", "Rogue"} {
		player := fullBossLootPlayer()
		player.ID, player.Name, player.SubType, player.InstanceID = fmt.Sprintf("player-save-hook-%d", index), fmt.Sprintf("save-hook-%d", index), class, instanceID
		player.Level, player.MaxExperience = 30, experienceRequiredForLevel(30)
		player.Quests = []Quest{{ID: "boss-kill-credit", Type: "KILL", Target: "Windshear", MaxCount: 1, Accepted: true}}
		w.AddEntity(player)
		players = append(players, player)
	}
	party := w.CreateParty(players[0].ID)
	for _, player := range players[1:] {
		if err := w.JoinParty(party.ID, player.ID); err != nil {
			t.Fatal(err)
		}
	}
	seen := make(chan string, 4)
	w.OnBossReward = func(summary RewardSummaryEvent, weekly *WeeklyRaidCompletionEvent) error {
		// These APIs acquire scene/player/instance locks. Reaching this hook
		// while any of those locks remain owned would deadlock the test.
		player := w.GetEntityCopy(summary.PlayerID)
		if player == nil || player.Gold <= 0 || player.Experience <= 0 || player.Quests[0].Count != 1 || len(player.PendingBossLoot) == 0 || weekly != nil {
			t.Error("save hook ran before all earned party effects")
		}
		instance.Mu.RLock()
		cleared := instance.RoomState.Rooms[0].Cleared
		instance.Mu.RUnlock()
		if cleared {
			t.Error("boss-room checkpoint preceded the whole-character save hook")
		}
		seen <- summary.PlayerID
		return nil
	}
	w.OnEvent = func(kind string, value interface{}) {
		if kind == "inventory_update" || kind == "reward_summary" || kind == "weekly_raid_complete" {
			t.Error("durable hook also invoked unsaved legacy reward feedback")
		}
	}
	boss := &Entity{ID: "boss-save-hook", Type: TypeEnemy, SubType: "Windshear", Level: 30, Health: 1, MaxHealth: 1, State: "IDLE", InstanceID: instanceID}
	w.AddEntity(boss)
	boss.Mu.Lock()
	w.handleDeath(boss, players[0], nil)
	boss.Mu.Unlock()
	for range 4 {
		select {
		case <-seen:
		case <-time.After(3 * time.Second):
			t.Fatal("save hook missing a recipient or still holding a scene lock")
		}
	}
	w.StopBackground()
	if !instance.RoomState.Rooms[0].Cleared {
		t.Fatal("successful save hooks did not permit boss checkpoint")
	}
}

func fullBossLootPlayer() *Entity {
	player := newTestPlayer("retained-boss-owner", "Fighter")
	player.Inventory = make([]Item, MaxInventorySize)
	for index := range player.Inventory {
		player.Inventory[index] = Item{ID: fmt.Sprintf("occupied-%d", index), Name: "Owned", Stack: 1, MaxStack: 1}
	}
	return player
}

func TestBossLootRetainsExactRollAndCollectsWithoutReplay(t *testing.T) {
	player := fullBossLootPlayer()
	item := Item{ID: "retained-unique", Name: "Original boss blade", Type: ItemWeapon, Stack: 1, MaxStack: 1,
		Level: 100, Potency: 7, UniqueEffect: "echoing_strike", Stats: map[string]int{"damage": 73, "strength": 11}}
	before := cloneItems(player.Inventory)
	if delivered, err := player.AwardBossItemLocked(item); delivered || err != nil || len(player.PendingBossLoot) != 1 || !reflect.DeepEqual(before, player.Inventory) || !player.UnjournaledSave {
		t.Fatal("full bag lost the complete roll or changed partial storage", err)
	}
	var retained Item
	if json.Unmarshal([]byte(player.PendingBossLoot[0]), &retained) != nil || !reflect.DeepEqual(retained, item) {
		t.Fatal("retention changed originally rolled metadata")
	}
	w := newTestWorld()
	defer w.StopBackground()
	w.AddEntity(player)
	copy := w.GetEntityCopy(player.ID)
	copy.PendingBossLoot[0] = "changed external snapshot"
	if player.PendingBossLoot[0] == copy.PendingBossLoot[0] {
		t.Fatal("actor snapshot aliased the private queue")
	}
	public, err := json.Marshal(player)
	if err != nil || strings.Contains(string(public), item.ID) || strings.Contains(string(public), "PendingBossLoot") {
		t.Fatal("public actor exposed private retained items", err)
	}
	if count, err := player.CollectPendingBossLootLocked(10); count != 0 || err != nil || len(player.PendingBossLoot) != 1 {
		t.Fatal("full-bag retry consumed the original roll", err)
	}
	player.Inventory[0] = Item{}
	if count, err := player.CollectPendingBossLootLocked(10); count != 1 || err != nil || len(player.PendingBossLoot) != 0 || !reflect.DeepEqual(player.Inventory[0], item) {
		t.Fatal("space retry rerolled or lost the earned item", err)
	}
	if count, err := player.CollectPendingBossLootLocked(10); count != 0 || err != nil {
		t.Fatal("empty queue replay delivered another item", err)
	}
}

func TestBossLootDoesNotPartiallyStackOrEraseFutureMetadata(t *testing.T) {
	player := fullBossLootPlayer()
	item := Item{ID: "new-hearts", Name: "Eidolon Heart", Type: ItemMaterial, Stack: 3, MaxStack: 1000}
	player.Inventory[0] = item
	player.Inventory[0].ID, player.Inventory[0].Stack = "old-hearts", 999
	if delivered, err := player.AwardBossItemLocked(item); delivered || err != nil || player.Inventory[0].Stack != 999 {
		t.Fatal("full bag partially stacked and discarded a remainder", err)
	}
	player.Inventory[1] = Item{}
	if count, err := player.CollectPendingBossLootLocked(10); count != 1 || err != nil || player.Inventory[0].Stack != 1000 || player.Inventory[1].Stack != 2 || player.Inventory[1].ID != item.ID {
		t.Fatal("stack collection changed amount or identity", err)
	}
	first := Item{ID: "first", Name: "First", Stack: 1, MaxStack: 1}
	payload, _ := json.Marshal(first)
	player.Inventory[2], player.Inventory[3] = Item{}, Item{}
	unknown := `{"id":"future","name":"Future","stack":1,"maxStack":1,"futureArt":{"retain":"exact"}}`
	player.PendingBossLoot = []string{string(payload), unknown}
	before := cloneItems(player.Inventory)
	if count, err := player.CollectPendingBossLootLocked(10); count != 0 || err == nil || !reflect.DeepEqual(player.Inventory, before) || len(player.PendingBossLoot) != 2 || player.PendingBossLoot[1] != unknown {
		t.Fatal("unsupported payload caused partial batch effects or metadata loss")
	}
}

func TestBossLootRejectsReusedAndConflictingIdentities(t *testing.T) {
	for _, container := range []string{"queue", "bag", "stash", "buyback", "equipment"} {
		t.Run(container, func(t *testing.T) {
			player := fullBossLootPlayer()
			item := Item{ID: "same-roll", Name: "Heart", Type: ItemMaterial, Stack: 1, MaxStack: 1000}
			switch container {
			case "queue":
				payload, _ := json.Marshal(item)
				player.PendingBossLoot = []string{string(payload)}
			case "bag":
				player.Inventory[0] = item
			case "stash":
				player.Stash = []Item{item}
			case "buyback":
				player.Buyback = []Item{item}
			case "equipment":
				player.Equipment["mainHand"] = item
			}
			before, queue := cloneItems(player.Inventory), append([]string(nil), player.PendingBossLoot...)
			if _, err := player.AwardBossItemLocked(item); err == nil || !reflect.DeepEqual(before, player.Inventory) || !reflect.DeepEqual(queue, player.PendingBossLoot) {
				t.Fatal("same roll gained a second owner or partial effect")
			}
		})
	}
}

func TestBossLootCollectionHonorsTradeAndBoundedBatch(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	player := fullBossLootPlayer()
	w.AddEntity(player)
	for index := range 20 {
		item := Item{ID: fmt.Sprintf("queued-%d", index), Name: "Earned", Stack: 1, MaxStack: 1}
		if _, err := player.AwardBossItemLocked(item); err != nil {
			t.Fatal(err)
		}
	}
	player.Inventory = make([]Item, MaxInventorySize)
	w.TradeByPlayer[player.ID] = "offered-trade"
	if found, count, err := w.CollectPendingBossLoot(player.ID, 10); !found || count != 0 || err != nil || len(player.PendingBossLoot) != 20 {
		t.Fatal("collection changed a bag beneath active trade consent", err)
	}
	delete(w.TradeByPlayer, player.ID)
	if _, count, err := w.CollectPendingBossLoot(player.ID, 10); count != 10 || err != nil || len(player.PendingBossLoot) != 10 || player.Inventory[0].ID != "queued-0" || player.Inventory[9].ID != "queued-9" {
		t.Fatal("bounded collection changed the original order or processed too many items", err)
	}
	before := append([]string(nil), player.PendingBossLoot...)
	if _, err := player.CollectPendingBossLootLocked(51); err == nil || !reflect.DeepEqual(before, player.PendingBossLoot) {
		t.Fatal("invalid collection budget changed the queue")
	}
}

func TestGroundPlacementRejectsShortIdentityWithoutPanic(t *testing.T) {
	player := fullBossLootPlayer()
	item := Item{ID: "earned", Name: "Earned", Stack: 1, MaxStack: 1}
	before := cloneItems(player.Inventory)
	for _, id := range []string{"", "pickup", "boss:test"} {
		if _, _, err := planGroundPickup(player, item, id); err == nil || !reflect.DeepEqual(player.Inventory, before) {
			t.Fatal("malformed operation identity changed storage or was accepted")
		}
	}
}

func TestBossLootDeathPipelineRetainsEveryFullBagPartyRoll(t *testing.T) {
	for _, difficulty := range []DungeonDifficulty{DifficultyNormal, DifficultyHeroic, DifficultyMythic} {
		t.Run(string(difficulty), func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			const instanceID = "boss-full-bag-party"
			layout := DungeonLayout{Rooms: []DungeonRoom{{Type: "boss", Width: 40, Height: 40}}}
			w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, DungeonType: "tempest_spire", RunLevel: 100,
				Difficulty: difficulty, Layout: layout, RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
			var players []*Entity
			for index, class := range []string{"Fighter", "Cleric", "Wizard", "Rogue"} {
				player := fullBossLootPlayer()
				player.ID, player.Name, player.SubType, player.InstanceID = fmt.Sprintf("boss-owner-%d", index), fmt.Sprintf("owner-%d", index), class, instanceID
				player.Level, player.MaxExperience = 100, experienceRequiredForLevel(100)
				w.AddEntity(player)
				players = append(players, player)
			}
			party := w.CreateParty(players[0].ID)
			for _, player := range players[1:] {
				if err := w.JoinParty(party.ID, player.ID); err != nil {
					t.Fatal(err)
				}
			}
			summaries := make(chan RewardSummaryEvent, 4)
			w.OnEvent = func(kind string, value interface{}) {
				if kind == "reward_summary" {
					summaries <- value.(RewardSummaryEvent)
				}
			}
			boss := &Entity{ID: "boss-full-bag", Type: TypeEnemy, SubType: "Windshear", Level: 100, Health: 1, MaxHealth: 1, State: "IDLE", InstanceID: instanceID}
			w.AddEntity(boss)
			boss.Mu.Lock()
			w.handleDeath(boss, players[0], nil)
			boss.Mu.Unlock()
			w.StopBackground()
			if len(summaries) != 4 {
				t.Fatal("party reward feedback lost a recipient")
			}
			for range 4 {
				summary := <-summaries
				player := w.GetEntity(summary.PlayerID)
				if len(player.PendingBossLoot) != summary.HeartCount+summary.GemCount+summary.ItemCount || summary.PendingItemCount != len(player.PendingBossLoot) || summary.HeartCount < 1 {
					t.Fatal("full party bag discarded an earned boss roll", summary)
				}
				if difficulty != DifficultyNormal && summary.GemCount != 1 || difficulty == DifficultyMythic && summary.ItemCount != 1 {
					t.Fatal("difficulty bonus disappeared when the bag was full", summary)
				}
			}
		})
	}
}
