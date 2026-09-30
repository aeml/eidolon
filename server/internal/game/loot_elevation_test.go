package game

import (
	"math"
	"reflect"
	"testing"
	"time"
)

func assertLootOnElevation(t *testing.T, w *World, loot *Entity) {
	t.Helper()
	if loot == nil {
		t.Fatal("loot was not published")
	}
	want := w.terrainElevation.sample(loot.X, loot.Z, "") + .5
	if math.Abs(loot.Y-want) > 1e-9 {
		t.Fatalf("loot %s y=%f want=%f", loot.ID, loot.Y, want)
	}
}

func TestElevationCandidateStartupGroundsInitialPopulation(t *testing.T) {
	legacy := NewWorld(nil)
	t.Cleanup(legacy.StopBackground)
	if legacy.TerrainProfile() != "flat-v1" || legacy.terrainElevation != nil {
		t.Fatal("default world enabled candidate terrain")
	}
	w, err := NewWorldWithElevationCandidate(nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopBackground)
	if w.TerrainProfile() != "earth-elevation-rocks-v1" {
		t.Fatal("candidate profile missing")
	}
	raised := 0
	for _, e := range w.Entities {
		if e.Type == TypeEnemy && e.InstanceID == "" {
			assertActorOnElevation(t, w, e)
			if e.Y > 1 {
				raised++
			}
		}
	}
	if raised == 0 {
		t.Fatal("no initial elevated enemies were exercised")
	}
	p := newTestPlayer("elevation-qa", "Wizard")
	w.AddEntity(p)
	if _, ok := w.MovePlayerToQAWaypoint(p.ID, "encounter"); !ok {
		t.Fatal("candidate QA could not approach a real raised encounter")
	}
	assertActorOnElevation(t, w, p)
	if p.Y <= .5 {
		t.Fatal("candidate encounter route stayed on a flat foundation")
	}
}

func TestElevatedLootPublicationAndPickup(t *testing.T) {
	w, p := elevationMovementWorld(t)
	t.Cleanup(w.StopBackground)
	item := Item{ID: "elevated-sword", Name: "Sword", Stack: 1, Stats: map[string]int{"strength": 12}}
	p.Inventory = make([]Item, MaxInventorySize)
	p.Inventory[0] = item
	if _, err := w.PerformInventoryDrop(p.ID, 0, item.ID); err != nil {
		t.Fatal(err)
	}
	var dropped *Entity
	for _, e := range w.Entities {
		if e.Type == TypeLoot && e.LootItem.ID == item.ID {
			dropped = e
		}
	}
	assertLootOnElevation(t, w, dropped)
	if _, ok, reason := w.PerformPickup(p.ID, dropped.ID); !ok {
		t.Fatal(reason)
	}
	if !reflect.DeepEqual(p.Inventory[0], item) || w.Entities[dropped.ID] != nil {
		t.Fatal("pickup lost or duplicated the item")
	}
	w.DropLoot(item, p.X+1, p.Z+1)
	for _, e := range w.Entities {
		if e.Type == TypeLoot {
			assertLootOnElevation(t, w, e)
		}
	}
	p.Quests = newCollectionBalancePlayer(t).Quests
	w.Mu.Lock()
	fragment := w.spawnChronicleDropLocked(p.ID, "Skeleton", "", p.X, p.Z, 0)
	w.Mu.Unlock()
	assertLootOnElevation(t, w, fragment)
	if fragment.LootOwnerID != p.ID {
		t.Fatal("personal loot lost ownership")
	}
	if _, ok, reason := w.PerformPickup(p.ID, fragment.ID); !ok {
		t.Fatal(reason)
	}
	if p.Quests[0].Count != 1 {
		t.Fatal("fragment pickup did not credit collection")
	}
	for _, instance := range []string{"dungeon_floor", CasinoInstanceID} {
		loot := &Entity{ID: instance, Type: TypeLoot, InstanceID: instance, X: p.X, Z: p.Z, Y: 8}
		w.AddEntity(loot)
		if loot.Y != 8 {
			t.Fatal("overwrote instance-owned loot height")
		}
	}
	w.terrainElevation = nil
	legacy := &Entity{ID: "legacy-loot", Type: TypeLoot, X: p.X, Z: p.Z, Y: .5}
	w.AddEntity(legacy)
	if legacy.Y != .5 {
		t.Fatal("changed disabled-world placement")
	}
}

func TestElevatedDeathLootPublication(t *testing.T) {
	w, p := elevationMovementWorld(t)
	t.Cleanup(w.StopBackground)
	p.QAGuaranteedLoot = true
	enemy := &Entity{ID: "elevated-drop-enemy", Type: TypeEnemy, SubType: "Skeleton", X: p.X, Z: p.Z,
		Level: 1, Health: 1, MaxHealth: 1, State: "IDLE"}
	w.AddEntity(enemy)
	enemy.Mu.Lock()
	w.handleDeath(enemy, p, nil)
	enemy.Mu.Unlock()
	deadline := time.Now().Add(5 * time.Second)
	for {
		w.Mu.RLock()
		var drops []*Entity
		for _, e := range w.Entities {
			if e.Type == TypeLoot {
				drops = append(drops, e)
			}
		}
		w.Mu.RUnlock()
		for _, loot := range drops {
			assertLootOnElevation(t, w, loot)
		}
		if len(drops) > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("death did not publish guaranteed loot")
		}
		time.Sleep(time.Millisecond)
	}
}

func TestElevatedStaticWorldAnchorsRetainFlatFoundations(t *testing.T) {
	w, _ := elevationMovementWorld(t)
	t.Cleanup(w.StopBackground)
	count := 0
	for _, e := range w.Entities {
		if e.InstanceID != "" {
			continue
		}
		switch e.Type {
		case TypeNPC, TypeFence, TypeStash, TypeForge, TypeTradingHouse:
			count++
			if ground := w.terrainElevation.sample(e.X, e.Z, ""); ground != 0 {
				t.Errorf("static anchor %s (%s) is buried by %f", e.ID, e.SubType, ground)
			}
		}
	}
	if count == 0 {
		t.Fatal("did not audit populated world")
	}
}

func TestElevatedSeraphSpawnAndFollow(t *testing.T) {
	w, p := elevationMovementWorld(t)
	t.Cleanup(w.StopBackground)
	// Follow/grounding is the subject, not combat acquisition. NewWorld seeds
	// random enemies; a nearby one correctly makes the seraph smite instead
	// of following and used to make this fixture depend on the spawn seed.
	for id, e := range w.Entities {
		if e.Type == TypeEnemy {
			w.RemoveEntity(id)
		}
	}
	p.SubType, p.Level, p.Mana, p.MaxMana = "Cleric", 100, 10000, 10000
	p.UnlockedSkills = []string{"Avenging Seraph"}
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Avenging Seraph"); !result.Accepted {
		t.Fatal(result)
	}
	var summon *Entity
	for _, e := range w.Entities {
		if e.SubType == "AvengingSeraph" {
			summon = e
		}
	}
	if summon == nil {
		t.Fatal("no summon")
	}
	assertActorOnElevation(t, w, summon)
	p.X += 15
	w.groundActorLocked(p)
	startDistance := math.Hypot(p.X-summon.X, p.Z-summon.Z)
	for step := 0; step < 5; step++ {
		w.updateEntity(summon, .1, nil, &deferredActions{})
		assertActorOnElevation(t, w, summon)
	}
	if distance := math.Hypot(p.X-summon.X, p.Z-summon.Z); distance >= startDistance {
		t.Fatalf("summon did not approach owner: before=%f after=%f", startDistance, distance)
	}
}
