package game

import (
	"encoding/json"
	"math/rand"
	"reflect"
	"strings"
	"testing"
	"time"
)

func pokerCard(rank, suit int) int {
	if rank == 14 {
		rank = 1
	}
	return suit*13 + rank - 1
}
func pokerTestDeck(prefix []int) []int {
	deck := append([]int{}, prefix...)
	used := map[int]bool{}
	for _, c := range prefix {
		used[c] = true
	}
	for c := 0; c < 52; c++ {
		if !used[c] {
			deck = append(deck, c)
		}
	}
	return deck
}
func pokerTestRound(t *testing.T, amounts ...int) *PokerRound {
	t.Helper()
	entries := []PokerEntry{}
	for i, amount := range amounts {
		entries = append(entries, PokerEntry{PlayerID: string(rune('A' + i)), Seat: i, BuyIn: amount})
	}
	r, err := newPokerRound("test-hand", entries, -1, time.Unix(1000, 0), pokerTestDeck(nil))
	if err != nil {
		t.Fatal(err)
	}
	return r
}
func pokerMove(t *testing.T, r *PokerRound, action string, amount int) *PokerRound {
	t.Helper()
	before, _ := json.Marshal(r)
	next, err := r.Propose(r.Players[r.Turn].PlayerID, action, amount, r.Revision, r.Deadline.Add(-time.Second))
	if err != nil {
		t.Fatal(err)
	}
	after, _ := json.Marshal(r)
	if string(before) != string(after) {
		t.Fatal("proposal mutated original")
	}
	if err := next.Validate(); err != nil {
		t.Fatalf("invalid %s result: %v %+v", action, err, next)
	}
	return next
}

func TestPokerHandRanking(t *testing.T) {
	cases := []struct {
		name  string
		cards []int
	}{
		{"High card", []int{pokerCard(14, 0), pokerCard(11, 1), pokerCard(9, 0), pokerCard(6, 2), pokerCard(3, 3)}},
		{"One pair", []int{0, 13, pokerCard(9, 1), pokerCard(6, 2), pokerCard(3, 3)}},
		{"Two pair", []int{0, 13, 1, 14, 8}},
		{"Three of a kind", []int{0, 13, 26, 1, 8}},
		{"Straight", []int{pokerCard(14, 0), pokerCard(2, 1), pokerCard(3, 2), pokerCard(4, 0), pokerCard(5, 3)}},
		{"Flush", []int{0, 2, 4, 7, 10}},
		{"Full house", []int{0, 13, 26, 1, 14}},
		{"Four of a kind", []int{0, 13, 26, 39, 1}},
		{"Straight flush", []int{0, 9, 10, 11, 12}},
	}
	var previous uint32
	for _, tc := range cases {
		score, name := PokerHandValue(tc.cards)
		if name != tc.name || score <= previous {
			t.Fatalf("%s => %s %d", tc.name, name, score)
		}
		previous = score
	}
	wheel, _ := PokerHandValue(cases[4].cards)
	six, _ := PokerHandValue([]int{1, 15, 29, 4, 18})
	if six <= wheel {
		t.Fatal("wheel must lose to six high")
	}
	best, name := PokerHandValue([]int{0, 13, 26, 1, 14, 27, 12})
	expected, _ := PokerHandValue([]int{0, 13, 26, 1, 14})
	if name != "Full house" || best != expected {
		t.Fatal("two trips must choose aces full of twos")
	}
	board := []int{0, 9, 10, 11, 12}
	a, _ := PokerHandValue(append(append([]int{}, board...), 14, 15))
	b, _ := PokerHandValue(append(append([]int{}, board...), 16, 17))
	if a != b {
		t.Fatal("playing the board should tie")
	}
	if score, _ := PokerHandValue([]int{0, 0, 1, 2, 3}); score != 0 {
		t.Fatal("duplicate cards accepted")
	}
}

func TestPokerMinimumPlayersBlindsAndPrivacy(t *testing.T) {
	if _, err := NewPokerRound("one", []PokerEntry{{"A", 0, 100}}, -1, time.Now()); err == nil {
		t.Fatal("solo poker started")
	}
	r := pokerTestRound(t, 100, 200)
	if r.Button != 0 || r.Turn != 0 || r.Players[0].StreetBet != 5 || r.Players[1].StreetBet != 10 {
		t.Fatal("heads-up button/small blind must act first")
	}
	v := r.View("A")
	if !reflect.DeepEqual(v.Players[0].Cards, r.Players[0].Cards) || !reflect.DeepEqual(v.Players[1].Cards, []int{-1, -1}) {
		t.Fatal("hole card privacy")
	}
	encoded, _ := json.Marshal(v)
	if strings.Contains(string(encoded), "deck") || strings.Contains(string(encoded), "burns") {
		t.Fatal("private deck in public view")
	}
	r = pokerMove(t, r, "call", 0)
	if r.Turn != 1 || r.Street != "preflop" {
		t.Fatal("big blind must retain option")
	}
	r = pokerMove(t, r, "check", 0)
	if r.Street != "flop" || r.Turn != 1 || len(r.Board) != 3 || len(r.Burns) != 1 {
		t.Fatal("heads-up big blind acts first after flop")
	}
	entries := []PokerEntry{{"A", 0, 100}, {"B", 2, 100}, {"C", 5, 100}}
	r, err := NewPokerRound("rotate", entries, 2, time.Now())
	if err != nil || r.Players[r.Button].Seat != 5 {
		t.Fatal("button must rotate to next funded seat", err)
	}
}

func TestPokerSidePotsAndUncalledGold(t *testing.T) {
	// Seat order deals B,C,A twice. Aces beat kings beat queens on this board.
	prefix := []int{pokerCard(13, 0), pokerCard(12, 0), pokerCard(14, 0), pokerCard(13, 1), pokerCard(12, 1), pokerCard(14, 1),
		pokerCard(3, 0), pokerCard(2, 0), pokerCard(4, 1), pokerCard(7, 2), pokerCard(5, 0), pokerCard(9, 3), pokerCard(6, 0), pokerCard(11, 2)}
	r, err := newPokerRound("side", []PokerEntry{{"A", 0, 100}, {"B", 1, 200}, {"C", 2, 300}}, -1, time.Unix(1000, 0), pokerTestDeck(prefix))
	if err != nil {
		t.Fatal(err)
	}
	r = pokerMove(t, r, "all_in", 0)
	r = pokerMove(t, r, "all_in", 0)
	r = pokerMove(t, r, "all_in", 0)
	if r.Phase != "complete" || !r.Showdown || len(r.Board) != 5 {
		t.Fatal("all-ins must run out board")
	}
	if r.Players[0].Payout != 300 || r.Players[1].Payout != 200 || r.Players[2].Payout != 100 {
		t.Fatalf("wrong pots: %+v", r.Players)
	}
	pots, _ := r.pots(true)
	if len(pots) != 3 || !pots[2].Uncalled || pots[2].Amount != 100 {
		t.Fatal("uncalled excess not returned")
	}
	data, _ := json.Marshal(r)
	var reopened PokerRound
	if json.Unmarshal(data, &reopened) != nil || reopened.Validate() != nil || !reflect.DeepEqual(reopened.View("A"), r.View("A")) {
		t.Fatal("saved hand did not reopen")
	}
	reopened.Players[0].Payout--
	reopened.Players[1].Payout++
	if reopened.Validate() == nil {
		t.Fatal("conserving Gold but changing winner must fail")
	}
}

func TestPokerTieOddChipAndFoldedPrivacy(t *testing.T) {
	// Royal flush on board. Small blind B folds five; A and C tie twenty-five.
	prefix := []int{14, 15, 16, 17, 18, 19, 20, 9, 10, 11, 21, 12, 22, 0}
	r, err := newPokerRound("tie", []PokerEntry{{"A", 0, 100}, {"B", 1, 100}, {"C", 2, 100}}, -1, time.Unix(1000, 0), pokerTestDeck(prefix))
	if err != nil {
		t.Fatal(err)
	}
	r = pokerMove(t, r, "call", 0)
	r = pokerMove(t, r, "fold", 0)
	r = pokerMove(t, r, "check", 0)
	for r.Phase == "playing" {
		r = pokerMove(t, r, "check", 0)
	}
	if r.Players[0].Payout != 102 || r.Players[1].Payout != 95 || r.Players[2].Payout != 103 {
		t.Fatalf("odd chip must go left of button: %+v", r.Players)
	}
	view := r.View("observer")
	if !reflect.DeepEqual(view.Players[1].Cards, []int{-1, -1}) || view.Players[1].Hand != "" || view.Players[0].Hand != "Straight flush" {
		t.Fatal("showdown leaked folded hand or hid live hand")
	}
}

func TestPokerShortAllInDoesNotReopenRaise(t *testing.T) {
	entries := []PokerEntry{{"A", 0, 500}, {"B", 1, 100}, {"C", 2, 200}, {"D", 3, 500}}
	r, err := newPokerRound("short", entries, 0, time.Unix(1000, 0), pokerTestDeck(nil))
	if err != nil {
		t.Fatal(err)
	}
	r = pokerMove(t, r, "raise", 80)
	r = pokerMove(t, r, "all_in", 0)
	r = pokerMove(t, r, "call", 0)
	r = pokerMove(t, r, "call", 0)
	if r.Players[r.Turn].PlayerID != "A" || r.CurrentBet != 100 || r.LastRaise != 70 {
		t.Fatal("incorrect short raise bookkeeping")
	}
	if _, err := r.Propose("A", "raise", 200, r.Revision, r.Deadline.Add(-time.Second)); err == nil {
		t.Fatal("short raise reopened betting")
	}
	if strings.Contains(strings.Join(r.View("A").Actions, ","), "raise") {
		t.Fatal("UI offers illegal raise")
	}
	r = pokerMove(t, r, "call", 0)
	if r.Street != "flop" {
		t.Fatal("short raise still must allow remaining call")
	}
}

func TestPokerTimeoutLeaveAndStaleActions(t *testing.T) {
	r := pokerTestRound(t, 100, 100)
	if _, err := r.Propose("B", "call", 0, r.Revision, r.Deadline.Add(-time.Second)); err == nil {
		t.Fatal("out of turn")
	}
	if _, err := r.Propose("A", "call", 0, r.Revision+1, r.Deadline.Add(-time.Second)); err == nil {
		t.Fatal("stale revision")
	}
	if _, err := r.Propose("A", "call", 0, r.Revision, r.Deadline); err == nil {
		t.Fatal("expired turn")
	}
	next, err := r.Timeout(r.Deadline)
	if err != nil || next.Validate() != nil || next.Phase != "complete" || next.Showdown || next.Players[0].Payout != 95 || next.Players[1].Payout != 105 {
		t.Fatal("timeout must fold without extra Gold", err)
	}
	if !reflect.DeepEqual(next.View("A").Players[1].Cards, []int{-1, -1}) {
		t.Fatal("uncontested winner hole cards exposed")
	}
	r = pokerTestRound(t, 100, 100, 100)
	next, changed := r.Withdraw("B", r.Deadline.Add(-time.Second))
	if !changed || next.Turn != r.Turn || next.Deadline != r.Deadline || next.Validate() != nil {
		t.Fatal("out-of-turn leave changed deadline")
	}
	r = pokerMove(t, pokerTestRound(t, 100, 100), "all_in", 0)
	if _, changed := r.Withdraw("A", r.Deadline.Add(-time.Second)); changed {
		t.Fatal("leaving must not forfeit an all-in entitlement")
	}
}

func TestPokerLegalPlayConservesGold(t *testing.T) {
	// Small deterministic rule walk, not an endurance run or a gameplay claim.
	rng := rand.New(rand.NewSource(19009))
	for hand := 0; hand < 100; hand++ {
		entries := []PokerEntry{}
		for seat := 0; seat < 2+hand%5; seat++ {
			entries = append(entries, PokerEntry{string(rune('A' + seat)), seat, 100 * (1 + rng.Intn(5))})
		}
		deck := rng.Perm(52)
		r, err := newPokerRound("walk", entries, hand%6, time.Unix(1000, 0), deck)
		if err != nil {
			t.Fatal(err)
		}
		for step := 0; r.Phase == "playing"; step++ {
			if step > 100 {
				t.Fatal("hand stalled")
			}
			v := r.View(r.Players[r.Turn].PlayerID)
			action := v.Actions[rng.Intn(len(v.Actions))]
			amount := 0
			if action == "raise" {
				amount = v.MinimumRaiseTo + rng.Intn(v.MaximumRaiseTo-v.MinimumRaiseTo+1)
			}
			r = pokerMove(t, r, action, amount)
		}
	}
}
