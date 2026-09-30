package game

import (
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func guildCharacterOperation(action string, item *Item) database.GuildBankOperation {
	op := database.GuildBankOperation{Version: 1, Username: "bank-owner", PlayerID: "player-bank-owner",
		CharacterName: "bank-owner", GuildID: "guild-bank-fixture", RequestID: "request_1234567890",
		Action: action, Gold: 250, State: database.GuildBankPending, CreatedAt: time.Now().UTC()}
	if item != nil {
		payload, _ := json.Marshal(item)
		op.Gold, op.ItemPayload = 0, string(payload)
	}
	op.ID = database.GuildBankOperationID(op.Username, op.RequestID)
	op.Fingerprint = database.GuildBankOperationFingerprint(op)
	return op
}

func TestGuildBankCharacterEffectsAndReceiptsApplyExactlyOnce(t *testing.T) {
	for _, action := range []string{database.GuildBankDepositGold, database.GuildBankWithdrawGold,
		database.GuildBankDepositItem, database.GuildBankWithdrawItem} {
		t.Run(action, func(t *testing.T) {
			world := NewWorld(nil)
			player := &Entity{ID: "player-bank-owner", Type: TypePlayer, Gold: 1000, Inventory: make([]Item, MaxInventorySize)}
			var item *Item
			if action == database.GuildBankDepositItem || action == database.GuildBankWithdrawItem {
				item = &Item{ID: "rare-blade", Name: "Rare Blade", Stack: 1, MaxStack: 1, Rarity: RarityRare,
					Potency: 4, Stats: map[string]int{"strength": 15}, Sockets: 1,
					Gems: []SocketedGem{{Type: GemRuby, Quality: GemFlawless, Stats: map[string]int{"strength": 4}}}}
				if action == database.GuildBankDepositItem {
					player.Inventory[0] = cloneItem(*item)
				}
			}
			world.AddEntity(player)
			op := guildCharacterOperation(action, item)
			found, changed, err := world.ApplyDurableGuildBankCharacterOperation(op)
			if err != nil || !found || !changed {
				t.Fatalf("initial effect failed: %v/%v/%v", found, changed, err)
			}
			saved := world.GetEntityCopy(player.ID)
			if saved.GuildBankRevision != 1 || saved.GuildBankOpID != op.ID || saved.GuildBankOpFingerprint != op.Fingerprint {
				t.Fatal("effect did not carry its receipt into the snapshot")
			}
			// The expiry pin is process-local, intentionally not in save/public
			// snapshots. Check the actual owner under its lock instead.
			player.Mu.Lock()
			pinned := player.UnjournaledSave
			player.Mu.Unlock()
			if !pinned {
				t.Fatal("unsaved live effect is not pinned against expiry")
			}
			wantGold := 1000
			if action == database.GuildBankDepositGold {
				wantGold = 750
			} else if action == database.GuildBankWithdrawGold {
				wantGold = 1250
			}
			if saved.Gold != wantGold {
				t.Fatalf("Gold = %d, want %d", saved.Gold, wantGold)
			}
			if action == database.GuildBankDepositItem && saved.Inventory[0].ID != "" {
				t.Fatal("deposited item remains in bag")
			}
			if action == database.GuildBankWithdrawItem && !reflect.DeepEqual(saved.Inventory[0], *item) {
				t.Fatalf("withdrawal lost equipment data: %+v", saved.Inventory[0])
			}
			found, changed, err = world.ApplyDurableGuildBankCharacterOperation(op)
			if err != nil || !found || changed || !reflect.DeepEqual(saved, world.GetEntityCopy(player.ID)) {
				t.Fatal("same intent changed character state on replay")
			}
			public, _ := json.Marshal(saved)
			if strings.Contains(string(public), op.ID) || strings.Contains(string(public), op.Fingerprint) {
				t.Fatal("private bank receipts leaked through public entity serialization")
			}
		})
	}
}

func TestGuildBankCharacterRejectsStaleExecutorsAndConflictingReceipts(t *testing.T) {
	player := &Entity{ID: "player-bank-owner", Type: TypePlayer, Gold: 1000}
	first := guildCharacterOperation(database.GuildBankDepositGold, nil)
	if _, err := player.ApplyGuildBankCharacterOperation(first); err != nil {
		t.Fatal(err)
	}
	next := first
	next.RequestID, next.CharacterBankRevision = "request_1234567891", 1
	next.ID = database.GuildBankOperationID(next.Username, next.RequestID)
	next.Fingerprint = database.GuildBankOperationFingerprint(next)
	if _, err := player.ApplyGuildBankCharacterOperation(next); err != nil {
		t.Fatal(err)
	}
	if _, err := player.ApplyGuildBankCharacterOperation(first); !errors.Is(err, ErrGuildBankCharacterRejected) || player.Gold != 500 || player.GuildBankRevision != 2 {
		t.Fatalf("old executor reapplied after the last receipt moved: %v", err)
	}
	player.GuildBankOpFingerprint = "corrupt-receipt"
	if _, err := player.ApplyGuildBankCharacterOperation(next); !errors.Is(err, database.ErrGuildBankOperationConflict) || player.Gold != 500 {
		t.Fatalf("conflicting receipt paid again: %v", err)
	}
}

func TestGuildBankCharacterFailureLeavesWalletBagAndReceiptUnchanged(t *testing.T) {
	for _, scenario := range []string{"insufficient-gold", "overflow", "changed-item", "partial-stack", "hidden-slot", "story-item", "wrong-player", "invalid-intent"} {
		t.Run(scenario, func(t *testing.T) {
			player := &Entity{ID: "player-bank-owner", Type: TypePlayer, Gold: 1000, Inventory: make([]Item, MaxInventorySize)}
			op := guildCharacterOperation(database.GuildBankDepositGold, nil)
			switch scenario {
			case "insufficient-gold":
				player.Gold = 100
			case "overflow":
				player.Gold = math.MaxInt
				op = guildCharacterOperation(database.GuildBankWithdrawGold, nil)
			case "changed-item":
				item := Item{ID: "blade", Name: "Blade", Stack: 1, Potency: 1}
				op = guildCharacterOperation(database.GuildBankDepositItem, &item)
				item.Potency++
				player.Inventory[0] = item
			case "partial-stack", "hidden-slot":
				for i := range player.Inventory {
					player.Inventory[i] = Item{ID: "occupied", Name: "Occupied", Stack: 1}
				}
				item := Item{ID: "incoming", Name: "Shard", Stack: 5, MaxStack: 10, Icon: "incoming-icon"}
				if scenario == "partial-stack" {
					player.Inventory[0] = Item{ID: "old-shard", Name: "Shard", Stack: 8}
				} else {
					player.Inventory = append(player.Inventory, Item{})
				}
				op = guildCharacterOperation(database.GuildBankWithdrawItem, &item)
			case "story-item":
				item := Item{ID: "chronicle-item-seed", Name: "Memory Seed", Stack: 1}
				player.Inventory[0] = item
				op = guildCharacterOperation(database.GuildBankDepositItem, &item)
			case "wrong-player":
				player.ID = "player-someone-else"
			case "invalid-intent":
				op.Gold++ // Fingerprint must match the immutable plan.
			}
			before, _ := json.Marshal(player.Inventory)
			gold := player.Gold
			if _, err := player.ApplyGuildBankCharacterOperation(op); err == nil {
				t.Fatal("invalid effect accepted")
			}
			after, _ := json.Marshal(player.Inventory)
			if string(before) != string(after) || player.Gold != gold || player.GuildBankRevision != 0 || player.GuildBankOpID != "" {
				t.Fatal("failed effect partially changed character state")
			}
		})
	}
}

func TestGuildBankCharacterConcurrentReplayAndDisconnectedRecovery(t *testing.T) {
	world := NewWorld(nil)
	player := &Entity{ID: "player-bank-owner", Type: TypePlayer, Gold: 1000, Disconnected: true, State: "DEAD"}
	world.AddEntity(player)
	op := guildCharacterOperation(database.GuildBankDepositGold, nil)
	var changedCount atomic.Int32
	var group sync.WaitGroup
	for i := 0; i < 20; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			found, changed, err := world.ApplyDurableGuildBankCharacterOperation(op)
			if err != nil || !found {
				t.Errorf("recovery failed: %v/%v", found, err)
			}
			if changed {
				changedCount.Add(1)
			}
		}()
	}
	group.Wait()
	if changedCount.Load() != 1 || world.GetEntityCopy(player.ID).Gold != 750 {
		t.Fatal("concurrent replay applied more than once")
	}
	if found, changed, err := NewWorld(nil).ApplyDurableGuildBankCharacterOperation(op); found || changed || err != nil {
		t.Fatalf("missing live actor must select offline recovery: %v/%v/%v", found, changed, err)
	}
}

func TestGuildBankCharacterDecodesCanonicalRepositoryItemWithoutStatRescaling(t *testing.T) {
	stored := database.Item{ID: "canonical-blade", Name: "Canonical Blade", Stack: 1, MaxStack: 1,
		Potency: 5, Stats: map[string]int{"damage": 625}, StatScaleVersion: 0,
		Gems: []database.SocketedGem{{Type: "Ruby", Quality: "Flawless", Stats: map[string]int{"strength": 250}}}}
	payload, _ := json.Marshal(stored)
	op := guildCharacterOperation(database.GuildBankWithdrawItem, nil)
	op.Gold, op.ItemPayload = 0, string(payload)
	op.Fingerprint = database.GuildBankOperationFingerprint(op)
	player := &Entity{ID: op.PlayerID, Type: TypePlayer}
	if _, err := player.ApplyGuildBankCharacterOperation(op); err != nil {
		t.Fatal(err)
	}
	item := player.Inventory[0]
	if item.Stats["damage"] != 625 || item.Gems[0].Stats["strength"] != 250 || item.StatScaleVersion != 0 || item.Potency != 5 {
		t.Fatalf("recovery changed the committed item payload: %+v", item)
	}
}
