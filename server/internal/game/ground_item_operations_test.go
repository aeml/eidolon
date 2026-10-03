package game

import (
	"encoding/json"
	"maps"
	"math"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/forging"
)

func groundItemFixture(t *testing.T) (*World, *Entity, *Entity, Item) {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	a, b := newTestPlayer("player-ground-source", "Fighter"), newTestPlayer("player-ground-recipient", "Wizard")
	a.Name, b.Name = "ground-source", "ground-recipient"
	a.InstanceID, b.InstanceID = "dungeon_ground_items", "dungeon_ground_items"
	a.X, b.X, a.Z, b.Z = 50000, 50000, 20000, 20000
	item := Item{ID: "earned-affixes", Name: "Earned blade", Level: 31, Stack: 1, MaxStack: 1,
		Stats: map[string]int{"strength": 7}, Rarity: RarityRare, Potency: 3, Sockets: 1,
		Gems:       []SocketedGem{{Type: GemRuby, Quality: GemFlawed, Stats: map[string]int{"strength": 2}}},
		ForgeBasis: &forging.Basis{Level: 30, Potency: 2, Stats: map[string]int{"strength": 6}, Value: 100}}
	a.Inventory, b.Inventory = []Item{item}, make([]Item, MaxInventorySize)
	w.AddEntity(a)
	w.AddEntity(b)
	return w, a, b, item
}

// Model a strongly saved character for this primitive's receipt boundary.
// These game tests do not certify the shared Mongo coordinator or actual IO.
func groundSavedReceipt(player *Entity) *database.Character {
	return &database.Character{Name: player.Name, ItemDeliveryReceipts: maps.Clone(player.ItemDeliveryReceipts)}
}

func TestGroundItemStagedRoundTripPreservesMetadataAndReplaysAfterConsumption(t *testing.T) {
	w, a, b, item := groundItemFixture(t)
	before := cloneItems(a.Inventory)
	op, err := w.PrepareDurableInventoryDrop(a.ID, 0, item.ID, 1)
	if err != nil || !reflect.DeepEqual(before, a.Inventory) || w.Entities[op.LootID] != nil {
		t.Fatal("preparation changed source custody or published loot", err)
	}
	if err := w.CompleteGroundItemProjection(op, &database.Character{Name: a.Name}, time.Now()); err == nil || w.Entities[op.LootID] != nil {
		t.Fatal("unsaved drop became visible")
	}
	if changed, err := w.ApplyDurableGroundItem(op); err != nil || !changed || a.Inventory[0].ID != "" || !a.UnjournaledSave || w.Entities[op.LootID] != nil {
		t.Fatal("drop effect failed, was not pinned or published before saved proof", err)
	}
	available := time.Now().UTC().Truncate(time.Millisecond)
	sourceReceipt := groundSavedReceipt(a)
	if err := w.CompleteGroundItemProjection(op, sourceReceipt, available); err != nil {
		t.Fatal(err)
	}
	loot := w.Entities[op.LootID]
	if !reflect.DeepEqual(*loot.LootItem, item) || loot.InstanceID != a.InstanceID || loot.X != a.X || loot.Z != a.Z {
		t.Fatal("ground publication changed item metadata or instance coordinates")
	}
	item.Stats["strength"] = 999
	if loot.LootItem.Stats["strength"] != 7 {
		t.Fatal("published ground item aliases old source metadata")
	}
	b.Quests = []Quest{{Accepted: true, Type: "COLLECT", Target: item.Name, MaxCount: 10}}
	pickup, err := w.PrepareDurableGroundPickup(b.ID, loot.ID)
	if err != nil || b.Inventory[0].ID != "" || loot.LootItem.Stack != 1 || loot.GroundItemReservation != pickup.ID {
		t.Fatal("pickup preparation changed custody or did not reserve the projection", err)
	}
	if _, accepted, reason := w.PerformPickup(a.ID, loot.ID); accepted || reason != "pickup_pending" {
		t.Fatal("ordinary pickup bypassed a frozen reservation", reason)
	}
	if changed, err := w.ApplyDurableGroundItem(pickup); err != nil || !changed || b.Inventory[0].ID != "earned-affixes" || b.Quests[0].Count != 1 {
		t.Fatal("pickup effect failed or lost collection credit", err)
	}
	if w.Entities[loot.ID] == nil {
		t.Fatal("ground custody disappeared before recipient save confirmation")
	}
	if err := w.CompleteGroundItemProjection(pickup, sourceReceipt, available); err == nil || w.Entities[loot.ID] == nil {
		t.Fatal("another owner's receipt consumed reserved ground custody")
	}
	if err := w.CompleteGroundItemProjection(pickup, groundSavedReceipt(b), available); err != nil || w.Entities[loot.ID] != nil {
		t.Fatal("confirmed pickup did not retire its ground projection", err)
	}
	b.Inventory[0] = Item{} // Legitimately consumed after the confirmed pickup.
	if changed, err := w.ApplyDurableGroundItem(pickup); err != nil || changed || b.Inventory[0].ID != "" || b.Quests[0].Count != 1 {
		t.Fatal("receipt replay recreated consumed gear or repeated collection credit", err)
	}
	if err := w.CompleteGroundItemProjection(op, sourceReceipt, available); err != nil || w.Entities[op.LootID] != nil {
		t.Fatal("old drop completion republished an already collected item", err)
	}
}

func TestGroundItemPartialPickupConservesUnitsAndDoesNotMergeDifferentAffixes(t *testing.T) {
	w, a, b, _ := groundItemFixture(t)
	item := Item{ID: "source-gems", Name: "Ruby", Type: ItemGem, Stack: 5, MaxStack: 10,
		GemType: GemRuby, GemQuality: GemFlawed, Stats: map[string]int{"strength": 2}}
	a.Inventory[0] = item
	for index := range b.Inventory {
		b.Inventory[index] = Item{ID: "occupied", Name: "Occupied", Stack: 1}
	}
	b.Inventory[0] = cloneItem(item)
	b.Inventory[0].ID, b.Inventory[0].Stack = "existing-identical", 8
	b.Inventory[1] = cloneItem(item)
	b.Inventory[1].ID, b.Inventory[1].Stack = "same-name-different", 1
	b.Inventory[1].Stats["strength"] = 99
	drop, err := w.PrepareDurableInventoryDrop(a.ID, 0, item.ID, item.Stack)
	if err != nil {
		t.Fatal(err)
	}
	w.ApplyDurableGroundItem(drop)
	available := time.Now().UTC().Truncate(time.Millisecond)
	w.CompleteGroundItemProjection(drop, groundSavedReceipt(a), available)
	pickup, err := w.PrepareDurableGroundPickup(b.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	var moved, remaining Item
	json.Unmarshal([]byte(pickup.MovedPayload), &moved)
	json.Unmarshal([]byte(pickup.RemainingPayload), &remaining)
	if moved.Stack != 2 || remaining.Stack != 3 || !reflect.DeepEqual(b.Inventory[1].Stats, map[string]int{"strength": 99}) {
		t.Fatal("partial pickup merged different metadata or did not freeze exact remainder")
	}
	if changed, err := w.ApplyDurableGroundItem(pickup); err != nil || !changed || b.Inventory[0].Stack != 10 || b.Inventory[1].Stack != 1 {
		t.Fatal("partial effect exceeded available capacity or changed another item", err)
	}
	if err := w.CompleteGroundItemProjection(pickup, groundSavedReceipt(b), available); err != nil || w.Entities[drop.LootID].LootItem.Stack != 3 {
		t.Fatal("partial completion lost the ground remainder", err)
	}
	if err := w.CompleteGroundItemProjection(drop, groundSavedReceipt(a), available); err != nil || w.Entities[drop.LootID].LootItem.Stack != 3 {
		t.Fatal("source replay refilled an already partly claimed stack", err)
	}
	b.Inventory[2] = Item{}
	next, err := w.PrepareDurableGroundPickup(b.ID, drop.LootID)
	if err != nil || next.Generation != pickup.Generation+1 {
		t.Fatal("next ground generation could not reserve the remaining units", err)
	}
	if err := w.CompleteGroundItemProjection(pickup, groundSavedReceipt(b), available); err == nil || w.Entities[drop.LootID].GroundItemReservation != next.ID {
		t.Fatal("old completion interfered with a newer claim reservation")
	}
	w.ApplyDurableGroundItem(next)
	if err := w.CompleteGroundItemProjection(next, groundSavedReceipt(b), available); err != nil || w.Entities[drop.LootID] != nil || b.Inventory[2].Stack != 3 {
		t.Fatal("remaining units were not collected once", err)
	}
}

func TestGroundItemReservationSurvivesExpiryAndOnlyOneConcurrentPrepare(t *testing.T) {
	w, a, b, item := groundItemFixture(t)
	op, _ := w.PrepareDurableInventoryDrop(a.ID, 0, item.ID, 1)
	w.ApplyDurableGroundItem(op)
	w.CompleteGroundItemProjection(op, groundSavedReceipt(a), time.Now().UTC().Truncate(time.Millisecond))
	results := make(chan bool, 16)
	var workers sync.WaitGroup
	for index := 0; index < cap(results); index++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			_, err := w.PrepareDurableGroundPickup(b.ID, op.LootID)
			results <- err == nil
		}()
	}
	workers.Wait()
	accepted := 0
	for index := 0; index < cap(results); index++ {
		if <-results {
			accepted++
		}
	}
	if accepted != 1 {
		t.Fatal("multiple actors prepared the same live loot generation", accepted)
	}
	loot := w.Entities[op.LootID]
	loot.LootTime = time.Now().Add(-2 * time.Minute)
	deferred := &deferredActions{}
	w.updateEntity(loot, .01, nil, deferred)
	if len(deferred.removals) != 0 {
		t.Fatal("ambiguous reserved pickup expired its only world projection")
	}
	copy := w.GetEntityCopy(loot.ID)
	copy.GroundItemReservation = "changed-copy"
	copy.LootItem.Stats["strength"] = 999
	if loot.LootItem.Stats["strength"] != 7 || loot.GroundItemReservation == copy.GroundItemReservation {
		t.Fatal("private reservation or item snapshot aliases live custody")
	}
	encoded, _ := json.Marshal(w.GetEntityCopy(loot.ID))
	if strings.Contains(string(encoded), loot.GroundItemReservation) || strings.Contains(string(encoded), loot.GroundReservationHash) || strings.Contains(string(encoded), "GroundItem") {
		t.Fatal("public entity JSON exposed a private operation or reservation")
	}
}

func TestGroundItemDropRejectsDuplicatedStorageIdentityBeforePreparing(t *testing.T) {
	for _, mode := range []string{"bag", "equipment", "stash", "buyback"} {
		t.Run(mode, func(t *testing.T) {
			w, a, _, item := groundItemFixture(t)
			switch mode {
			case "bag":
				a.Inventory = append(a.Inventory, cloneItem(item))
			case "equipment":
				a.Equipment["mainHand"] = cloneItem(item)
			case "stash":
				a.Stash = []Item{cloneItem(item)}
			case "buyback":
				a.Buyback = []Item{cloneItem(item)}
			}
			before := cloneItems(a.Inventory)
			if _, err := w.PrepareDurableInventoryDrop(a.ID, 0, item.ID, 1); err == nil || !reflect.DeepEqual(before, a.Inventory) {
				t.Fatal("duplicated identity became a new durable drop intent")
			}
		})
	}
}

func TestGroundItemChangedIntentCapacityAndAuthorityFailWithoutMutation(t *testing.T) {
	for _, mode := range []string{"capacity", "other-user", "instance", "nan", "future-item", "changed-receipt", "duplicate-source"} {
		t.Run(mode, func(t *testing.T) {
			w, a, b, item := groundItemFixture(t)
			drop, _ := w.PrepareDurableInventoryDrop(a.ID, 0, item.ID, 1)
			if mode == "duplicate-source" {
				a.Inventory = append(a.Inventory, cloneItem(item))
				before := cloneItems(a.Inventory)
				if changed, err := w.ApplyDurableGroundItem(drop); err == nil || changed || !reflect.DeepEqual(before, a.Inventory) {
					t.Fatal("ambiguous source ID was debited")
				}
				return
			}
			w.ApplyDurableGroundItem(drop)
			available := time.Now().UTC().Truncate(time.Millisecond)
			w.CompleteGroundItemProjection(drop, groundSavedReceipt(a), available)
			if mode == "instance" || mode == "nan" {
				if mode == "instance" {
					b.InstanceID = "other-instance"
				} else {
					b.X = math.NaN()
				}
				if _, err := w.PrepareDurableGroundPickup(b.ID, drop.LootID); err == nil || w.Entities[drop.LootID].GroundItemReservation != "" {
					t.Fatal("invalid spatial authority reserved loot")
				}
				return
			}
			pickup, _ := w.PrepareDurableGroundPickup(b.ID, drop.LootID)
			switch mode {
			case "capacity":
				for index := range b.Inventory {
					b.Inventory[index] = Item{ID: "occupied", Stack: 1}
				}
			case "other-user":
				pickup.Username, pickup.PlayerID = a.Name, a.ID
			case "future-item":
				var fields map[string]any
				json.Unmarshal([]byte(pickup.BeforePayload), &fields)
				fields["futurePower"] = 123
				payload, _ := json.Marshal(fields)
				pickup.BeforePayload, pickup.MovedPayload = string(payload), string(payload)
			case "changed-receipt":
				b.ItemDeliveryReceipts = map[string]string{pickup.ID: "different-fingerprint"}
			}
			pickup.Fingerprint, _ = database.GroundItemFingerprint(pickup)
			before := cloneItems(b.Inventory)
			if changed, err := w.ApplyDurableGroundItem(pickup); err == nil || changed || !reflect.DeepEqual(before, b.Inventory) {
				t.Fatal("invalid/unsupported intent changed recipient custody", mode, err)
			}
		})
	}
}

func TestGroundItemSplitStackGetsStableSeparateIdentity(t *testing.T) {
	w, _, b, _ := groundItemFixture(t)
	item := Item{ID: "same-origin", Name: "Ruby", Stack: 3, MaxStack: 5, Stats: map[string]int{"strength": 2}}
	b.Inventory[0] = cloneItem(item)
	b.Inventory[0].Stack = 5
	loot := &Entity{ID: "generated-ground", Type: TypeLoot, LootItem: &item, X: b.X, Z: b.Z, InstanceID: b.InstanceID, LootTime: time.Now(), CreatedAt: time.Now()}
	w.AddEntity(loot)
	op, err := w.PrepareDurableGroundPickup(b.ID, loot.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !op.LootTime.Equal(op.LootTime.Truncate(time.Millisecond)) || !op.LootCreatedAt.Equal(op.LootCreatedAt.Truncate(time.Millisecond)) {
		t.Fatal("generated loot timestamps were not frozen at BSON precision")
	}
	if changed, err := w.ApplyDurableGroundItem(op); err != nil || !changed {
		t.Fatal(err)
	}
	if b.Inventory[1].ID == b.Inventory[0].ID || b.Inventory[1].ID != "ground-stack-"+op.ID[len("grounditem:"):] || b.Inventory[1].Stack != 3 {
		t.Fatal("split pickup reused an existing stack ID or lost units")
	}
}

func TestGroundItemImplicitLegacyUnitAndEmptyStatsRemainTransferable(t *testing.T) {
	w, a, _, _ := groundItemFixture(t)
	a.Inventory[0] = Item{ID: "implicit-legacy", Name: "Old gear", Stats: map[string]int{}, Gems: []SocketedGem{}}
	op, err := w.PrepareDurableInventoryDrop(a.ID, 0, "implicit-legacy", 1)
	if err != nil {
		t.Fatal(err)
	}
	if changed, err := w.ApplyDurableGroundItem(op); err != nil || !changed || a.Inventory[0].ID != "" {
		t.Fatal("omitted legacy quantity/empty metadata broke a valid frozen drop", err)
	}
}
