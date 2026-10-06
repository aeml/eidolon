package main

import (
	"encoding/json"
	"fmt"

	"eidolon-server/internal/game"
)

type casinoFailureStage uint8

// Timeout diagnostics retain only a closed action category, not session,
// round, account or error text. Unknown input never becomes a log label.
type casinoTimeoutAction uint8

const (
	casinoTimeoutUnknown casinoTimeoutAction = iota
	casinoTimeoutEnter
	casinoTimeoutSit
	casinoTimeoutSpin
	casinoTimeoutBonus
	casinoTimeoutBlackjackBet
	casinoTimeoutBlackjackPlay
	casinoTimeoutHouseBet
	casinoTimeoutPokerBuyIn
	casinoTimeoutPokerPlay
	casinoTimeoutKinds
)

func casinoTimeoutActionFor(action string) casinoTimeoutAction {
	switch action {
	case "enter":
		return casinoTimeoutEnter
	case "sit":
		return casinoTimeoutSit
	case "slot_spin":
		return casinoTimeoutSpin
	case "slot_bonus":
		return casinoTimeoutBonus
	case "bet":
		return casinoTimeoutBlackjackBet
	case "play":
		return casinoTimeoutBlackjackPlay
	case "house_bet":
		return casinoTimeoutHouseBet
	case "poker_buy_in":
		return casinoTimeoutPokerBuyIn
	case "poker_play":
		return casinoTimeoutPokerPlay
	default:
		return casinoTimeoutUnknown
	}
}

const (
	casinoFailureUnknown casinoFailureStage = iota
	casinoFailureBusy
	casinoFailureStale
	casinoFailureSeat
	casinoFailureRate
	casinoFailureRoundOrBet
	casinoFailureRejected
	casinoFailureTimeout
	casinoFailureKinds
)

// Parse only bounded messages and retain a fixed category, never diagnostics,
// seat/session identifiers or arbitrary provider/account text. Classification
// is observational: every rejection still fails, with no wager retry.
func classifyCasinoRejection(message Message) casinoFailureStage {
	stage := casinoFailureRejected
	if len(message.Payload) > 4096 {
		return stage
	}
	var reason string
	if message.Type == "casino_action_error" {
		var body struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(message.Payload, &body) != nil {
			return stage
		}
		reason = body.Error
	} else if message.Type != "error" || json.Unmarshal(message.Payload, &reason) != nil {
		return stage
	}
	// This handler combines a stale/closed round and invalid stake bounds in
	// one instruction. Retain that ambiguity instead of calling it stale.
	for _, currency := range []string{"gold", "ep"} {
		minimum, maximum, step := game.CasinoBetLimits("blackjack", currency)
		if reason == fmt.Sprintf("review the current round and choose %d–%d %s in steps of %d", minimum, maximum, currency, step) {
			return casinoFailureRoundOrBet
		}
		minimum, maximum, step = game.CasinoBetLimits("poker", currency)
		if reason == fmt.Sprintf("review the hand and choose %d–%d %s in steps of %d", minimum, maximum, currency, step) {
			return casinoFailureRoundOrBet
		}
	}
	switch reason {
	case "table funds are being saved; please wait", "poker funds are being saved; please wait", "poker is recovering; please wait", "slot settlement still pending":
		return casinoFailureBusy
	case "round changed; review the table", "blackjack round changed; review the table", "blackjack round changed; refresh the table", "wait for your blackjack turn", "blackjack turn expired", "poker hand changed; review the table", "slot state changed; refresh before acting", "betting has closed for this round", "this hand is closed to new buy-ins":
		return casinoFailureStale
	case "that seat is occupied or reserved for a reconnect", "leave your current seat first", "finish your current action before sitting in the casino", "walk up to the seat first", "go to that casino floor before sitting", "approach the casino door in Lanternhold first", "sit at the table before wagering", "sit at the blackjack table before playing", "return to your funded blackjack seat before playing this hand", "sit at the poker table before playing", "sit at an elemental machine before playing":
		return casinoFailureSeat
	case "message rate limit exceeded", "message rate limit exceeded: casino":
		return casinoFailureRate
	default:
		return stage
	}
}

func (b *casinoLoad) rejectServer(message Message) {
	b.mu.Lock()
	defer b.mu.Unlock()
	defer b.signal()
	if !b.failed {
		b.failureStage = classifyCasinoRejection(message)
	}
	b.failed = true
}
