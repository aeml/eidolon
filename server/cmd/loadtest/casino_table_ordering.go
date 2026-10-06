package main

import "strconv"

type casinoTableOrder struct {
	id, version           string
	available, processing bool
}

// Fixed metadata for this one physical seat; never keep hands or wallet history.
type casinoTableFence struct {
	session, table string
	seat           int
	version        int64
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
	seat := incoming.YourSeat
	if seat == nil || seat.SessionID == "" {
		b.orderFence = casinoTableFence{}
		return false
	}
	if b.orderFence.session != seat.SessionID || b.orderFence.table != seat.TableID || b.orderFence.seat != seat.Seat {
		b.orderFence = casinoTableFence{session: seat.SessionID, table: seat.TableID, seat: seat.Seat}
	}
	next := b.tableOrder(incoming)
	version, valid := casinoTableVersion(next.version)
	if !next.available || !valid || next.id != b.table.ID || seat.TableID != b.table.ID {
		return false
	}
	if !next.processing && version < b.orderFence.version {
		return true
	}
	if version > b.orderFence.version {
		b.orderFence.version = version
	}
	return false // Never hide saving feedback, even if its snapshot is older.
}
