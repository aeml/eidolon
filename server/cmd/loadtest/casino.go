package main

import (
	"encoding/json"
	"math"
	"sync"
	"time"

	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

// Gold-only, one distinct physical public seat per bot. No grants, VIP bypass,
// artificial outcomes or retries of uncertain money-changing commands.
type casinoLoad struct {
	mu                 sync.Mutex
	table              game.CasinoTable
	seat               int
	blackjack          *blackjackLoad
	house              *houseLoad
	poker              *pokerLoad
	view               casinoLoadView
	pending            string
	pendingSession     string
	pendingRevision    uint64
	sentAt, nextAction time.Time
	spins, bonuses     uint64
	paidSpins          uint64
	failed             bool
	failureStage       casinoFailureStage
	timeoutAction      casinoTimeoutAction
	changed            chan struct{}
}

type casinoLoadView struct {
	Floor    string `json:"floor"`
	YourSeat *struct {
		TableID   string `json:"tableId"`
		SessionID string `json:"sessionId"`
		Seat      int    `json:"seat"`
	} `json:"yourSeat"`
	Blackjack *blackjackLoadView `json:"blackjack"`
	House     *houseLoadView     `json:"house"`
	Poker     *pokerLoadView     `json:"poker"`
	Slots     *struct {
		Currency   string `json:"currency"`
		Balance    int    `json:"balance"`
		Available  bool   `json:"available"`
		Processing bool   `json:"processing"`
		Session    struct {
			Revision  uint64 `json:"revision"`
			FreeSpins int    `json:"freeSpins"`
			Bonus     bool   `json:"bonus"`
			Last      *struct {
				BonusPicked *int  `json:"bonusPicked"`
				Free        *bool `json:"free"`
				Payout      *int  `json:"payout"`
			} `json:"last"`
		} `json:"session"`
	} `json:"slots"`
}

type casinoLoadCounts struct {
	spins, bonuses          uint64
	paidSpins               uint64
	failed                  bool
	wagers, rounds, actions uint64
	failureStage            casinoFailureStage
	timeoutAction           casinoTimeoutAction
}

// Observe the server's real betting window instead of submitting a new money
// action on an expired/closing view. An unstarted poker window (zero deadline)
// and older fixtures retain their normal behavior. Waiting earns no credit.
func casinoWagerWindowOpen(deadline, now time.Time) bool {
	return deadline.IsZero() || deadline.After(now.Add(2*time.Second))
}

func newCasinoLoad(index int) *casinoLoad {
	for _, table := range game.CasinoTables() {
		if table.Game == "slots" && table.Floor == "public" && table.Currency == "gold" {
			if index == 0 {
				return &casinoLoad{table: table, changed: make(chan struct{}, 1)}
			}
			index--
		}
	}
	return &casinoLoad{failed: true} // Never silently share or invent a machine.
}

func (b *casinoLoad) counts() casinoLoadCounts {
	b.mu.Lock()
	defer b.mu.Unlock()
	counts := casinoLoadCounts{spins: b.spins, bonuses: b.bonuses, paidSpins: b.paidSpins, failed: b.failed, failureStage: b.failureStage, timeoutAction: b.timeoutAction}
	if b.blackjack != nil {
		counts.wagers, counts.rounds, counts.actions = b.blackjack.wagers, b.blackjack.rounds, b.blackjack.actions
	}
	if b.house != nil {
		counts.wagers, counts.rounds = b.house.wagers, b.house.rounds
	}
	if b.poker != nil {
		counts.wagers, counts.rounds, counts.actions = b.poker.wagers, b.poker.rounds, b.poker.actions
	}
	return counts
}

func (b *casinoLoad) receive(payload json.RawMessage) bool {
	var view casinoLoadView
	if json.Unmarshal(payload, &view) != nil || (view.Floor != "public" && view.Floor != "vip") ||
		(view.YourSeat != nil && (view.YourSeat.SessionID == "" || len(view.YourSeat.SessionID) > 128)) ||
		(view.Slots != nil && (view.Slots.Balance < 0 || view.Slots.Session.FreeSpins < 0)) {
		return false
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	defer b.signal()
	if view.Floor != "public" || view.YourSeat != nil && (view.YourSeat.TableID != b.table.ID || view.YourSeat.Seat != b.seat) || view.Slots != nil && view.Slots.Currency != "gold" {
		b.failed = true // EP/VIP cannot be mislabeled as this Gold workload.
		return true
	}
	if b.olderReadyTableView(view) {
		return true
	}
	if b.view.YourSeat != nil && view.YourSeat != nil && b.view.YourSeat.SessionID == view.YourSeat.SessionID &&
		b.view.Slots != nil && view.Slots != nil && view.Slots.Session.Revision < b.view.Slots.Session.Revision {
		return true
	}
	// Peer notifications and own responses have multiple senders. An older
	// same-seat hand must not restore a turn after its action was acknowledged.
	if b.blackjack != nil && b.view.YourSeat != nil && view.YourSeat != nil && b.view.YourSeat.SessionID == view.YourSeat.SessionID &&
		b.view.Blackjack != nil && view.Blackjack != nil && view.Blackjack.Available && !view.Blackjack.Processing &&
		validBlackjackLoadView(view.Blackjack, b.blackjack.playerID) &&
		(b.blackjack.fundedRound == "" || b.blackjack.fundedSession == view.YourSeat.SessionID) &&
		(b.pending != "bet" && b.pending != "play" || b.pendingSession == view.YourSeat.SessionID && b.blackjack.pendingRound == view.Blackjack.RoundID) &&
		b.view.Blackjack.RoundID == view.Blackjack.RoundID && b.view.Blackjack.Round != nil && view.Blackjack.Round != nil &&
		view.Blackjack.Round.Revision < b.view.Blackjack.Round.Revision {
		return true
	}
	b.view = view
	if b.pending == "sit" && view.YourSeat != nil {
		b.pending = ""
	}
	if b.blackjack != nil {
		b.blackjack.receive(b)
		return true
	}
	if b.house != nil {
		b.house.receive(b)
		return true
	}
	if b.poker != nil {
		b.poker.receive(b)
		return true
	}
	if (b.pending == "slot_spin" || b.pending == "slot_bonus") && view.YourSeat != nil && view.Slots != nil && !view.Slots.Processing && view.Slots.Available {
		if view.YourSeat.SessionID != b.pendingSession {
			b.failed = true
			return true
		}
		if view.Slots.Session.Revision == b.pendingRevision {
			return true
		} // Unchanged poll/broadcast is not an acknowledgement.
		if b.pendingRevision == math.MaxUint64 || view.Slots.Session.Revision != b.pendingRevision+1 || view.Slots.Session.Last == nil ||
			view.Slots.Session.Last.Free == nil || view.Slots.Session.Last.Payout == nil || *view.Slots.Session.Last.Payout < 0 {
			b.failed = true
			return true
		}
		if b.pending == "slot_bonus" {
			if view.Slots.Session.Bonus || view.Slots.Session.Last.BonusPicked == nil || *view.Slots.Session.Last.BonusPicked != 0 {
				b.failed = true
				return true
			}
			b.bonuses++
		} else {
			b.spins++
			if !*view.Slots.Session.Last.Free {
				b.paidSpins++
			}
		}
		b.pending = ""
	}
	return true
}

func (b *casinoLoad) reject() {
	b.mu.Lock()
	defer b.mu.Unlock()
	defer b.signal()
	b.failed = true // Even a late rejection after a shared-table update must fail; never retain peer diagnostics.
}

func (b *casinoLoad) signal() {
	select {
	case b.changed <- struct{}{}:
	default:
	}
}

// Stop issuing actions at the deadline, but let the one outstanding money action
// acknowledge before closing its socket. Bounded observation only, no retry.
func (b *casinoLoad) awaitSettled(readerDone <-chan struct{}, timeout time.Duration) {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	for {
		b.mu.Lock()
		pending := !b.failed && (b.pending == "slot_spin" || b.pending == "slot_bonus" || b.pending == "bet" || b.pending == "play" || b.pending == "house_bet" || b.pending == "poker_buy_in" || b.pending == "poker_play")
		b.mu.Unlock()
		if !pending {
			return
		}
		select {
		case <-b.changed:
		case <-readerDone:
			b.reject()
			return
		case <-timer.C:
			b.reject()
			return
		}
	}
}

func (b *casinoLoad) step(me Entity, now time.Time, bet int, timeout time.Duration, request func(map[string]interface{}) error, move func(float64, float64)) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.failed {
		return
	}
	if b.pending == "enter" && me.InstanceID == game.CasinoInstanceID {
		b.pending = ""
	}
	if b.pending != "" {
		if now.Sub(b.sentAt) >= timeout {
			b.failureStage = casinoFailureTimeout
			b.timeoutAction = casinoTimeoutActionFor(b.pending)
			b.failed = true
		}
		return // Never repeat an uncertain wager or bonus choice.
	}
	if now.Before(b.nextAction) && (b.poker == nil || !b.poker.canAct(b)) {
		return
	}
	issue := func(action string, payload map[string]interface{}) {
		payload["action"] = action
		if request(payload) != nil {
			b.failed = true
			return
		}
		b.pending, b.sentAt, b.nextAction = action, now, now.Add(3*time.Second)
	}
	if me.Health <= 0 || me.State == "DEAD" {
		b.failed = true
		return
	}
	if me.InstanceID == "" {
		if math.Hypot(me.X, me.Z-180) > 6 {
			move(0, 180)
			return
		}
		issue("enter", map[string]interface{}{})
		return
	}
	if me.InstanceID != game.CasinoInstanceID || me.Y > 1 {
		b.failed = true
		return
	}
	if b.view.YourSeat == nil {
		position := b.table.Seats[b.seat]
		if math.Hypot(me.X-position.ExitX, me.Z-position.ExitZ) > 1.5 {
			move(position.ExitX, position.ExitZ)
			return
		}
		issue("sit", map[string]interface{}{"tableId": b.table.ID, "seat": b.seat})
		return
	}
	if b.blackjack != nil {
		b.blackjack.step(b, now, bet, request, issue)
		b.refreshIdle(now, request)
		return
	}
	if b.house != nil {
		b.house.step(b, now, bet, request, issue)
		b.refreshIdle(now, request)
		return
	}
	if b.poker != nil {
		b.poker.step(b, now, bet, request, issue)
		b.refreshIdle(now, request)
		return
	}
	slots := b.view.Slots
	if slots == nil || !slots.Available || slots.Processing {
		// Read-only refresh, not a repeated money-changing action.
		if request(map[string]interface{}{"action": "get"}) != nil {
			b.failed = true
		}
		b.nextAction = now.Add(3 * time.Second)
		return
	}
	if slots.Session.Revision == math.MaxUint64 {
		b.failed = true
		return
	}
	if !slots.Session.Bonus && slots.Session.FreeSpins == 0 && slots.Balance < bet {
		b.failed = true
		return
	}
	b.pendingSession, b.pendingRevision = b.view.YourSeat.SessionID, slots.Session.Revision
	if slots.Session.Bonus {
		issue("slot_bonus", map[string]interface{}{"sessionId": b.pendingSession, "roundRevision": b.pendingRevision, "choice": 0})
	} else {
		issue("slot_spin", map[string]interface{}{"sessionId": b.pendingSession, "roundRevision": b.pendingRevision, "bet": bet})
	}
}

// Shared table clocks/other players advance without acknowledging this bot's
// own request. The normal client polls these views; a cached valid view is not
// evidence that its betting phase or advertised turn is still current.
// Caller holds b.mu. Child controllers may have already refreshed/issued, so
// never send a duplicate query or retry an outstanding monetary action.
func (b *casinoLoad) refreshIdle(now time.Time, request func(map[string]interface{}) error) {
	if b.failed || b.pending != "" || now.Before(b.nextAction) {
		return
	}
	if request(map[string]interface{}{"action": "get"}) != nil {
		b.failed = true
	}
	b.nextAction = now.Add(3 * time.Second)
}

func (b *casinoLoad) play(connection *websocket.Conn, movement *botMovement, me Entity, now time.Time, bet int, timeout time.Duration) {
	b.step(me, now, bet, timeout, func(payload map[string]interface{}) error { return send(connection, "casino", payload) },
		func(x, z float64) { movement.move(connection, me, x, z) })
}
