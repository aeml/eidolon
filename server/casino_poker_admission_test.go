package main

import (
	"strings"
	"testing"

	"eidolon-server/internal/game"
)

func TestPokerBuyInAdmissionDistinguishesChangedHandFromStake(t *testing.T) {
	round := strings.Repeat("a", 32)
	for _, currency := range []string{"gold", "ep"} {
		minimum, maximum, step := game.CasinoBetLimits("poker", currency)
		state := &pokerTableState{RoundID: round, Phase: "betting"}
		for _, amount := range []int{minimum, minimum + step, maximum} {
			if err := pokerBuyInAdmissionError(state, round, currency, amount); err != nil {
				t.Fatal("ordinary valid buy-in refused", currency, amount, err)
			}
		}
		for _, amount := range []int{-step, 0, minimum - 1, maximum + step} {
			err := pokerBuyInAdmissionError(state, round, currency, amount)
			if err == nil || !strings.HasPrefix(err.Error(), "review the hand and choose ") {
				t.Fatal("invalid buy-in bounds did not retain stake feedback")
			}
		}
		if step > 1 && pokerBuyInAdmissionError(state, round, currency, minimum+1) == nil {
			t.Fatal("invalid step admitted")
		}
		for _, phase := range []string{"betting", "playing", "settling", "complete"} {
			state.Phase = phase
			requestRound := round
			if phase == "betting" {
				requestRound = strings.Repeat("b", 32)
			}
			for _, amount := range []int{minimum, 0} {
				err := pokerBuyInAdmissionError(state, requestRound, currency, amount)
				if err == nil || err.Error() != "poker hand changed; review the table" {
					t.Fatal("stale/closed hand mislabeled as a stake failure")
				}
				if state.Phase != phase || state.RoundID != round || len(state.Players) != 0 || state.Round != nil {
					t.Fatal("refused request changed the hand")
				}
			}
		}
	}
}
