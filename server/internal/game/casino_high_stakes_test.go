package game

import (
	"encoding/json"
	"testing"
	"time"
)

func TestCasinoHighGoldStakesAndSavedReturns(t *testing.T) {
	if !ValidBlackjackBet(100000) || !ValidPokerBuyIn(100000) || ValidBlackjackBet(100020) || ValidPokerBuyIn(100100) {
		t.Fatal("incorrect Gold limits")
	}
	// Preserve a complete valid six-deck shoe while dealing a known natural.
	deck := []int{0, 9, 12, 6}
	counts := map[int]int{0: 1, 9: 1, 12: 1, 6: 1}
	for c := 0; c < 52; c++ {
		for n := counts[c]; n < 6; n++ {
			deck = append(deck, c)
		}
	}
	r, err := newBlackjackRound("large-natural", []BlackjackEntry{{"A", 0, 100000}}, time.Now(), deck)
	if err != nil || r.Players[0].Hands[0].Payout != 250000 || r.Validate() != nil {
		t.Fatal("3:2 natural/save", err)
	}
	encoded, _ := json.Marshal(r)
	var restored BlackjackRound
	if json.Unmarshal(encoded, &restored) != nil || restored.Validate() != nil {
		t.Fatal("natural restore")
	}
	p := pokerTestRound(t, 100000, 100000)
	p = pokerMove(t, p, "all_in", 0)
	p = pokerMove(t, p, "call", 0)
	if p.Phase != "complete" || p.Validate() != nil || p.Players[0].Payout+p.Players[1].Payout != 200000 {
		t.Fatal("large poker settlement")
	}
	encoded, _ = json.Marshal(p)
	var restoredPoker PokerRound
	if json.Unmarshal(encoded, &restoredPoker) != nil || restoredPoker.Validate() != nil {
		t.Fatal("poker restore")
	}
}

func TestPokerLiveHandDescriptionAndPrivacy(t *testing.T) {
	cases := []struct {
		cards []int
		want  string
	}{
		{[]int{1, 14}, "Pair of 2s"},
		{[]int{0, 12}, "Ace high"},
		{[]int{1, 14, 27, 2, 15}, "Full house — 2s full of 3s"},
		{[]int{0, 1, 2, 3, 4}, "Straight flush — 5 high"},
		{[]int{-1, -1}, ""},
	}
	for _, c := range cases {
		if got := PokerHandDescription(c.cards); got != c.want {
			t.Fatalf("%v: %q != %q", c.cards, got, c.want)
		}
	}
	p := pokerTestRound(t, 100, 100)
	for _, viewer := range []string{"A", "B", "observer"} {
		for _, v := range p.View(viewer).Players {
			if v.PlayerID == viewer && v.BestHand == "" {
				t.Fatal("own current hand missing")
			}
			if v.PlayerID != viewer && (v.BestHand != "" || v.Hand != "" || v.Cards[0] != -1) {
				t.Fatal("opponent hand leaked")
			}
		}
	}
}
