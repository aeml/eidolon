package game

import (
	"crypto/rand"
	"errors"
	"math/big"
	"sort"
	"time"
)

const BlackjackRulesVersion = "lanternhold-s17-v1"
const BlackjackTurnTime = 30 * time.Second
const BlackjackMaxBet = 100000

// This is the server's persistable round, never a network response. Call View
// to redact the shoe and the dealer's hole card. Currency acceptance/persistence
// must commit the returned proposal before acknowledging or publishing it.
type BlackjackRound struct {
	ID         string            `json:"id"`
	Rules      string            `json:"rules"`
	Revision   uint64            `json:"revision"`
	Phase      string            `json:"phase"`
	Players    []BlackjackPlayer `json:"players"`
	Dealer     []int             `json:"dealer"`
	Deck       []int             `json:"deck"`
	TurnPlayer int               `json:"turnPlayer"`
	TurnHand   int               `json:"turnHand"`
	Deadline   time.Time         `json:"deadline"`
}

type BlackjackPlayer struct {
	PlayerID string          `json:"playerId"`
	Seat     int             `json:"seat"`
	Hands    []BlackjackHand `json:"hands"`
}

type BlackjackHand struct {
	Cards   []int  `json:"cards"`
	Bet     int    `json:"bet"`
	Split   bool   `json:"split"`
	Done    bool   `json:"done"`
	Outcome string `json:"outcome,omitempty"`
	Payout  int    `json:"payout"` // Total returned, including any original stake.
}

type BlackjackEntry struct {
	PlayerID string
	Seat     int
	Bet      int
}

// Public floor opening stakes are deliberately bounded and even, so natural
// blackjack's 3:2 profit is always an integer. No client selects a currency.
func ValidBlackjackBet(bet int) bool { return bet >= 20 && bet <= BlackjackMaxBet && bet%20 == 0 }

func NewBlackjackRound(id string, entries []BlackjackEntry, now time.Time) (*BlackjackRound, error) {
	deck := make([]int, 6*52)
	for i := range deck {
		deck[i] = i % 52
	}
	for i := len(deck) - 1; i > 0; i-- {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return nil, err
		}
		j := int(n.Int64())
		deck[i], deck[j] = deck[j], deck[i]
	}
	return newBlackjackRound(id, entries, now, deck)
}

// Only same-package rule tests supply an ordered shoe; production always shuffles.
func newBlackjackRound(id string, entries []BlackjackEntry, now time.Time, deck []int) (*BlackjackRound, error) {
	if id == "" || len(entries) < 1 || len(entries) > 6 {
		return nil, errors.New("blackjack needs one to six funded players")
	}
	r := &BlackjackRound{ID: id, Rules: BlackjackRulesVersion, Revision: 1, Phase: "playing", Deck: append([]int(nil), deck...)}
	players, seats := map[string]bool{}, map[int]bool{}
	for _, entry := range entries {
		if entry.PlayerID == "" || players[entry.PlayerID] || entry.Seat < 0 || entry.Seat >= 6 || seats[entry.Seat] || !ValidBlackjackBet(entry.Bet) {
			return nil, errors.New("invalid or duplicate funded blackjack seat")
		}
		players[entry.PlayerID], seats[entry.Seat] = true, true
		r.Players = append(r.Players, BlackjackPlayer{PlayerID: entry.PlayerID, Seat: entry.Seat, Hands: []BlackjackHand{{Bet: entry.Bet}}})
	}
	sort.Slice(r.Players, func(i, j int) bool { return r.Players[i].Seat < r.Players[j].Seat })
	// Deal around the table, with the dealer last on each pass.
	for pass := 0; pass < 2; pass++ {
		for i := range r.Players {
			if err := r.draw(&r.Players[i].Hands[0].Cards); err != nil {
				return nil, err
			}
		}
		if err := r.draw(&r.Dealer); err != nil {
			return nil, err
		}
	}
	for i := range r.Players {
		h := &r.Players[i].Hands[0]
		h.Done = blackjackNatural(*h)
	}
	if total, _ := BlackjackTotal(r.Dealer); total == 21 {
		r.settle()
		return r, nil // Dealer peek prevents extra split/double wagers.
	}
	if err := r.advance(now); err != nil {
		return nil, err
	}
	return r, nil
}

func blackjackValue(card int) int {
	rank := card%13 + 1
	if rank > 10 {
		return 10
	}
	return rank
}

func BlackjackTotal(cards []int) (int, bool) {
	total, aces := 0, 0
	for _, card := range cards {
		value := blackjackValue(card)
		total += value
		if value == 1 {
			aces++
		}
	}
	if aces > 0 && total+10 <= 21 {
		return total + 10, true
	}
	return total, false
}

func blackjackNatural(h BlackjackHand) bool {
	total, _ := BlackjackTotal(h.Cards)
	return !h.Split && len(h.Cards) == 2 && total == 21
}

func (r *BlackjackRound) draw(cards *[]int) error {
	if len(r.Deck) == 0 || r.Deck[0] < 0 || r.Deck[0] >= 52 {
		return errors.New("invalid or exhausted blackjack shoe")
	}
	*cards = append(*cards, r.Deck[0])
	r.Deck = r.Deck[1:]
	return nil
}

func (r *BlackjackRound) clone() *BlackjackRound {
	next := *r
	next.Deck, next.Dealer = append([]int(nil), r.Deck...), append([]int(nil), r.Dealer...)
	next.Players = append([]BlackjackPlayer(nil), r.Players...)
	for i, player := range r.Players {
		next.Players[i].Hands = append([]BlackjackHand(nil), player.Hands...)
		for j, hand := range player.Hands {
			next.Players[i].Hands[j].Cards = append([]int(nil), hand.Cards...)
		}
	}
	return &next
}

// Propose returns an immutable candidate and the EXTRA debit required for a
// split/double. Rejected/failed funding must leave the original round unchanged.
// The caller serializes table operations and persists stake receipts + candidate.
func (r *BlackjackRound) Propose(playerID, action string, revision uint64, now time.Time) (*BlackjackRound, int, error) {
	if r.Phase != "playing" || revision != r.Revision {
		return nil, 0, errors.New("blackjack round changed; refresh the table")
	}
	if r.Players[r.TurnPlayer].PlayerID != playerID {
		return nil, 0, errors.New("wait for your blackjack turn")
	}
	if !now.Before(r.Deadline) {
		return nil, 0, errors.New("blackjack turn expired")
	}
	next := r.clone()
	player := &next.Players[next.TurnPlayer]
	hand := &player.Hands[next.TurnHand]
	extra := 0
	switch action {
	case "hit":
		if err := next.draw(&hand.Cards); err != nil {
			return nil, 0, err
		}
		if total, _ := BlackjackTotal(hand.Cards); total >= 21 {
			hand.Done = true
		}
	case "stand":
		hand.Done = true
	case "double":
		if len(hand.Cards) != 2 {
			return nil, 0, errors.New("double requires two cards")
		}
		extra = hand.Bet
		hand.Bet *= 2
		if err := next.draw(&hand.Cards); err != nil {
			return nil, 0, err
		}
		hand.Done = true
	case "split":
		if len(hand.Cards) != 2 || blackjackValue(hand.Cards[0]) != blackjackValue(hand.Cards[1]) || len(player.Hands) >= 4 {
			return nil, 0, errors.New("split requires a pair and fewer than four hands")
		}
		extra = hand.Bet
		left := BlackjackHand{Cards: []int{hand.Cards[0]}, Bet: hand.Bet, Split: true}
		right := BlackjackHand{Cards: []int{hand.Cards[1]}, Bet: hand.Bet, Split: true}
		if err := next.draw(&left.Cards); err != nil {
			return nil, 0, err
		}
		if err := next.draw(&right.Cards); err != nil {
			return nil, 0, err
		}
		for _, h := range []*BlackjackHand{&left, &right} {
			total, _ := BlackjackTotal(h.Cards)
			h.Done = blackjackValue(h.Cards[0]) == 1 || total == 21
		}
		hands := append([]BlackjackHand(nil), player.Hands[:next.TurnHand]...)
		hands = append(hands, left, right)
		player.Hands = append(hands, player.Hands[next.TurnHand+1:]...)
	default:
		return nil, 0, errors.New("unsupported blackjack action")
	}
	next.Revision++
	if err := next.advance(now); err != nil {
		return nil, 0, err
	}
	return next, extra, nil
}

// Timeout stands only the current hand, never plays a house-controlled opponent.
// Leave/disconnect does not erase wagers. The same deadline continues on resume.
func (r *BlackjackRound) Timeout(now time.Time) (*BlackjackRound, error) {
	if r.Phase != "playing" || now.Before(r.Deadline) {
		return nil, errors.New("no expired blackjack turn")
	}
	next := r.clone()
	next.Players[next.TurnPlayer].Hands[next.TurnHand].Done = true
	next.Revision++
	if err := next.advance(now); err != nil {
		return nil, err
	}
	return next, nil
}

func (r *BlackjackRound) advance(now time.Time) error {
	dealerNeeded := false
	for i, player := range r.Players {
		for j, hand := range player.Hands {
			if !hand.Done {
				r.TurnPlayer, r.TurnHand, r.Deadline = i, j, now.Add(BlackjackTurnTime)
				return nil
			}
			total, _ := BlackjackTotal(hand.Cards)
			if total <= 21 && !blackjackNatural(hand) {
				dealerNeeded = true
			}
		}
	}
	if !dealerNeeded {
		r.settle()
		return nil
	}
	for {
		total, _ := BlackjackTotal(r.Dealer)
		if total >= 17 {
			break
		} // Stand on soft as well as hard 17.
		if err := r.draw(&r.Dealer); err != nil {
			return err
		}
	}
	r.settle()
	return nil
}

func (r *BlackjackRound) settle() {
	dealer, _ := BlackjackTotal(r.Dealer)
	dealerNatural := len(r.Dealer) == 2 && dealer == 21
	for i := range r.Players {
		for j := range r.Players[i].Hands {
			h := &r.Players[i].Hands[j]
			total, _ := BlackjackTotal(h.Cards)
			h.Done, h.Payout, h.Outcome = true, 0, "lose"
			switch {
			case total > 21:
				h.Outcome = "bust"
			case blackjackNatural(*h) && !dealerNatural:
				h.Payout, h.Outcome = h.Bet*5/2, "blackjack"
			case dealerNatural && !blackjackNatural(*h):
			case dealer > 21 || total > dealer:
				h.Payout, h.Outcome = h.Bet*2, "win"
			case total == dealer:
				h.Payout, h.Outcome = h.Bet, "push"
			}
		}
	}
	r.Phase, r.Deadline, r.TurnPlayer, r.TurnHand = "complete", time.Time{}, -1, -1
}

type BlackjackView struct {
	ID           string            `json:"id"`
	Rules        string            `json:"rules"`
	Revision     uint64            `json:"revision"`
	Phase        string            `json:"phase"`
	Players      []BlackjackPlayer `json:"players"`
	Dealer       []int             `json:"dealer"`
	DealerHidden bool              `json:"dealerHidden"`
	TurnPlayerID string            `json:"turnPlayerId,omitempty"`
	TurnHand     int               `json:"turnHand"`
	Deadline     time.Time         `json:"deadline"`
	Actions      []string          `json:"actions"`
}

func (r *BlackjackRound) View(playerID string) BlackjackView {
	copy := r.clone()
	v := BlackjackView{ID: r.ID, Rules: r.Rules, Revision: r.Revision, Phase: r.Phase, Players: copy.Players,
		Dealer: copy.Dealer, TurnHand: r.TurnHand, Deadline: r.Deadline, Actions: []string{}}
	if r.Phase == "playing" {
		v.Dealer, v.DealerHidden = copy.Dealer[:1], true
		player := r.Players[r.TurnPlayer]
		v.TurnPlayerID = player.PlayerID
		if playerID == player.PlayerID {
			hand := player.Hands[r.TurnHand]
			v.Actions = []string{"hit", "stand"}
			if len(hand.Cards) == 2 {
				v.Actions = append(v.Actions, "double")
				if len(player.Hands) < 4 && blackjackValue(hand.Cards[0]) == blackjackValue(hand.Cards[1]) {
					v.Actions = append(v.Actions, "split")
				}
			}
		}
	}
	return v
}

// Validate persisted production shoes before resuming. A corrupt record must
// stop the table, not become an indexing panic or a different set of payouts.
func (r *BlackjackRound) Validate() error {
	bad := errors.New("invalid persisted blackjack round")
	if r == nil || r.ID == "" || r.Rules != BlackjackRulesVersion || r.Revision == 0 || len(r.Players) < 1 || len(r.Players) > 6 || len(r.Dealer) < 2 || len(r.Dealer) > 22 || len(r.Deck) > 312 {
		return bad
	}
	counts := [52]int{}
	count := func(cards []int) bool {
		for _, c := range cards {
			if c < 0 || c >= 52 {
				return false
			}
			counts[c]++
		}
		return true
	}
	if !count(r.Deck) || !count(r.Dealer) {
		return bad
	}
	ids, seats := map[string]bool{}, map[int]bool{}
	for _, p := range r.Players {
		if p.PlayerID == "" || ids[p.PlayerID] || p.Seat < 0 || p.Seat >= 6 || seats[p.Seat] || len(p.Hands) < 1 || len(p.Hands) > 4 {
			return bad
		}
		ids[p.PlayerID], seats[p.Seat] = true, true
		for _, h := range p.Hands {
			if len(h.Cards) < 2 || len(h.Cards) > 22 || !count(h.Cards) || h.Bet < 20 || h.Bet > BlackjackMaxBet*2 || h.Bet%20 != 0 || h.Payout < 0 || h.Payout > BlackjackMaxBet*4 {
				return bad
			}
		}
	}
	for _, n := range counts {
		if n != 6 {
			return bad
		}
	}
	switch r.Phase {
	case "playing":
		if r.TurnPlayer < 0 || r.TurnPlayer >= len(r.Players) || r.TurnHand < 0 || r.TurnHand >= len(r.Players[r.TurnPlayer].Hands) || r.Players[r.TurnPlayer].Hands[r.TurnHand].Done || r.Deadline.IsZero() {
			return bad
		}
		for _, p := range r.Players {
			for _, h := range p.Hands {
				if h.Payout != 0 || h.Outcome != "" {
					return bad
				}
			}
		}
	case "complete":
		if !r.Deadline.IsZero() || r.TurnPlayer != -1 || r.TurnHand != -1 {
			return bad
		}
		resolved := r.clone()
		resolved.settle()
		for i, p := range r.Players {
			for j, h := range p.Hands {
				expected := resolved.Players[i].Hands[j]
				if !h.Done || h.Payout != expected.Payout || h.Outcome != expected.Outcome {
					return bad
				}
			}
		}
	default:
		return bad
	}
	return nil
}
