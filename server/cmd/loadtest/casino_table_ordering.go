package main

import "strconv"

type casinoTableOrder struct {
	id, version           string
	available, processing bool
}

// Table identity/currency/basic phase validation is required before trusting
// an ordering counter. Unknown/malformed/legacy views still use the existing
// validation and own action/result fences; this never acknowledges a wager.
func (b *casinoLoad) tableOrder(v casinoLoadView) casinoTableOrder {
	if b.blackjack != nil && v.Blackjack != nil && len(v.Blackjack.RoundID) == 32 && validBlackjackLoadView(v.Blackjack, b.blackjack.playerID) {
		s := v.Blackjack
		return casinoTableOrder{s.TableID, s.TableVersion, s.Available, s.Processing}
	}
	if b.house != nil && v.House != nil {
		s := v.House
		if s.Game != b.table.Game || s.Currency != "gold" || s.Balance < 0 || len(s.RoundID) != 32 || len(s.Players) > 6 {
			return casinoTableOrder{}
		}
		switch s.Phase {
		case "betting", "revealing", "settling", "complete":
			return casinoTableOrder{s.TableID, s.TableVersion, s.Available, s.Processing}
		}
	}
	if b.poker != nil && v.Poker != nil {
		s := v.Poker
		if s.Currency != "gold" || s.Balance < 0 || len(s.RoundID) != 32 || len(s.Players) > 6 ||
			s.Round != nil && (s.Round.ID != s.RoundID || len(s.Round.Players) < 2 || len(s.Round.Players) > 6) {
			return casinoTableOrder{}
		}
		switch s.Phase {
		case "betting", "playing", "settling", "complete":
			return casinoTableOrder{s.TableID, s.TableVersion, s.Available, s.Processing}
		}
	}
	return casinoTableOrder{}
}

func casinoTableVersion(s string) (int64, bool) {
	if len(s) == 0 || len(s) > 19 {
		return 0, false
	}
	n, err := strconv.ParseInt(s, 10, 64)
	return n, err == nil && n > 0 && strconv.FormatInt(n, 10) == s
}

// Caller owns b.mu. Multiple server senders can enqueue views out of capture
// order. A persistent table version orders lobbies and transitions as well as
// hands, unlike a hand revision alone. Never hide ownership or save failures.
func (b *casinoLoad) olderReadyTableView(incoming casinoLoadView) bool {
	previousSeat, seat := b.view.YourSeat, incoming.YourSeat
	if previousSeat == nil || seat == nil || previousSeat.SessionID != seat.SessionID ||
		previousSeat.TableID != seat.TableID || previousSeat.Seat != seat.Seat {
		return false
	}
	previous, next := b.tableOrder(b.view), b.tableOrder(incoming)
	if !previous.available || !next.available || next.processing || previous.id != b.table.ID || next.id != b.table.ID {
		return false
	}
	a, validA := casinoTableVersion(previous.version)
	z, validZ := casinoTableVersion(next.version)
	return validA && validZ && z < a
}
