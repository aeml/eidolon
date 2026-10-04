package main

import "encoding/json"

type casinoFailureStage uint8

const (
	casinoFailureUnknown casinoFailureStage = iota
	casinoFailureBusy
	casinoFailureStale
	casinoFailureSeat
	casinoFailureRate
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
	switch reason {
	case "table funds are being saved; please wait", "poker funds are being saved; please wait", "poker is recovering; please wait", "slot settlement still pending":
		return casinoFailureBusy
	case "round changed; review the table", "blackjack round changed; review the table", "poker hand changed; review the table", "slot state changed; refresh before acting", "betting has closed for this round", "this hand is closed to new buy-ins":
		return casinoFailureStale
	case "that seat is occupied or reserved for a reconnect", "leave your current seat first", "finish your current action before sitting in the casino", "walk up to the seat first", "go to that casino floor before sitting", "approach the casino door in Lanternhold first", "sit at the table before wagering", "sit at the poker table before playing", "sit at an elemental machine before playing":
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
