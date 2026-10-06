package main

import (
	"fmt"
	"strings"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestBlackjackWagerAdmissionDistinguishesChangedRoundFromStake(t *testing.T) {
	round := strings.Repeat("a", 32)
	for _, currency := range []string{"gold", "ep"} {
		minimum, maximum, step := game.CasinoBetLimits("blackjack", currency)
		for _, bet := range []int{minimum, maximum, minimum + step} {
			state := &blackjackTableState{RoundID: round, Phase: "betting"}
			if err := blackjackBetAdmissionError(state, round, currency, bet); err != nil {
				t.Fatal("valid wager refused", currency, bet, err)
			}
		}
		for _, bet := range []int{-1, 0, minimum - 1, maximum + step, minimum + 1} {
			state := &blackjackTableState{RoundID: round, Phase: "betting"}
			want := fmt.Sprintf("review the current round and choose %d–%d %s in steps of %d", minimum, maximum, currency, step)
			if err := blackjackBetAdmissionError(state, round, currency, bet); err == nil || err.Error() != want {
				t.Fatal("invalid stake lost its bounds/step refusal", currency, bet, err)
			}
		}
		for _, phase := range []string{"betting", "playing", "settling", "complete"} {
			requestRound := round
			if phase == "betting" {
				requestRound = strings.Repeat("b", 32)
			}
			for _, bet := range []int{minimum, 0} {
				state := &blackjackTableState{RoundID: round, Phase: phase}
				if err := blackjackBetAdmissionError(state, requestRound, currency, bet); err == nil || err.Error() != "blackjack round changed; review the table" {
					t.Fatal("changed/closed round mislabeled as stake failure", currency, phase, err)
				}
				if state.RoundID != round || state.Phase != phase || len(state.Players) != 0 || state.Round != nil {
					t.Fatal("admission diagnostic changed table state")
				}
			}
		}
	}
}

func TestBlackjackPendingAccountGateFailsClosedWithoutBlockingOthers(t *testing.T) {
	oldDB, oldCache, oldAvailable := db, blackjackCached, blackjackAvailable
	defer func() { db, blackjackCached, blackjackAvailable = oldDB, oldCache, oldAvailable }()
	db = nil
	blackjackCached = &database.BlackjackTableRecord{TableID: publicBlackjackTable, Version: 2, State: []byte(`{"phase":"betting"}`),
		Pending: &database.BlackjackTransfer{ID: "casino:round:bet", PlayerID: "player-alice", Currency: "gold", Amount: -100, NextState: []byte(`{"phase":"playing"}`)}}
	if err := recoverAccountBlackjackLocked("bob"); err != nil {
		t.Fatal("unrelated player attempted table database IO", err)
	}
	if err := recoverAccountBlackjackLocked("alice"); err == nil {
		t.Fatal("pending owner admitted with unavailable funds storage")
	}
	if blackjackCached.Pending == nil {
		t.Fatal("failed admission discarded recovery intent")
	}
	blackjackCached = nil
	if err := recoverAccountBlackjackLocked("alice"); err != nil {
		t.Fatal("ordinary command queried casino storage")
	}
}
