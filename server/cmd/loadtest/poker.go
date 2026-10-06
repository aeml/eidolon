package main

import (
	"time"

	"eidolon-server/internal/game"
)

// Only public turn/settlement fields: no names, hole cards, deck or hand history.
type pokerLoadView struct {
	TableID, TableVersion    string
	Currency, RoundID, Phase string
	DealAt                   time.Time `json:"dealAt"`
	Balance                  int
	Available, Processing    bool
	Players                  []struct {
		PlayerID    string `json:"playerId"`
		Seat, BuyIn int
		Paid        bool
	}
	Round *struct {
		ID, Phase, Street string
		Revision          uint64
		TurnPlayerID      string `json:"turnPlayerId"`
		Actions           []string
		Players           []struct {
			PlayerID               string `json:"playerId"`
			Seat, Stack, Committed int
			Payout                 *int
		}
	}
}

type pokerLoad struct {
	playerID, pendingRound, fundedRound, fundedSession, lastCompleted string
	pendingStreet                                                     string
	pendingBuyIn, pendingStack, pendingCommitted                      int
	wagers, rounds, actions                                           uint64
	lastDecisionRound                                                 string
	lastDecisionRevision                                              uint64
}

// Read polling has a three-second cadence, but a fresh legal own turn should
// not inherit that artificial delay. Never bypass a pending decision or reuse
// a previously requested revision; server acceptance and paid results remain
// separate observations.
func (p *pokerLoad) canAct(b *casinoLoad) bool {
	v := b.view.Poker
	if b.pending != "" || v == nil || !v.Available || v.Processing || v.Currency != "gold" ||
		v.Phase != "playing" || v.RoundID != p.fundedRound || b.view.YourSeat == nil ||
		b.view.YourSeat.SessionID != p.fundedSession || v.Round == nil || v.Round.ID != v.RoundID ||
		v.Round.Phase != "playing" || v.Round.TurnPlayerID != p.playerID || v.Round.Revision == 0 ||
		(v.RoundID == p.lastDecisionRound && v.Round.Revision <= p.lastDecisionRevision) {
		return false
	}
	for _, player := range v.Round.Players {
		if player.PlayerID == p.playerID && player.Seat == b.seat && player.Stack >= 0 && player.Committed >= 0 {
			for _, action := range v.Round.Actions {
				if action == "check" || action == "call" {
					return true
				}
			}
		}
	}
	return false
}

func validPokerClientCount(n int) bool {
	return n >= 2 && n <= 24 && n%6 != 1 // Never strand one bot at a separate table.
}

func newPokerLoad(index int, playerID string) *casinoLoad {
	if index < 0 || playerID == "" {
		return &casinoLoad{failed: true}
	}
	for _, table := range game.CasinoTables() {
		if table.Game != "poker" || table.Floor != "public" || table.Currency != "gold" {
			continue
		}
		if index < len(table.Seats) {
			return &casinoLoad{table: table, seat: index, changed: make(chan struct{}, 1), poker: &pokerLoad{playerID: playerID}}
		}
		index -= len(table.Seats)
	}
	return &casinoLoad{failed: true}
}

// Caller holds casinoLoad.mu. A peer's payment is never this player's cash-out.
func (p *pokerLoad) receive(b *casinoLoad) {
	v := b.view.Poker
	if v == nil || !v.Available || v.Processing {
		return
	}
	if v.Currency != "gold" || v.Balance < 0 || len(v.RoundID) != 32 || len(v.Players) > 6 {
		b.failed = true
		return
	}
	switch v.Phase {
	case "betting", "playing", "settling", "complete":
	default:
		b.failed = true
		return
	}
	if p.fundedRound != "" && b.view.YourSeat != nil && b.view.YourSeat.SessionID != p.fundedSession {
		b.failed = true
		return
	}
	if b.pending == "poker_buy_in" || b.pending == "poker_play" {
		if b.view.YourSeat == nil || b.view.YourSeat.SessionID != b.pendingSession || v.RoundID != p.pendingRound {
			b.failed = true
			return
		}
	}
	paid := false
	for _, participant := range v.Players {
		if participant.PlayerID != p.playerID || participant.Seat != b.seat {
			continue
		}
		paid = participant.Paid
		if b.pending == "poker_buy_in" {
			if participant.BuyIn != p.pendingBuyIn {
				b.failed = true
				return
			}
			p.fundedRound, p.fundedSession = v.RoundID, b.pendingSession
			p.wagers++
			b.pending = ""
		}
	}
	if v.Round == nil {
		return // Includes a lone funded lobby: no dealt hand, no completion.
	}
	if v.Round.ID != v.RoundID || len(v.Round.Players) < 2 || len(v.Round.Players) > 6 {
		b.failed = true
		return
	}
	for _, player := range v.Round.Players {
		if player.PlayerID != p.playerID || player.Seat != b.seat {
			continue
		}
		if player.Stack < 0 || player.Committed < 0 {
			b.failed = true
			return
		}
		if b.pending == "poker_play" && v.Round.Revision > b.pendingRevision &&
			(v.Round.TurnPlayerID != p.playerID || v.Round.Street != p.pendingStreet ||
				player.Stack != p.pendingStack || player.Committed != p.pendingCommitted) {
			b.pending = ""
			p.actions++ // Observed progress, not causal proof: timeout may also check.
		}
		if v.Phase != "complete" || v.Round.Phase != "complete" || !paid || v.RoundID != p.fundedRound || v.RoundID == p.lastCompleted {
			return
		}
		if player.Payout == nil || *player.Payout < 0 {
			b.failed = true
			return
		}
		p.rounds++
		p.lastCompleted = v.RoundID
	}
}

func (p *pokerLoad) step(b *casinoLoad, now time.Time, buyIn int, request func(map[string]interface{}) error, issue func(string, map[string]interface{})) {
	v := b.view.Poker
	if v == nil || !v.Available || v.Processing {
		if request(map[string]interface{}{"action": "get"}) != nil {
			b.failed = true
		}
		b.nextAction = now.Add(3 * time.Second)
		return
	}
	if v.Currency != "gold" || len(v.RoundID) != 32 {
		b.failed = true
		return
	}
	if v.Phase == "betting" {
		if !casinoWagerWindowOpen(v.DealAt, now) {
			return
		}
		for _, participant := range v.Players {
			if participant.PlayerID == p.playerID {
				return
			}
		}
		if !game.ValidPokerBuyIn(buyIn) || v.Balance < buyIn {
			b.failed = true
			return
		}
		p.pendingRound, p.pendingBuyIn = v.RoundID, buyIn
		b.pendingSession = b.view.YourSeat.SessionID
		issue("poker_buy_in", map[string]interface{}{"sessionId": b.pendingSession, "roundId": v.RoundID, "bet": buyIn})
		return
	}
	if !p.canAct(b) {
		return
	}
	for _, choice := range []string{"check", "call"} {
		for _, action := range v.Round.Actions {
			if action != choice {
				continue
			}
			for _, player := range v.Round.Players {
				if player.PlayerID != p.playerID || player.Seat != b.seat {
					continue
				}
				p.pendingRound, p.pendingStreet = v.RoundID, v.Round.Street
				p.pendingStack, p.pendingCommitted = player.Stack, player.Committed
				b.pendingSession, b.pendingRevision = b.view.YourSeat.SessionID, v.Round.Revision
				issue("poker_play", map[string]interface{}{"sessionId": b.pendingSession, "roundId": v.RoundID, "roundRevision": v.Round.Revision, "gameAction": choice, "bet": 0})
				if !b.failed && b.pending == "poker_play" {
					p.lastDecisionRound, p.lastDecisionRevision = v.RoundID, v.Round.Revision
				}
				return
			}
		}
	}
}
