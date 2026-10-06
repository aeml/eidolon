package main

import (
	"eidolon-server/internal/game"
	"time"
)

type houseLoadView struct {
	TableID, TableVersion          string
	Game, Currency, RoundID, Phase string
	DealAt                         time.Time `json:"dealAt"`
	Balance                        int
	Available, Processing          bool
	Number                         *int
	Baccarat                       *struct{ Winner string }
	Players                        []struct {
		PlayerID string `json:"playerId"`
		Seat     int
		Wagers   []game.CasinoWager
		Paid     bool
		Payout   *int
	}
}

type houseLoad struct {
	playerID, pendingRound, fundedRound, fundedSession, lastCompleted string
	pendingWager                                                      game.CasinoWager
	wagers, rounds                                                    uint64
}

func newHouseLoad(index int, playerID string) *casinoLoad {
	if index < 0 || playerID == "" {
		return &casinoLoad{failed: true}
	}
	for _, table := range game.CasinoTables() {
		if (table.Game != "roulette" && table.Game != "baccarat") || table.Floor != "public" || table.Currency != "gold" {
			continue
		}
		if index < len(table.Seats) {
			return &casinoLoad{table: table, seat: index, changed: make(chan struct{}, 1), house: &houseLoad{playerID: playerID}}
		}
		index -= len(table.Seats)
	}
	return &casinoLoad{failed: true}
}

// Caller owns casinoLoad.mu. Peer wagers and reveal animations are not this
// account's accepted stake or completed payment.
func (h *houseLoad) receive(b *casinoLoad) {
	v := b.view.House
	if v == nil || !v.Available || v.Processing {
		return
	}
	if v.Game != b.table.Game || v.Currency != "gold" || v.Balance < 0 || len(v.RoundID) != 32 || len(v.Players) > 6 {
		b.failed = true
		return
	}
	switch v.Phase {
	case "betting", "revealing", "settling", "complete":
	default:
		b.failed = true
		return
	}
	if h.fundedRound != "" && b.view.YourSeat != nil && b.view.YourSeat.SessionID != h.fundedSession {
		b.failed = true
		return
	}
	if b.pending == "house_bet" && (b.view.YourSeat == nil || b.view.YourSeat.SessionID != b.pendingSession || v.RoundID != h.pendingRound) {
		b.failed = true
		return
	}
	for _, p := range v.Players {
		if p.PlayerID != h.playerID || p.Seat != b.seat {
			continue
		}
		if b.pending == "house_bet" {
			if len(p.Wagers) != 1 || p.Wagers[0] != h.pendingWager {
				b.failed = true
				return
			}
			h.fundedRound, h.fundedSession = v.RoundID, b.pendingSession
			h.wagers++
			b.pending = ""
		}
		if v.Phase != "complete" || !p.Paid || v.RoundID != h.fundedRound || v.RoundID == h.lastCompleted {
			return
		}
		if p.Payout == nil || *p.Payout < 0 {
			b.failed = true
			return
		}
		if v.Game == "roulette" {
			if v.Number == nil || *v.Number < 0 || *v.Number > 36 {
				b.failed = true
				return
			}
		} else {
			if v.Baccarat == nil {
				b.failed = true
				return
			}
			switch v.Baccarat.Winner {
			case "player", "banker", "tie":
			default:
				b.failed = true
				return
			}
		}
		h.rounds++
		h.lastCompleted = v.RoundID
	}
}

func (h *houseLoad) step(b *casinoLoad, now time.Time, bet int, request func(map[string]interface{}) error, issue func(string, map[string]interface{})) {
	v := b.view.House
	if v == nil || !v.Available || v.Processing {
		if request(map[string]interface{}{"action": "get"}) != nil {
			b.failed = true
		}
		b.nextAction = now.Add(3 * time.Second)
		return
	}
	if v.Game != b.table.Game || v.Currency != "gold" || len(v.RoundID) != 32 {
		b.failed = true
		return
	}
	if v.Phase != "betting" {
		return
	}
	if !casinoWagerWindowOpen(v.DealAt, now) {
		return
	}
	for _, p := range v.Players {
		if p.PlayerID == h.playerID {
			return
		}
	}
	if v.Balance < bet {
		b.failed = true
		return
	}
	spot := "player"
	if v.Game == "roulette" {
		spot = "red"
	}
	h.pendingWager = game.CasinoWager{Spot: spot, Amount: bet}
	if _, err := game.ValidateHouseWagers(v.Game, "gold", []game.CasinoWager{h.pendingWager}); err != nil {
		b.failed = true
		return
	}
	h.pendingRound, b.pendingSession = v.RoundID, b.view.YourSeat.SessionID
	issue("house_bet", map[string]interface{}{"sessionId": b.pendingSession, "roundId": v.RoundID, "wagers": []game.CasinoWager{h.pendingWager}})
}
