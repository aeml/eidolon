package main

import (
	"eidolon-server/internal/game"
	"time"
)

type blackjackLoadView struct {
	TableID, TableVersion string
	Currency              string `json:"currency"`
	Balance               int    `json:"balance"`
	Available, Processing bool
	RoundID, Phase        string
	DealAt                time.Time `json:"dealAt"`
	Players               []struct {
		PlayerID  string `json:"playerId"`
		Seat, Bet int
		Paid      bool
	} `json:"players"`
	Round *struct {
		ID, Phase    string
		Revision     uint64
		Deadline     time.Time `json:"deadline"`
		TurnPlayerID string    `json:"turnPlayerId"`
		TurnHand     int       `json:"turnHand"`
		Actions      []string
		Players      []struct {
			PlayerID string `json:"playerId"`
			Seat     int
			Hands    []struct {
				Done    bool
				Outcome string
				Payout  *int
			}
		}
	}
}

// One current hand/operation only; no history map, names, deck or private cards.
type blackjackLoad struct {
	playerID, pendingRound, fundedRound, fundedSession, lastCompleted string
	pendingBet, pendingHand                                           int
	wagers, rounds, actions                                           uint64
}

func newBlackjackLoad(index int, playerID string) *casinoLoad {
	if index < 0 || playerID == "" {
		return &casinoLoad{failed: true}
	}
	for _, table := range game.CasinoTables() {
		if table.Game != "blackjack" || table.Floor != "public" || table.Currency != "gold" {
			continue
		}
		if index < len(table.Seats) {
			return &casinoLoad{table: table, seat: index, changed: make(chan struct{}, 1), blackjack: &blackjackLoad{playerID: playerID}}
		}
		index -= len(table.Seats)
	}
	return &casinoLoad{failed: true}
}

func validBlackjackLoadView(v *blackjackLoadView, playerID string) bool {
	if v.Currency != "gold" || v.Balance < 0 || len(v.Players) > 6 || v.Round != nil && len(v.Round.Players) > 6 {
		return false
	}
	switch v.Phase {
	case "betting", "playing", "settling", "complete":
	default:
		return false
	}
	if v.Round != nil {
		if v.Round.ID != v.RoundID || len(v.RoundID) != 32 {
			return false
		}
		for _, player := range v.Round.Players {
			if player.PlayerID == playerID && (len(player.Hands) < 1 || len(player.Hands) > 4) {
				return false
			}
		}
	}
	return true
}

// Caller owns casinoLoad.mu. Shared round revisions may advance from peers;
// only this owner's exact bet or completed hand acknowledges their action.
func (j *blackjackLoad) receive(b *casinoLoad) {
	v := b.view.Blackjack
	if v == nil || !v.Available || v.Processing {
		return
	}
	if !validBlackjackLoadView(v, j.playerID) {
		b.failed = true
		return
	}
	if j.fundedRound != "" && b.view.YourSeat != nil && b.view.YourSeat.SessionID != j.fundedSession {
		b.failed = true
		return
	}
	if b.pending == "bet" || b.pending == "play" {
		if b.view.YourSeat == nil || b.view.YourSeat.SessionID != b.pendingSession || v.RoundID != j.pendingRound {
			b.failed = true
			return
		}
	}
	if b.pending == "bet" {
		for _, p := range v.Players {
			if p.PlayerID == j.playerID && p.Seat == b.seat {
				if p.Bet != j.pendingBet {
					b.failed = true
					return
				}
				j.fundedRound, j.fundedSession = v.RoundID, b.pendingSession
				j.wagers++
				b.pending = ""
				break
			}
		}
	}
	if v.Round == nil {
		return
	}
	for _, p := range v.Round.Players {
		if p.PlayerID != j.playerID || p.Seat != b.seat {
			continue
		}
		if b.pending == "play" && v.Round.Revision > b.pendingRevision && j.pendingHand >= 0 && j.pendingHand < len(p.Hands) && p.Hands[j.pendingHand].Done {
			b.pending = ""
			j.actions++
		}
		if v.Phase != "complete" || v.Round.Phase != "complete" || v.RoundID != j.fundedRound || v.RoundID == j.lastCompleted {
			return
		}
		paid := false
		for _, participant := range v.Players {
			if participant.PlayerID == j.playerID && participant.Seat == b.seat {
				paid = participant.Paid
			}
		}
		if !paid {
			return
		} // A dealt/done hand is not a settled player payment.
		for _, hand := range p.Hands {
			if !hand.Done || hand.Payout == nil || *hand.Payout < 0 {
				b.failed = true
				return
			}
			switch hand.Outcome {
			case "win", "lose", "push", "blackjack", "bust":
			default:
				b.failed = true
				return
			}
		}
		j.rounds++
		j.lastCompleted = v.RoundID
	}
}

func (j *blackjackLoad) step(b *casinoLoad, now time.Time, bet int, request func(map[string]interface{}) error, issue func(string, map[string]interface{})) {
	v := b.view.Blackjack
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
		// Lobby snapshots have no round revision. Once our exact wager has
		// been acknowledged, an older empty lobby must not submit it again.
		// A different round still needs its own normal explicit wager.
		if v.RoundID == j.fundedRound && b.view.YourSeat.SessionID == j.fundedSession {
			return
		}
		for _, p := range v.Players {
			if p.PlayerID == j.playerID {
				return
			}
		}
		if v.Balance < bet {
			b.failed = true
			return
		}
		j.pendingRound, j.pendingBet = v.RoundID, bet
		b.pendingSession = b.view.YourSeat.SessionID
		issue("bet", map[string]interface{}{"sessionId": b.pendingSession, "roundId": v.RoundID, "bet": bet})
		return
	}
	if v.Phase == "playing" && v.Round != nil && v.Round.TurnPlayerID == j.playerID {
		// Like the real table UI, never act on an already expired advertised
		// turn. Waiting/refreshing is not an action or paid-result acknowledgement.
		if !v.Round.Deadline.IsZero() && !now.Before(v.Round.Deadline) {
			return
		}
		for _, action := range v.Round.Actions {
			if action != "stand" {
				continue
			}
			j.pendingRound, j.pendingHand = v.RoundID, v.Round.TurnHand
			b.pendingSession, b.pendingRevision = b.view.YourSeat.SessionID, v.Round.Revision
			issue("play", map[string]interface{}{"sessionId": b.pendingSession, "roundId": v.RoundID, "roundRevision": v.Round.Revision, "gameAction": "stand"})
			return
		}
	}
}
