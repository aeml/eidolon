package main

import (
	"encoding/json"
	"fmt"
	"maps"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestCasinoCheckpointFailedSaveReopenAndReplay(t *testing.T) {
	for _, currency := range []string{"gold", "ep"} {
		for _, amount := range []int{-100, 250} {
			t.Run(fmt.Sprintf("%s/%d", currency, amount), func(t *testing.T) {
				dir, committer := setupCharacterJournalTest(t)
				world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50), Economy: game.NewEconomyTelemetry(time.Now())}
				player := &game.Entity{ID: "player-owner", Name: "owner", Type: game.TypePlayer, SubType: "Fighter", State: "IDLE", Level: 1, Health: 100, MaxHealth: 100, Gold: 300, EP: 100,
					GoldCreditReceipts: map[string]int{"prior-gold": 9}, EPCasinoReceipts: map[string]int{"casino:prior:ep": 3},
					GroundAccountOrdinal: 1, GroundAccountOperationID: database.GroundItemOperationID("prior-ground"), GroundAccountFingerprint: "0123456789012345678901234567890123456789012345678901234567890123"}
				world.AddEntity(player)
				table := "public-blackjack"
				if currency == "ep" {
					table = "vip-blackjack"
				}
				op, err := (database.BlackjackTransfer{ID: "casino:checkpoint:interrupted", PlayerID: player.ID, Currency: currency, Amount: amount, NextState: []byte(`{"phase":"playing"}`)}).WithCasinoCheckpoint(table, 2)
				if err != nil {
					t.Fatal(err)
				}
				characterSaveCommitter = &epFailAfterPreflight{delegate: committer}
				if err := applyCasinoTransferLocked(table, op); err == nil {
					t.Fatal("failed save acknowledged")
				}
				pending, err := characterSaveJournal.Read(player.Name)
				if err != nil || pending == nil {
					t.Fatal("failed checkpoint save lost journal", err)
				}
				image, err := pending.Character()
				if err != nil || image.CasinoWalletCheckpoints[table].Fingerprint != op.Fingerprint || image.GroundAccountOperationID != player.GroundAccountOperationID {
					t.Fatal("journal split wallet/checkpoint or erased other recovery proof", err)
				}
				copy := world.GetEntityCopy(player.ID)
				copy.CasinoWalletCheckpoints[table] = database.CasinoWalletCheckpoint{}
				if player.CasinoWalletCheckpoints[table].Fingerprint != op.Fingerprint {
					t.Fatal("entity copy aliases wallet proof")
				}
				public, _ := json.Marshal(world.GetEntityCopy(player.ID))
				var fields map[string]json.RawMessage
				if json.Unmarshal(public, &fields) != nil || fields["CasinoWalletCheckpoints"] != nil {
					t.Fatal("wallet proof exposed in public JSON")
				}
				characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				failedCharacterSaves.users = map[string]bool{}
				characterSaveCommitter = committer
				if err := retryPendingCharacterSaves(); err != nil {
					t.Fatal(err)
				}
				if err := applyCasinoTransferLocked(table, op); err != nil {
					t.Fatal("replay failed", err)
				}
				wantGold, wantEP := 300+amount, 100
				if currency == "ep" {
					wantGold, wantEP = 300, 100+amount
				}
				if player.Gold != wantGold || player.EP != wantEP || committer.saved.Gold != wantGold || committer.saved.EP != wantEP || !maps.Equal(committer.saved.GoldCreditReceipts, map[string]int{"prior-gold": 9}) || !maps.Equal(committer.saved.EPCasinoReceipts, map[string]int{"casino:prior:ep": 3}) {
					t.Fatal("replay mixed currency or grew/removed legacy receipts")
				}
				if committer.saved.CasinoWalletCheckpoints[table].Fingerprint != op.Fingerprint {
					t.Fatal("full replay save lost checkpoint")
				}
				summary := world.Economy.Drain(time.Now())
				wantSink, wantSource := 0, 0
				if currency == "gold" {
					if amount < 0 {
						wantSink = -amount
					} else {
						wantSource = amount
					}
				}
				if summary.Sinks["casino_wagers"] != wantSink || summary.Sources["casino_returns"] != wantSource {
					t.Fatal("replay duplicated telemetry or EP entered Gold economy")
				}
			})
		}
	}
}

func TestCasinoCheckpointRegisteredCatalogFitsBound(t *testing.T) {
	records := map[string]bool{}
	for _, table := range game.CasinoTables() {
		if table.Game != "slots" {
			records[table.ID] = true
		}
	}
	for _, table := range game.CasinoBlackjackRecoveryTables() {
		records[table.ID] = true
	}
	for _, machine := range game.SlotMachines() {
		for _, currency := range []string{"gold", "ep"} {
			records[slotRecordKey("player-owner", machine.Theme, currency)] = true
		}
	}
	if len(records) > database.MaxCasinoWalletCheckpoints {
		t.Fatal("registered casino catalog exceeds durable head cap", len(records))
	}
	t.Logf("registered account recovery catalog %d records / %d-head bound", len(records), database.MaxCasinoWalletCheckpoints)
}
