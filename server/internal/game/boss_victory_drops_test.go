package game

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestBossVictoryOriginalDropIdempotentReservationAndConsumedFence(t *testing.T) {
	w, _, players, input := bossVictoryCaptureFixture(t)
	op, err := w.captureBossVictory(input)
	if err != nil {
		t.Fatal(err)
	}
	drop := op.Drops[0]
	if err := w.RestoreOriginalBossDrop(op, 0); err != nil {
		t.Fatal(err)
	}
	original := w.GetEntityCopy(drop.LootID)
	if original == nil || original.LootItem.ID != "public-original" || original.LootItem.Stats["damage"] != 73 || !original.LootTime.Equal(op.CreatedAt) || !original.CreatedAt.Equal(op.CreatedAt) || original.X != drop.X || original.Y != drop.Y || original.Z != drop.Z {
		t.Fatal("original spawn changed identity, metadata, position or age")
	}
	if err := w.RestoreOriginalBossDrop(op, 0); err != nil || !reflect.DeepEqual(original, w.GetEntityCopy(drop.LootID)) {
		t.Fatal("unclaimed replay changed the original projection", err)
	}
	player := players[0]
	player.Inventory[0] = Item{}
	player.X, player.Z = drop.X, drop.Z
	pickup, err := w.PrepareDurableGroundPickup(player.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.RestoreOriginalBossDrop(op, 0); err != nil || w.GetEntityCopy(drop.LootID).GroundItemReservation != pickup.ID {
		t.Fatal("a stale no-ledger read cleared a newer local pickup reservation", err)
	}
	record := database.GroundItemRecord{GroundItemOperation: pickup, State: database.GroundItemPending, AvailableAt: op.CreatedAt, ExpiresAt: drop.ExpiresAt}
	if !BossVictoryDropCustodyMatches(op, 0, record) {
		t.Fatal("ordinary pickup did not descend from the original boss spawn")
	}
	if err := w.RestoreGroundItemProjection(record, nil); err != nil {
		t.Fatal(err)
	}
	if changed, err := w.ApplyDurableGroundItem(pickup); err != nil || !changed {
		t.Fatal(err)
	}
	record.State = database.GroundItemComplete
	if err := w.RestoreGroundItemProjection(record, groundSavedReceipt(player)); err != nil || w.GetEntityCopy(drop.LootID) != nil {
		t.Fatal("complete pickup failed to consume original projection", err)
	}
	if err := w.RestoreOriginalBossDrop(op, 0); err != nil || w.GetEntityCopy(drop.LootID) != nil {
		t.Fatal("an original-spawn replay resurrected a consumed generation", err)
	}
}

func TestBossVictoryDropCustodyKeepsPartialQuantityAndRefusesChangedOrigin(t *testing.T) {
	w, _, players, input := bossVictoryCaptureFixture(t)
	item := Item{ID: "public-original", Name: "Fragments", Type: ItemMaterial, Stack: 5, MaxStack: 10, Stats: map[string]int{"wisdom": 2}}
	input.loot = []*Item{&item}
	op, err := w.captureBossVictory(input)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.RestoreOriginalBossDrop(op, 0); err != nil {
		t.Fatal(err)
	}
	player := players[0]
	player.Inventory[0] = cloneItem(item)
	player.Inventory[0].ID, player.Inventory[0].Stack = "existing-fragments", 8
	player.X, player.Z = op.Drops[0].X, op.Drops[0].Z
	pickup, err := w.PrepareDurableGroundPickup(player.ID, op.Drops[0].LootID)
	if err != nil || pickup.RemainingPayload == "" {
		t.Fatal("ordinary partial pickup missing", err)
	}
	record := database.GroundItemRecord{GroundItemOperation: pickup, State: database.GroundItemPending, AvailableAt: op.CreatedAt, ExpiresAt: op.Drops[0].ExpiresAt}
	if !BossVictoryDropCustodyMatches(op, 0, record) {
		t.Fatal("original partial pickup was refused")
	}
	if _, err := w.ApplyDurableGroundItem(pickup); err != nil {
		t.Fatal(err)
	}
	record.State = database.GroundItemComplete
	if err := w.RestoreGroundItemProjection(record, groundSavedReceipt(player)); err != nil {
		t.Fatal(err)
	}
	if err := w.RestoreOriginalBossDrop(op, 0); err != nil || w.GetEntityCopy(op.Drops[0].LootID).LootItem.Stack != 3 {
		t.Fatal("original replay refilled consumed quantity", err)
	}
	for _, mode := range []string{"affix", "quantity", "party", "position", "birth", "expiry"} {
		t.Run(mode, func(t *testing.T) {
			changed := record
			switch mode {
			case "affix", "quantity":
				before, moved, remaining := item, item, item
				moved.Stack, remaining.Stack = 2, 3
				if mode == "affix" {
					before.Stats, moved.Stats, remaining.Stats = map[string]int{"wisdom": 999}, map[string]int{"wisdom": 999}, map[string]int{"wisdom": 999}
				} else {
					before.Stack, remaining.Stack = 6, 4
				}
				payload, _ := json.Marshal(before)
				changed.BeforePayload = string(payload)
				payload, _ = json.Marshal(moved)
				changed.MovedPayload = string(payload)
				payload, _ = json.Marshal(remaining)
				changed.RemainingPayload = string(payload)
			case "party":
				changed.LootPartyID = "unrelated-party"
			case "position":
				changed.X++
			case "birth":
				changed.LootCreatedAt = changed.LootCreatedAt.Add(time.Millisecond)
			case "expiry":
				changed.LootTime, changed.AvailableAt, changed.ExpiresAt = changed.LootTime.Add(time.Millisecond), changed.AvailableAt.Add(time.Millisecond), changed.ExpiresAt.Add(time.Millisecond)
				changed.CreatedAt = changed.AvailableAt.Add(time.Second)
			}
			changed.Fingerprint, _ = database.GroundItemFingerprint(changed.GroundItemOperation)
			if changed.Validate() != nil || BossVictoryDropCustodyMatches(op, 0, changed) {
				t.Fatal("valid unrelated custody was accepted as the original roll", mode)
			}
		})
	}
}

func TestBossVictoryOriginalExpiredOrUnsupportedDropNeverRenewsOrStrips(t *testing.T) {
	for _, expired := range []bool{false, true} {
		t.Run(fmt.Sprint(expired), func(t *testing.T) {
			w, _, _, input := bossVictoryCaptureFixture(t)
			if expired {
				input.killedAt = input.killedAt.Add(-2 * time.Minute)
			}
			op, err := w.captureBossVictory(input)
			if err != nil {
				t.Fatal(err)
			}
			op.Drops[0].Item = `{"id":"future-original","stack":1,"maxStack":1,"futureArt":{"retain":"exact"}}`
			op.Fingerprint, _ = database.BossVictoryFingerprint(op)
			err = w.RestoreOriginalBossDrop(op, 0)
			if (expired && err != nil) || (!expired && err == nil) || w.GetEntityCopy(op.Drops[0].LootID) != nil {
				t.Fatal("expired loot renewed or unsupported metadata stripped", err)
			}
		})
	}
}
