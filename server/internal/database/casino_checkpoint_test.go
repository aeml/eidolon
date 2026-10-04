package database

import (
	"errors"
	"fmt"
	"maps"
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func checkpointTransfer(t *testing.T, table string, version int64, amount int) BlackjackTransfer {
	t.Helper()
	currency, err := CasinoCurrencyForRecord(table)
	if err != nil {
		t.Fatal(err)
	}
	op, err := (BlackjackTransfer{ID: fmt.Sprintf("casino:checkpoint:%08d", version), PlayerID: "player-owner", Currency: currency, Amount: amount, NextState: []byte(`{"phase":"saved"}`)}).WithCasinoCheckpoint(table, version)
	if err != nil {
		t.Fatal(err)
	}
	return op
}

func TestCasinoCheckpointHistoryIsBoundedAndReplayKeepsWalletsIsolated(t *testing.T) {
	gold, ep := 100, 100
	goldLegacy, epLegacy := map[string]int{"other-legacy-credit": 7}, map[string]int{"casino:legacy:credit": 3}
	var heads map[string]CasinoWalletCheckpoint
	var first []BlackjackTransfer
	var initialSize int
	for index := 0; index < 1000; index++ {
		amount := 1
		if index%2 == 0 {
			amount = -1
		}
		for _, table := range []string{"public-blackjack", "vip-blackjack"} {
			op := checkpointTransfer(t, table, int64(index*3+2), amount)
			if changed, err := ApplyCasinoWalletCheckpoint(&gold, &ep, goldLegacy, epLegacy, &heads, op); err != nil || !changed {
				t.Fatal(index, changed, err)
			}
			if index == 0 {
				first = append(first, op)
			}
		}
		encoded, err := bson.Marshal(&Character{Gold: gold, EP: ep, CasinoWalletCheckpoints: heads})
		if err != nil {
			t.Fatal(err)
		}
		if index == 0 {
			initialSize = len(encoded)
		}
		if len(encoded) != initialSize || len(heads) != 2 {
			t.Fatal("history grew per round", len(encoded), initialSize, len(heads))
		}
	}
	if gold != 100 || ep != 100 || !maps.Equal(goldLegacy, map[string]int{"other-legacy-credit": 7}) || !maps.Equal(epLegacy, map[string]int{"casino:legacy:credit": 3}) {
		t.Fatal("currency or legacy map changed incorrectly")
	}
	gold, ep = 0, 0 // Funds were legitimately spent after all accepted transfers.
	for _, op := range first {
		if changed, err := ApplyCasinoWalletCheckpoint(&gold, &ep, goldLegacy, epLegacy, &heads, op); err != nil || changed || gold != 0 || ep != 0 {
			t.Fatal("historical canonical replay charged again", changed, err)
		}
	}
	t.Logf("2000 modeled signed transfers, two heads, BSON size constant %d bytes, original maps retained", initialSize)
}

func TestCasinoCheckpointRejectsMutationAndDoesNotRecordFailedFunding(t *testing.T) {
	for _, mode := range []string{"amount", "owner", "candidate", "table", "currency", "version", "fingerprint", "insufficient-gold", "insufficient-ep", "overflow", "legacy-conflict", "head-conflict", "malformed-head", "capacity"} {
		t.Run(mode, func(t *testing.T) {
			gold, ep := 100, 100
			op := checkpointTransfer(t, "public-blackjack", 2, -100)
			var heads map[string]CasinoWalletCheckpoint
			var legacy map[string]int
			switch mode {
			case "amount":
				op.Amount++
			case "owner":
				op.PlayerID = "player-other"
			case "candidate":
				op.NextState = []byte(`{"phase":"different"}`)
			case "table":
				op.TableID = "vip-blackjack"
			case "currency":
				op.Currency = "ep"
			case "version":
				op.TableVersion++
			case "fingerprint":
				op.Fingerprint = strings.Repeat("a", 64)
			case "insufficient-gold":
				gold = 99
			case "insufficient-ep":
				ep = 99
				op = checkpointTransfer(t, "vip-blackjack", 2, -100)
			case "overflow":
				gold = int(^uint(0) >> 1)
				op = checkpointTransfer(t, "public-blackjack", 2, 1)
			case "legacy-conflict":
				legacy = map[string]int{op.ID: 100}
			case "head-conflict":
				heads = map[string]CasinoWalletCheckpoint{op.TableID: {Version: 2, ID: "casino:other:decision", Fingerprint: op.Fingerprint}}
			case "malformed-head":
				heads = map[string]CasinoWalletCheckpoint{op.TableID: {Version: 9, ID: "casino:malformed:head"}}
			case "capacity":
				heads = map[string]CasinoWalletCheckpoint{}
				for i := 0; i < MaxCasinoWalletCheckpoints; i++ {
					heads[fmt.Sprint(i)] = CasinoWalletCheckpoint{Version: 2, ID: op.ID, Fingerprint: op.Fingerprint}
				}
			}
			beforeGold, beforeEP, beforeHeads := gold, ep, maps.Clone(heads)
			if changed, err := ApplyCasinoWalletCheckpoint(&gold, &ep, legacy, nil, &heads, op); err == nil || changed || gold != beforeGold || ep != beforeEP || !maps.Equal(heads, beforeHeads) {
				t.Fatal("invalid intent mutated wallet/proof", changed, err)
			}
		})
	}
	// Exact replay precedes funds checks, but only a successful saved effect
	// creates a head. A declined wager leaves the prior head completely intact.
	gold, ep := 100, 0
	var heads map[string]CasinoWalletCheckpoint
	op := checkpointTransfer(t, "public-blackjack", 2, -100)
	if _, err := ApplyCasinoWalletCheckpoint(&gold, &ep, nil, nil, &heads, op); err != nil {
		t.Fatal(err)
	}
	if changed, err := ApplyCasinoWalletCheckpoint(&gold, &ep, nil, nil, &heads, op); err != nil || changed {
		t.Fatal("exact funded replay checked insufficient balance", changed, err)
	}
	next := checkpointTransfer(t, "public-blackjack", 5, -1)
	if _, err := ApplyCasinoWalletCheckpoint(&gold, &ep, nil, nil, &heads, next); !errors.Is(err, ErrInsufficientGold) || heads[op.TableID].Version != 2 {
		t.Fatal("declined wager advanced proof", err)
	}
}

func TestCasinoCheckpointAdoptsMatchingLegacyProofWithoutPayingAgain(t *testing.T) {
	gold, ep := 0, 0
	op := checkpointTransfer(t, "vip-blackjack", 2, -100)
	legacy := map[string]int{op.ID: -100}
	var heads map[string]CasinoWalletCheckpoint
	if changed, err := ApplyCasinoWalletCheckpoint(&gold, &ep, nil, legacy, &heads, op); err != nil || changed || ep != 0 || heads[op.TableID].Version != 2 || legacy[op.ID] != -100 {
		t.Fatal("mixed-version replay repeated debit or dropped legacy proof", changed, err)
	}
	legacyOp := BlackjackTransfer{ID: "casino:legacy:pending", PlayerID: "player-owner", Currency: "gold", Amount: -10, NextState: []byte(`{"phase":"playing"}`)}
	if legacyOp.ValidateForTable("public-blackjack") != nil || legacyOp.TableVersion != 0 {
		t.Fatal("retained legacy intent became invalid")
	}
}
