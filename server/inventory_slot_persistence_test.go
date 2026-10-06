package main

import (
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/forging"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestInventorySnapshotPreservesOccupiedSlotPositions(t *testing.T) {
	for _, slots := range [][]int{{0}, {3}, {0, 5}, {4, game.MaxInventorySize - 1}, {}} {
		t.Run(fmt.Sprint(slots), func(t *testing.T) {
			p := &game.Entity{SubType: "Rogue", Level: 30, Gold: 37, EP: 11,
				Inventory:          make([]game.Item, game.MaxInventorySize),
				GoldCreditReceipts: map[string]int{"quest:earned": 37},
				EPCasinoReceipts:   map[string]int{"casino:earned": 11}}
			for _, slot := range slots {
				p.Inventory[slot] = game.Item{ID: fmt.Sprintf("slot-%d", slot), Name: "Earned Blade", Stack: 1,
					Type: game.ItemWeapon, Potency: 4, Stats: map[string]int{"damage": 19}, StatScaleVersion: game.ItemStatScaleVersion}
			}
			encoded, err := bson.Marshal(characterSnapshot("slot-save", p, time.Unix(1234, 0)))
			if err != nil {
				t.Fatal(err)
			}
			var saved database.Character
			if err := bson.Unmarshal(encoded, &saved); err != nil {
				t.Fatal(err)
			}
			wantLength := 0
			if len(slots) > 0 {
				wantLength = slots[len(slots)-1] + 1
			}
			if len(saved.Inventory) != wantLength {
				t.Fatalf("bag positions compacted: got %d saved slots, want %d", len(saved.Inventory), wantLength)
			}
			for index, item := range saved.Inventory {
				if item.ID != p.Inventory[index].ID {
					t.Fatalf("slot %d moved: got %q want %q", index, item.ID, p.Inventory[index].ID)
				}
				if item.ID != "" && (item.Potency != 4 || item.Stats["damage"] != 19) {
					t.Fatal("earned item changed")
				}
			}
			if saved.Gold != p.Gold || saved.EP != p.EP || !reflect.DeepEqual(saved.GoldCreditReceipts, p.GoldCreditReceipts) || !reflect.DeepEqual(saved.EPCasinoReceipts, p.EPCasinoReceipts) {
				t.Fatal("bag serialization changed currency or replay receipts")
			}
		})
	}
}

func TestInventorySlotsSurviveBoundJournalReopenAndRepeatedLoginMapping(t *testing.T) {
	account := primitive.NewObjectID()
	p := &game.Entity{PersistenceAccountID: account, SubType: "Wizard", Level: 70, Gold: 900, EP: 23,
		Inventory: make([]game.Item, game.MaxInventorySize)}
	p.Inventory[8] = game.Item{ID: "earned-staff", Name: "Earned Staff", Type: game.ItemWeapon,
		Stack: 1, Potency: 6, Sockets: 1, Gems: []game.SocketedGem{{Type: game.GemRuby, Stats: map[string]int{"strength": 2}}},
		Stats: map[string]int{"damage": 31}, StatScaleVersion: game.ItemStatScaleVersion,
		ForgeBasis: &forging.Basis{Level: 70, Potency: 6, Stats: map[string]int{"damage": 29}}}
	p.Inventory[20] = game.Item{ID: "chronicle-drop", Name: "Rootbound Sigil", Type: game.ItemMaterial, Stack: 7, MaxStack: 100,
		Icon: "procedural:quest:rootbound-sigil", StatScaleVersion: game.ItemStatScaleVersion}
	want := append([]game.Item(nil), p.Inventory...)
	directory := t.TempDir()
	journal, err := database.OpenCharacterSaveJournal(directory)
	if err != nil {
		t.Fatal(err)
	}
	for repeat := 0; repeat < 3; repeat++ {
		snapshot := characterSnapshot("bound-slot-save", p, time.Unix(1234, 0))
		pending, err := journal.WriteForAccount(account, snapshot.Name, snapshot)
		if err != nil {
			t.Fatal(err)
		}
		journal, err = database.OpenCharacterSaveJournal(directory)
		if err != nil {
			t.Fatal(err)
		}
		pending, err = journal.Read(snapshot.Name)
		if err != nil || pending == nil || pending.AccountID != account {
			t.Fatal("bound journal identity lost", err)
		}
		saved, err := pending.Character()
		if err != nil {
			t.Fatal(err)
		}
		p.Inventory = restoreCharacterInventory(saved.Inventory)
		if !reflect.DeepEqual(p.Inventory, want) || saved.Gold != 900 || saved.EP != 23 {
			t.Fatal("repeated login mapping moved items or changed earned terms")
		}
		if err := journal.Acknowledge(snapshot.Name, pending.SaveID); err != nil {
			t.Fatal(err)
		}
	}
}

func TestInventoryLoginReadsCompactLegacyBagsAndLeavesGapsEmpty(t *testing.T) {
	for _, name := range []string{"Heart", "Eidolon Heart", "Shard", "Eidolon Shard"} {
		t.Run(name, func(t *testing.T) {
			original := []database.Item{{ID: "legacy-material", Name: name}, {},
				{ID: "legacy-blade", Name: "Old Blade", Stack: 1, Stats: map[string]int{"damage": 100}}}
			bag := restoreCharacterInventory(original)
			if len(bag) != game.MaxInventorySize || bag[0].Stack != 1 || bag[0].MaxStack != 1000 || bag[0].Icon == "" || bag[0].Name == "Heart" || bag[0].Name == "Shard" {
				t.Fatal("legacy migration changed")
			}
			if !reflect.DeepEqual(bag[1], game.Item{}) || bag[2].ID != "legacy-blade" || bag[2].StatScaleVersion != game.ItemStatScaleVersion {
				t.Fatal("empty slot fabricated an item or legacy gear failed to migrate")
			}
			if original[0].Name != name || original[0].Stack != 0 || original[2].Stats["damage"] != 100 {
				t.Fatal("login mapping mutated source save")
			}
			again := restoreCharacterInventory(databaseInventory(bag))
			if !reflect.DeepEqual(again, bag) {
				t.Fatal("second login rescaled or moved items")
			}
			compact := restoreCharacterInventory([]database.Item{original[0], original[2]})
			if compact[0].ID != original[0].ID || compact[1].ID != original[2].ID {
				t.Fatal("old compact save stranded an item")
			}
		})
	}
}

func TestDirectTradeOfflineClaimPreservesUnrelatedSparseBagSlots(t *testing.T) {
	store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, false)
	if _, err := completeTradeTestLocked(op); err != nil {
		t.Fatal(err)
	}
	character := store.characters["trade-bob"]
	character.Inventory = make([]database.Item, 8)
	character.Inventory[7] = database.Item{ID: "unrelated-earned-item", Stack: 1, Potency: 3,
		Stats: map[string]int{"intelligence": 125}, StatScaleVersion: 0}
	before := cloneTradeRecoveryCharacter(character)
	changed, err := claimTradeTestLocked("trade-bob", store)
	if err != nil || !changed {
		t.Fatal("offline claim failed", err)
	}
	after := store.characters["trade-bob"]
	if len(after.Inventory) != 8 || after.Inventory[0].ID != "earned-blade" || !reflect.DeepEqual(after.Inventory[7], before.Inventory[7]) {
		t.Fatal("offline delivery moved or rescaled an unrelated saved item")
	}
	for index := 1; index < 7; index++ {
		if after.Inventory[index].ID != "" {
			t.Fatal("offline delivery filled an unrelated gap")
		}
	}
	if after.Gold != 988 || after.EP != before.EP {
		t.Fatal("claim changed net Gold or EP")
	}
	assertTradeNoUnrelatedChanges(t, before, after)
	confirmed := cloneTradeRecoveryCharacter(after)
	writes := store.writes["trade-bob"]
	if changed, err := claimTradeTestLocked("trade-bob", store); err != nil || changed || store.writes["trade-bob"] != writes || !reflect.DeepEqual(store.characters["trade-bob"], confirmed) {
		t.Fatal("replay moved slots, rewrote storage or regranted custody", err)
	}
}
