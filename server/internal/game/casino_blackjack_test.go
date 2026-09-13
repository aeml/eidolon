package game

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"
)

func blackjackFixture(t *testing.T, deck []int) *BlackjackRound {
	t.Helper()
	r, err := newBlackjackRound("round-one", []BlackjackEntry{{PlayerID: "alice", Seat: 0, Bet: 100}}, time.Unix(1000, 0), deck)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func blackjackMove(t *testing.T, r *BlackjackRound, action string) (*BlackjackRound, int) {
	t.Helper()
	next, extra, err := r.Propose(r.Players[r.TurnPlayer].PlayerID, action, r.Revision, time.Unix(1001, 0))
	if err != nil {
		t.Fatal(err)
	}
	return next, extra
}

func TestBlackjackNaturalsSoftSeventeenAndBust(t *testing.T) {
	for _, tc := range []struct {
		name            string
		deck            []int
		action, outcome string
		payout          int
	}{
		{"natural", []int{0, 9, 12, 6}, "", "blackjack", 250},
		{"natural needs no dealer draw", []int{0, 2, 12, 3}, "", "blackjack", 250},
		{"natural push", []int{0, 0, 12, 12}, "", "push", 100},
		{"dealer peek", []int{9, 0, 8, 12}, "", "lose", 0},
		{"stand soft seventeen", []int{9, 0, 7, 5}, "stand", "win", 200},
		{"bust", []int{9, 9, 5, 6, 9}, "hit", "bust", 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := blackjackFixture(t, tc.deck)
			if tc.action != "" {
				r, _ = blackjackMove(t, r, tc.action)
			}
			h := r.Players[0].Hands[0]
			if r.Phase != "complete" || h.Payout != tc.payout || h.Outcome != tc.outcome {
				t.Fatal(r, h)
			}
		})
	}
	if total, soft := BlackjackTotal([]int{0, 13, 8}); total != 21 || !soft {
		t.Fatal("multiple aces", total, soft)
	}
}

func TestBlackjackDoubleSplitAndImmutableFundingProposal(t *testing.T) {
	r := blackjackFixture(t, []int{4, 9, 5, 6, 9})
	before, _ := json.Marshal(r)
	next, extra := blackjackMove(t, r, "double")
	after, _ := json.Marshal(r)
	if string(before) != string(after) || extra != 100 || next.Players[0].Hands[0].Payout != 400 {
		t.Fatal("double/funding proposal", extra, next)
	}
	// A failed debit can discard the candidate; a retry uses the same persisted
	// shoe and obtains exactly the same result, not a new random hand.
	retry, _ := blackjackMove(t, r, "double")
	if !reflect.DeepEqual(next, retry) {
		t.Fatal("funding retry rerolled outcome")
	}
	r = blackjackFixture(t, []int{7, 9, 7, 6, 2, 1, 9, 9})
	r, extra = blackjackMove(t, r, "split")
	if extra != 100 || len(r.Players[0].Hands) != 2 || r.TurnHand != 0 {
		t.Fatal("split", r)
	}
	r, _ = blackjackMove(t, r, "hit")
	if r.TurnHand != 1 {
		t.Fatal("split hand order")
	}
	r, extra = blackjackMove(t, r, "double")
	if extra != 100 || r.Phase != "complete" || r.Players[0].Hands[0].Payout != 200 || r.Players[0].Hands[1].Payout != 400 {
		t.Fatal("double after split", r)
	}
	aces := blackjackFixture(t, []int{0, 9, 0, 6, 9, 8})
	aces, _ = blackjackMove(t, aces, "split")
	if aces.Phase != "complete" || aces.Players[0].Hands[0].Payout != 200 || len(aces.Players[0].Hands[0].Cards) != 2 {
		t.Fatal("split aces received natural bonus or another card")
	}
	limited := blackjackFixture(t, []int{7, 9, 7, 6, 7, 7, 7, 7, 7, 7})
	for i := 0; i < 3; i++ {
		limited, _ = blackjackMove(t, limited, "split")
	}
	if _, _, err := limited.Propose("alice", "split", limited.Revision, time.Unix(1001, 0)); err == nil {
		t.Fatal("fifth split hand accepted")
	}
}

func TestBlackjackSharedTurnPrivacyTimeoutAndRestoredRound(t *testing.T) {
	now := time.Unix(1000, 0)
	r, err := newBlackjackRound("multi", []BlackjackEntry{{"bob", 1, 20}, {"alice", 0, 100}}, now, []int{9, 8, 5, 7, 8, 9, 4})
	if err != nil {
		t.Fatal(err)
	}
	view := r.View("bob")
	encoded, _ := json.Marshal(view)
	if len(view.Dealer) != 1 || !view.DealerHidden || len(view.Actions) != 0 || strings.Contains(string(encoded), "\"deck\"") {
		t.Fatal("private shoe/turn leaked", string(encoded))
	}
	view.Players[0].Hands[0].Cards[0] = 42
	if r.Players[0].Hands[0].Cards[0] == 42 {
		t.Fatal("view aliases round")
	}
	if _, _, err := r.Propose("bob", "stand", r.Revision, now); err == nil {
		t.Fatal("other player took turn")
	}
	if _, _, err := r.Propose("alice", "stand", r.Revision-1, now); err == nil {
		t.Fatal("stale revision accepted")
	}
	if _, _, err := r.Propose("alice", "stand", r.Revision, r.Deadline); err == nil {
		t.Fatal("late action accepted")
	}
	if _, err := r.Timeout(now); err == nil {
		t.Fatal("early timeout accepted")
	}
	encoded, _ = json.Marshal(r)
	var restored BlackjackRound
	if err := json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	next, err := restored.Timeout(r.Deadline)
	if err != nil || next.TurnPlayer != 1 || next.Players[0].Hands[0].Done != true {
		t.Fatal("restored timeout", next, err)
	}
	if r.Players[0].Hands[0].Done {
		t.Fatal("timeout mutated original")
	}
	finished, _, err := next.Propose("bob", "stand", next.Revision, r.Deadline.Add(time.Second))
	if err != nil || finished.Phase != "complete" || finished.View("bob").DealerHidden {
		t.Fatal("shared round finish", finished, err)
	}
	for _, p := range finished.Players {
		if p.Hands[0].Payout != 0 {
			t.Fatal("dealer21 payout", p)
		}
	}
}

func TestBlackjackShoeAndOpeningBounds(t *testing.T) {
	for _, bet := range []int{-20, 0, 19, 21, 501, 1000000000} {
		if ValidBlackjackBet(bet) {
			t.Fatal("unbounded/noninteger payout stake", bet)
		}
	}
	if _, err := newBlackjackRound("duplicate", []BlackjackEntry{{"alice", 0, 100}, {"bob", 0, 100}}, time.Now(), []int{1}); err == nil {
		t.Fatal("duplicate seat")
	}
	if _, err := newBlackjackRound("badshoe", []BlackjackEntry{{"alice", 0, 100}}, time.Now(), []int{99}); err == nil {
		t.Fatal("invalid card")
	}
	r, err := NewBlackjackRound("secure-shoe", []BlackjackEntry{{"alice", 0, 100}}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if err := r.Validate(); err != nil {
		t.Fatal("valid production round rejected", err)
	}
	corrupt := r.clone()
	corrupt.Deck[0] = 99
	if corrupt.Validate() == nil {
		t.Fatal("corrupt persisted shoe accepted")
	}
	counts := [52]int{}
	for _, card := range r.Deck {
		counts[card]++
	}
	for _, card := range r.Dealer {
		counts[card]++
	}
	for _, p := range r.Players {
		for _, h := range p.Hands {
			for _, card := range h.Cards {
				counts[card]++
			}
		}
	}
	for card, count := range counts {
		if count != 6 {
			t.Fatal("not a six-deck shoe", card, count)
		}
	}
}
