package game

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"sort"
	"time"
)

const PokerRulesVersion = "fourfold-holdem-5-10-v1"
const PokerTurnTime = 30 * time.Second
const PokerSmallBlind = 5
const PokerBigBlind = 10
const PokerMaxBuyIn = 100000

// Each hand escrows 100–100,000 normal Gold per consenting real player. All remaining
// stack and winnings cash out after that hand; there is no rake or house player.
func ValidPokerBuyIn(amount int) bool {
	return amount >= 100 && amount <= PokerMaxBuyIn && amount%100 == 0
}

type PokerEntry struct {
	PlayerID string
	Seat     int
	BuyIn    int
}

type PokerPlayer struct {
	PlayerID  string `json:"playerId"`
	Seat      int    `json:"seat"`
	BuyIn     int    `json:"buyIn"`
	Stack     int    `json:"stack"`
	Committed int    `json:"committed"`
	StreetBet int    `json:"streetBet"`
	Cards     []int  `json:"cards"`
	Folded    bool   `json:"folded"`
	Acted     bool   `json:"acted"`
	ReopenAt  int    `json:"reopenAt"`
	Payout    int    `json:"payout"`
}

// Private persistent round. Never marshal this to a client: View redacts deck,
// burns and other players' hole cards, including folded cards at showdown.
type PokerRound struct {
	ID         string        `json:"id"`
	Rules      string        `json:"rules"`
	Revision   uint64        `json:"revision"`
	Phase      string        `json:"phase"`
	Street     string        `json:"street"`
	Players    []PokerPlayer `json:"players"`
	Board      []int         `json:"board"`
	Burns      []int         `json:"burns"`
	Deck       []int         `json:"deck"`
	Button     int           `json:"button"` // Index in seat-sorted Players.
	Turn       int           `json:"turn"`
	CurrentBet int           `json:"currentBet"`
	LastRaise  int           `json:"lastRaise"`
	Deadline   time.Time     `json:"deadline"`
	Showdown   bool          `json:"showdown"`
}

func NewPokerRound(id string, entries []PokerEntry, previousButtonSeat int, now time.Time) (*PokerRound, error) {
	deck := make([]int, 52)
	for i := range deck {
		deck[i] = i
	}
	for i := len(deck) - 1; i > 0; i-- {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return nil, err
		}
		j := int(n.Int64())
		deck[i], deck[j] = deck[j], deck[i]
	}
	return newPokerRound(id, entries, previousButtonSeat, now, deck)
}

func newPokerRound(id string, entries []PokerEntry, previousButtonSeat int, now time.Time, deck []int) (*PokerRound, error) {
	if id == "" || len(entries) < 2 || len(entries) > 6 || previousButtonSeat < -1 || previousButtonSeat > 5 {
		return nil, errors.New("poker requires two to six real funded players")
	}
	if len(deck) != 52 {
		return nil, errors.New("poker requires a complete deck")
	}
	seenCards := map[int]bool{}
	for _, card := range deck {
		if card < 0 || card >= 52 || seenCards[card] {
			return nil, errors.New("invalid poker deck")
		}
		seenCards[card] = true
	}
	r := &PokerRound{ID: id, Rules: PokerRulesVersion, Revision: 1, Phase: "playing", Street: "preflop", Deck: append([]int(nil), deck...), LastRaise: PokerBigBlind, CurrentBet: PokerBigBlind}
	players, seats := map[string]bool{}, map[int]bool{}
	for _, e := range entries {
		if e.PlayerID == "" || players[e.PlayerID] || e.Seat < 0 || e.Seat > 5 || seats[e.Seat] || !ValidPokerBuyIn(e.BuyIn) {
			return nil, errors.New("invalid funded poker seat")
		}
		players[e.PlayerID], seats[e.Seat] = true, true
		r.Players = append(r.Players, PokerPlayer{PlayerID: e.PlayerID, Seat: e.Seat, BuyIn: e.BuyIn, Stack: e.BuyIn})
	}
	sort.Slice(r.Players, func(i, j int) bool { return r.Players[i].Seat < r.Players[j].Seat })
	for i, p := range r.Players {
		if p.Seat > previousButtonSeat {
			r.Button = i
			break
		}
	}
	n := len(r.Players)
	for pass := 0; pass < 2; pass++ {
		for offset := 1; offset <= n; offset++ {
			i := (r.Button + offset) % n
			r.Players[i].Cards = append(r.Players[i].Cards, r.takeCard())
		}
	}
	small := (r.Button + 1) % n
	if n == 2 {
		small = r.Button
	}
	big := (small + 1) % n
	r.commit(small, PokerSmallBlind)
	r.commit(big, PokerBigBlind)
	r.advance(big, now)
	return r, nil
}

func (r *PokerRound) takeCard() int { card := r.Deck[0]; r.Deck = r.Deck[1:]; return card }
func (r *PokerRound) commit(index, amount int) {
	p := &r.Players[index]
	p.Stack -= amount
	p.Committed += amount
	p.StreetBet += amount
}
func (r *PokerRound) clone() *PokerRound {
	next := *r
	next.Board, next.Burns, next.Deck = append([]int(nil), r.Board...), append([]int(nil), r.Burns...), append([]int(nil), r.Deck...)
	next.Players = append([]PokerPlayer(nil), r.Players...)
	for i := range next.Players {
		next.Players[i].Cards = append([]int(nil), r.Players[i].Cards...)
	}
	return &next
}

// amount is the TOTAL contribution on the current street for raise, never a
// wallet debit. All wagering stays inside the already-funded table stack.
func (r *PokerRound) Propose(playerID, action string, amount int, revision uint64, now time.Time) (*PokerRound, error) {
	if r.Phase != "playing" || r.Revision != revision {
		return nil, errors.New("poker hand changed; refresh the table")
	}
	if r.Players[r.Turn].PlayerID != playerID {
		return nil, errors.New("wait for your poker turn")
	}
	if !now.Before(r.Deadline) {
		return nil, errors.New("poker turn expired")
	}
	next := r.clone()
	if err := next.act(action, amount); err != nil {
		return nil, err
	}
	next.Revision++
	next.advance(r.Turn, now)
	return next, nil
}

func (r *PokerRound) act(action string, amount int) error {
	p := &r.Players[r.Turn]
	owed := max(0, r.CurrentBet-p.StreetBet)
	switch action {
	case "fold":
		p.Folded = true
	case "check":
		if owed != 0 {
			return errors.New("call or fold; a bet is outstanding")
		}
	case "call":
		if owed == 0 {
			return errors.New("nothing to call; check instead")
		}
		r.commit(r.Turn, min(p.Stack, owed))
	case "raise", "all_in":
		if action == "all_in" {
			amount = p.StreetBet + p.Stack
		}
		if amount <= r.CurrentBet {
			if action != "all_in" || owed == 0 {
				return errors.New("a raise must exceed the current bet")
			}
			r.commit(r.Turn, p.Stack) // A short all-in call never reopens betting.
			break
		}
		if p.Acted && r.CurrentBet < p.ReopenAt {
			return errors.New("a short all-in has not reopened your raise")
		}
		if amount > p.StreetBet+p.Stack || amount < 0 {
			return errors.New("raise exceeds your table stack")
		}
		raise := amount - r.CurrentBet
		if raise < r.LastRaise && amount != p.StreetBet+p.Stack {
			return errors.New("raise must meet the minimum or use your entire stack")
		}
		r.commit(r.Turn, amount-p.StreetBet)
		r.CurrentBet = amount
		if raise >= r.LastRaise {
			r.LastRaise = raise
		}
	default:
		return errors.New("unsupported poker action")
	}
	p.Acted, p.ReopenAt = true, r.CurrentBet+r.LastRaise
	if r.CurrentBet == 0 {
		p.ReopenAt = 1
	} // Any opening bet reopens a previous check.
	return nil
}

// A missing/disconnected player is never replaced by a house opponent. The
// timer checks for free or folds when facing a bet; it never adds their Gold.
func (r *PokerRound) Timeout(now time.Time) (*PokerRound, error) {
	if r.Phase != "playing" || now.Before(r.Deadline) {
		return nil, errors.New("poker timer has not expired")
	}
	next := r.clone()
	action := "check"
	if next.Players[next.Turn].StreetBet < next.CurrentBet {
		action = "fold"
	}
	if err := next.act(action, 0); err != nil {
		return nil, err
	}
	next.Revision++
	next.advance(r.Turn, now)
	return next, nil
}

// Leaving folds a live stack even out of turn. An all-in hand must retain its
// eligibility; there is no way to undo committed chips by leaving or relogging.
func (r *PokerRound) Withdraw(playerID string, now time.Time) (*PokerRound, bool) {
	if r.Phase != "playing" {
		return r, false
	}
	for i, p := range r.Players {
		if p.PlayerID != playerID || p.Folded || p.Stack == 0 {
			continue
		}
		next := r.clone()
		next.Players[i].Folded = true
		next.Revision++
		// Preserve the current player's turn when someone else leaves.
		previous := (r.Turn + len(r.Players) - 1) % len(r.Players)
		next.advance(previous, now)
		if next.Phase == "playing" && next.Turn == r.Turn {
			next.Deadline = r.Deadline
		}
		return next, true
	}
	return r, false
}

func (r *PokerRound) advance(previous int, now time.Time) {
	for {
		alive, active := 0, 0
		for _, p := range r.Players {
			if !p.Folded {
				alive++
				if p.Stack > 0 {
					active++
				}
			}
		}
		if alive <= 1 {
			r.finish(false)
			return
		}
		// With one stack against all-ins there is only a call/fold decision if
		// that stack still owes money. No betting into an uncontested side pot.
		for offset := 1; offset <= len(r.Players); offset++ {
			i := (previous + offset) % len(r.Players)
			p := r.Players[i]
			needsAction := !p.Acted || p.StreetBet < r.CurrentBet
			if active <= 1 {
				needsAction = p.StreetBet < r.CurrentBet
			}
			if !p.Folded && p.Stack > 0 && needsAction {
				r.Turn, r.Deadline = i, now.Add(PokerTurnTime)
				return
			}
		}
		if r.Street == "river" {
			r.finish(true)
			return
		}
		r.Burns = append(r.Burns, r.takeCard())
		count := 1
		switch r.Street {
		case "preflop":
			r.Street, count = "flop", 3
		case "flop":
			r.Street = "turn"
		case "turn":
			r.Street = "river"
		}
		for i := 0; i < count; i++ {
			r.Board = append(r.Board, r.takeCard())
		}
		r.CurrentBet, r.LastRaise = 0, PokerBigBlind
		for i := range r.Players {
			r.Players[i].StreetBet, r.Players[i].Acted, r.Players[i].ReopenAt = 0, false, 0
		}
		previous = r.Button
	}
}

type PokerPot struct {
	Amount   int      `json:"amount"`
	Eligible []string `json:"eligible"`
	Winners  []string `json:"winners,omitempty"`
	Uncalled bool     `json:"uncalled,omitempty"`
}

// Side pots are derived from committed chips, never supplied by a client. Odd
// chips in ties go clockwise starting left of the dealer button.
func (r *PokerRound) pots(settle bool) ([]PokerPot, map[string]int) {
	levels := []int{}
	for _, p := range r.Players {
		if p.Committed > 0 {
			levels = append(levels, p.Committed)
		}
	}
	sort.Ints(levels)
	pots, payouts := []PokerPot{}, map[string]int{}
	previous := 0
	for _, level := range levels {
		if level == previous {
			continue
		}
		contributors, eligible := []int{}, []int{}
		for offset := 1; offset <= len(r.Players); offset++ {
			i := (r.Button + offset) % len(r.Players)
			p := r.Players[i]
			if p.Committed >= level {
				contributors = append(contributors, i)
				if !p.Folded {
					eligible = append(eligible, i)
				}
			}
		}
		pot := PokerPot{Amount: (level - previous) * len(contributors), Eligible: []string{}}
		previous = level
		if len(contributors) == 1 {
			eligible, pot.Uncalled = contributors, true
		}
		for _, i := range eligible {
			pot.Eligible = append(pot.Eligible, r.Players[i].PlayerID)
		}
		if settle && len(eligible) > 0 {
			best := uint32(0)
			winners := []int{}
			for _, i := range eligible {
				score := uint32(0)
				if r.Showdown && !pot.Uncalled {
					score, _ = PokerHandValue(append(append([]int(nil), r.Players[i].Cards...), r.Board...))
				}
				if len(winners) == 0 || score > best {
					best, winners = score, []int{i}
				} else if score == best {
					winners = append(winners, i)
				}
			}
			for j, i := range winners {
				id := r.Players[i].PlayerID
				payouts[id] += pot.Amount / len(winners)
				if j < pot.Amount%len(winners) {
					payouts[id]++
				}
				pot.Winners = append(pot.Winners, id)
			}
		}
		pots = append(pots, pot)
	}
	return pots, payouts
}

func (r *PokerRound) finish(showdown bool) {
	r.Phase, r.Showdown, r.Turn, r.Deadline = "complete", showdown, -1, time.Time{}
	_, winnings := r.pots(true)
	for i := range r.Players {
		r.Players[i].Payout = r.Players[i].Stack + winnings[r.Players[i].PlayerID]
	}
}

// Card IDs match existing casino cards: suit=floor(card/13), rank=card%13+1,
// ace high except A2345. Scores compare lexicographically category then kickers.
func PokerHandValue(cards []int) (uint32, string) {
	if len(cards) < 5 || len(cards) > 7 {
		return 0, ""
	}
	seen := map[int]bool{}
	for _, c := range cards {
		if c < 0 || c >= 52 || seen[c] {
			return 0, ""
		}
		seen[c] = true
	}
	best := uint32(0)
	for a := 0; a < len(cards)-4; a++ {
		for b := a + 1; b < len(cards)-3; b++ {
			for c := b + 1; c < len(cards)-2; c++ {
				for d := c + 1; d < len(cards)-1; d++ {
					for e := d + 1; e < len(cards); e++ {
						best = max(best, pokerFive([5]int{cards[a], cards[b], cards[c], cards[d], cards[e]}))
					}
				}
			}
		}
	}
	names := []string{"High card", "One pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"}
	return best, names[best>>20]
}

func pokerFive(cards [5]int) uint32 {
	counts := [15]int{}
	flush := true
	for _, c := range cards {
		rank := c%13 + 1
		if rank == 1 {
			rank = 14
		}
		counts[rank]++
		flush = flush && c/13 == cards[0]/13
	}
	ranks := []int{}
	for rank := 14; rank >= 2; rank-- {
		if counts[rank] > 0 {
			ranks = append(ranks, rank)
		}
	}
	straight := 0
	if len(ranks) == 5 {
		if ranks[0]-ranks[4] == 4 {
			straight = ranks[0]
		} else if ranks[0] == 14 && ranks[1] == 5 && ranks[4] == 2 {
			straight = 5
		}
	}
	encode := func(category int, kickers []int) uint32 {
		score := uint32(category) << 20
		for i, rank := range kickers {
			if i < 5 {
				score |= uint32(rank) << uint(16-4*i)
			}
		}
		return score
	}
	if flush && straight > 0 {
		return encode(8, []int{straight})
	}
	sort.Slice(ranks, func(i, j int) bool {
		if counts[ranks[i]] != counts[ranks[j]] {
			return counts[ranks[i]] > counts[ranks[j]]
		}
		return ranks[i] > ranks[j]
	})
	if counts[ranks[0]] == 4 {
		return encode(7, ranks)
	}
	if counts[ranks[0]] == 3 && counts[ranks[1]] == 2 {
		return encode(6, ranks)
	}
	if flush {
		return encode(5, ranks)
	}
	if straight > 0 {
		return encode(4, []int{straight})
	}
	if counts[ranks[0]] == 3 {
		return encode(3, ranks)
	}
	if counts[ranks[0]] == 2 {
		if counts[ranks[1]] == 2 {
			return encode(2, ranks)
		}
		return encode(1, ranks)
	}
	return encode(0, ranks)
}

// Describes only cards already visible to the recipient. Uses the authoritative
// evaluator's category/kickers; it never evaluates an opponent's hidden cards.
func PokerHandDescription(cards []int) string {
	names := []string{"", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King", "Ace"}
	if len(cards) == 2 {
		if cards[0] < 0 || cards[0] >= 52 || cards[1] < 0 || cards[1] >= 52 || cards[0] == cards[1] {
			return ""
		}
		a, b := cards[0]%13+1, cards[1]%13+1
		if a == 1 {
			a = 14
		}
		if b == 1 {
			b = 14
		}
		if a == b {
			return fmt.Sprintf("Pair of %ss", names[a])
		}
		return names[max(a, b)] + " high"
	}
	score, category := PokerHandValue(cards)
	if category == "" {
		return ""
	}
	a, b := names[(score>>16)&15], names[(score>>12)&15]
	switch score >> 20 {
	case 0:
		return a + " high"
	case 1:
		return fmt.Sprintf("Pair of %ss", a)
	case 2:
		return fmt.Sprintf("Two pair — %ss and %ss", a, b)
	case 3:
		return fmt.Sprintf("Three of a kind — %ss", a)
	case 6:
		return fmt.Sprintf("Full house — %ss full of %ss", a, b)
	case 7:
		return fmt.Sprintf("Four of a kind — %ss", a)
	default:
		return category + " — " + a + " high"
	}
}

type PokerPlayerView struct {
	PlayerID  string `json:"playerId"`
	Seat      int    `json:"seat"`
	Stack     int    `json:"stack"`
	Committed int    `json:"committed"`
	StreetBet int    `json:"streetBet"`
	Cards     []int  `json:"cards"`
	Folded    bool   `json:"folded"`
	Payout    int    `json:"payout"`
	Hand      string `json:"hand,omitempty"`
	BestHand  string `json:"bestHand,omitempty"`
}
type PokerView struct {
	Showdown       bool              `json:"showdown"`
	ID             string            `json:"id"`
	Rules          string            `json:"rules"`
	Revision       uint64            `json:"revision"`
	Phase          string            `json:"phase"`
	Street         string            `json:"street"`
	Board          []int             `json:"board"`
	Players        []PokerPlayerView `json:"players"`
	Pots           []PokerPot        `json:"pots"`
	ButtonSeat     int               `json:"buttonSeat"`
	TurnPlayerID   string            `json:"turnPlayerId"`
	Deadline       time.Time         `json:"deadline"`
	Actions        []string          `json:"actions"`
	CallAmount     int               `json:"callAmount"`
	MinimumRaiseTo int               `json:"minimumRaiseTo"`
	MaximumRaiseTo int               `json:"maximumRaiseTo"`
}

func (r *PokerRound) View(playerID string) PokerView {
	v := PokerView{ID: r.ID, Rules: r.Rules, Revision: r.Revision, Phase: r.Phase, Street: r.Street, Board: append([]int{}, r.Board...), ButtonSeat: r.Players[r.Button].Seat, Deadline: r.Deadline, Actions: []string{}, Players: []PokerPlayerView{}}
	v.Showdown = r.Showdown
	v.Pots, _ = r.pots(r.Phase == "complete")
	for _, p := range r.Players {
		pv := PokerPlayerView{PlayerID: p.PlayerID, Seat: p.Seat, Stack: p.Stack, Committed: p.Committed, StreetBet: p.StreetBet, Folded: p.Folded, Payout: p.Payout, Cards: []int{-1, -1}}
		if p.PlayerID == playerID || (r.Showdown && !p.Folded) {
			pv.Cards = append([]int(nil), p.Cards...)
			pv.BestHand = PokerHandDescription(append(append([]int(nil), p.Cards...), r.Board...))
		}
		if r.Showdown && !p.Folded {
			_, pv.Hand = PokerHandValue(append(append([]int(nil), p.Cards...), r.Board...))
		}
		v.Players = append(v.Players, pv)
	}
	if r.Phase == "playing" {
		p := r.Players[r.Turn]
		v.TurnPlayerID = p.PlayerID
		if playerID == p.PlayerID {
			v.Actions = append(v.Actions, "fold")
			v.CallAmount = min(p.Stack, max(0, r.CurrentBet-p.StreetBet))
			if v.CallAmount == 0 {
				v.Actions = append(v.Actions, "check")
			} else {
				v.Actions = append(v.Actions, "call")
			}
			v.MinimumRaiseTo, v.MaximumRaiseTo = r.CurrentBet+r.LastRaise, p.StreetBet+p.Stack
			canRaise := !p.Acted || r.CurrentBet >= p.ReopenAt
			if canRaise && v.MaximumRaiseTo >= v.MinimumRaiseTo {
				v.Actions = append(v.Actions, "raise")
			}
			if v.MaximumRaiseTo <= r.CurrentBet || canRaise {
				v.Actions = append(v.Actions, "all_in")
			}
		}
	}
	return v
}

func (r *PokerRound) Validate() error {
	bad := func() error { return errors.New("invalid saved poker round") }
	if r.ID == "" || r.Rules != PokerRulesVersion || r.Revision == 0 || len(r.Players) < 2 || len(r.Players) > 6 || r.Button < 0 || r.Button >= len(r.Players) || r.CurrentBet < 0 || r.CurrentBet > PokerMaxBuyIn || r.LastRaise < 10 || r.LastRaise > PokerMaxBuyIn {
		return bad()
	}
	expectedBoard, ok := map[string]int{"preflop": 0, "flop": 3, "turn": 4, "river": 5}[r.Street]
	if !ok || len(r.Board) != expectedBoard || len(r.Burns) != max(0, expectedBoard-2) {
		return bad()
	}
	all := append(append(append([]int{}, r.Board...), r.Burns...), r.Deck...)
	ids := map[string]bool{}
	totalBuyIn, totalPayout, alive := 0, 0, 0
	lastSeat := -1
	for _, p := range r.Players {
		if p.PlayerID == "" || ids[p.PlayerID] || p.Seat <= lastSeat || p.Seat > 5 || !ValidPokerBuyIn(p.BuyIn) || p.Stack < 0 || p.Committed < 0 || p.Stack+p.Committed != p.BuyIn || p.StreetBet < 0 || p.StreetBet > p.Committed || p.StreetBet > r.CurrentBet || p.ReopenAt < 0 || p.ReopenAt > PokerMaxBuyIn*2 || p.Payout < 0 || p.Payout > PokerMaxBuyIn*6 || len(p.Cards) != 2 {
			return bad()
		}
		ids[p.PlayerID], lastSeat = true, p.Seat
		all = append(all, p.Cards...)
		totalBuyIn += p.BuyIn
		totalPayout += p.Payout
		if !p.Folded {
			alive++
		}
	}
	seen := map[int]bool{}
	if len(all) != 52 || alive == 0 {
		return bad()
	}
	for _, card := range all {
		if card < 0 || card >= 52 || seen[card] {
			return bad()
		}
		seen[card] = true
	}
	if r.Phase == "playing" {
		if r.Showdown || r.Turn < 0 || r.Turn >= len(r.Players) || r.Deadline.IsZero() || totalPayout != 0 || alive < 2 {
			return bad()
		}
		p := r.Players[r.Turn]
		if p.Folded || p.Stack == 0 || (p.Acted && p.StreetBet >= r.CurrentBet) {
			return bad()
		}
	} else if r.Phase == "complete" {
		if r.Turn != -1 || !r.Deadline.IsZero() || totalPayout != totalBuyIn || (r.Showdown && len(r.Board) != 5) || (!r.Showdown && alive != 1) {
			return bad()
		}
		pots, wins := r.pots(true)
		for _, pot := range pots {
			if len(pot.Winners) == 0 {
				return bad()
			}
		}
		for _, p := range r.Players {
			if p.Payout != p.Stack+wins[p.PlayerID] {
				return bad()
			}
		}
	} else {
		return bad()
	}
	return nil
}
