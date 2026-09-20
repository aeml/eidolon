package game

import (
	"encoding/json"
	"testing"
	"time"
)

func TestCasinoEPLimitsAndLegacyGold(t *testing.T) {
	for _, name := range []string{"blackjack", "poker", "slots", "roulette", "baccarat"} {
		minimum, maximum, step := CasinoBetLimits(name, "ep")
		if maximum != 100 || !ValidCasinoBet(name, "ep", minimum) || !ValidCasinoBet(name, "ep", maximum) {
			t.Fatal(name, minimum, maximum, step)
		}
		for _, invalid := range []int{-1, 0, minimum - 1, maximum + step} {
			if ValidCasinoBet(name, "ep", invalid) {
				t.Fatal("bad EP stake", name, invalid)
			}
		}
		if !ValidCasinoBet(name, "gold", 100000) || !ValidCasinoBet(name, "", 100000) || ValidCasinoBet(name, "EP", 100) {
			t.Fatal("currency policy", name)
		}
	}
}

func TestCasinoEPBlackjackNaturalAndDoubleRemainExact(t *testing.T) {
	now := time.Unix(1000, 0)
	for _, bet := range []int{2, 10, 100} {
		r, err := newBlackjackRoundForCurrency("ep-natural", []BlackjackEntry{{"hero", 0, bet}}, now, []int{0, 9, 12, 6}, "ep")
		if err != nil || r.Currency != "ep" || r.Players[0].Hands[0].Payout != bet*5/2 {
			t.Fatal("natural not exact3:2", bet, err)
		}
		r, err = newBlackjackRoundForCurrency("ep-double", []BlackjackEntry{{"hero", 0, bet}}, now, []int{4, 9, 5, 6, 9}, "ep")
		if err != nil {
			t.Fatal(err)
		}
		next, extra := blackjackMove(t, r, "double")
		if next.Currency != "ep" || extra != bet || next.Players[0].Hands[0].Payout != bet*4 {
			t.Fatal("double changed units")
		}
	}
	r, err := NewBlackjackRoundForCurrency("ep-real-shoe", []BlackjackEntry{{"hero", 0, 2}}, now, "ep")
	if err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(r)
	var restored BlackjackRound
	if json.Unmarshal(data, &restored) != nil || restored.Currency != "ep" || restored.Validate() != nil {
		t.Fatal("EP blackjack restore")
	}
	restored.Currency = "unknown"
	if restored.Validate() == nil {
		t.Fatal("unknown saved currency accepted")
	}
}

func TestCasinoEPPokerBlindsSharedPotAndRestoredCurrency(t *testing.T) {
	r, err := newPokerRoundForCurrency("ep-poker", []PokerEntry{{"A", 0, 10}, {"B", 1, 20}, {"C", 2, 100}}, -1, time.Unix(1000, 0), pokerTestDeck(nil), "ep")
	if err != nil || r.Validate() != nil {
		t.Fatal("EP poker start", err)
	}
	if r.Players[1].StreetBet != 1 || r.Players[2].StreetBet != 2 || r.LastRaise != 2 {
		t.Fatal("wrong EP blinds")
	}
	// Unequal real-player stacks exercise side pots, not house opponents.
	for moves := 0; r.Phase == "playing" && moves < 6; moves++ {
		r = pokerMove(t, r, "all_in", 0)
	}
	if r.Phase != "complete" {
		t.Fatal("EP all-in hand did not complete")
	}
	total := 0
	for _, p := range r.Players {
		total += p.Payout
	}
	if total != 130 {
		t.Fatal("EP created/lost at shared pot", total)
	}
	data, _ := json.Marshal(r)
	var restored PokerRound
	if json.Unmarshal(data, &restored) != nil || restored.Currency != "ep" || restored.Validate() != nil {
		t.Fatal("EP poker restore")
	}
	if _, err := NewPokerRoundForCurrency("solo", []PokerEntry{{"A", 0, 10}}, -1, time.Now(), "ep"); err == nil {
		t.Fatal("solo EP poker admitted")
	}
}

func TestCasinoEPSlotsStakeChangesFeaturesAndExactPaylines(t *testing.T) {
	for _, machine := range SlotMachines() {
		s, err := NewSlotSessionForCurrency(machine.Theme, "ep")
		if err != nil || s.Bet != 10 {
			t.Fatal(err)
		}
		for _, bet := range []int{10, 100, 20} {
			next, debit, err := proposeSlotSpin(*s, bet, slotConstantDraw)
			if err != nil || debit != bet || next.Currency != "ep" || next.Last.Stages[0].Wins[0].Payout != machine.Pays[0][2]*(bet/10) {
				t.Fatal("EP line stake lost or changed", machine.Theme, bet, err)
			}
			s = next
		}
		// Force scattered keys, retaining the actual precommitted bonus choice.
		bonus, _, err := proposeSlotSpin(*s, 20, func(limit int) (int, error) {
			if limit == 100 {
				return 99, nil
			}
			return 0, nil
		})
		if err != nil || !bonus.Bonus || bonus.FreeSpins == 0 {
			t.Fatal("EP bonus missing", err)
		}
		resolved, payout, err := ProposeSlotBonus(*bonus, 1)
		if err != nil || payout <= 0 || resolved.Currency != "ep" {
			t.Fatal("EP bonus payout", err)
		}
		if _, _, err := proposeSlotSpin(*resolved, 10, slotConstantDraw); err == nil {
			t.Fatal("saved free spin changed stake")
		}
		free, debit, err := proposeSlotSpin(*resolved, 20, slotConstantDraw)
		if err != nil || debit != 0 || !free.Last.Free {
			t.Fatal("EP free spin charged", err)
		}
		data, _ := json.Marshal(free)
		var restored SlotSession
		if json.Unmarshal(data, &restored) != nil || restored.Currency != "ep" || restored.Validate() != nil {
			t.Fatal("EP slot restore")
		}
	}
	fire, _ := NewSlotSessionForCurrency("fire", "ep")
	fire.Bet, fire.FreeSpins = 100, 1
	jackpot, debit, err := proposeSlotSpin(*fire, 100, func(int) (int, error) { return 85, nil })
	if err != nil || debit != 0 || jackpot.Last.Payout != 20000 {
		t.Fatal("EP maximum jackpot", err)
	}
}
