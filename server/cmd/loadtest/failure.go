package main

import "encoding/json"

// A closed vocabulary, never raw errors, account/actor IDs or network payloads.
// Caller holds partyLoad.mu. Preserve the first failure, not cleanup symptoms.
type loadFailureStage uint8

const (
	failureUnknown loadFailureStage = iota
	failureForeignInstance
	failureCheckpointPosition
	failureUnexpectedTown
	failureDungeonRequest
	failureDungeonTimeout
	failureInitialEntryTimeout
	failureCastTimeout
	failureServerRejection
	failureServerRateLimit
)

func (p *partyLoad) failAt(stage loadFailureStage) {
	if !p.failed {
		p.failureStage = stage
	}
	p.failed = true
}

func (p *partyLoad) failureCode() string {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.failed {
		return "none"
	}
	switch p.failureStage {
	case failureForeignInstance:
		return "foreign_instance"
	case failureCheckpointPosition:
		return "checkpoint_position"
	case failureUnexpectedTown:
		return "unexpected_town"
	case failureDungeonRequest:
		return "dungeon_request"
	case failureDungeonTimeout:
		return "dungeon_timeout"
	case failureInitialEntryTimeout:
		return "initial_entry_timeout"
	case failureCastTimeout:
		return "cast_timeout"
	case failureServerRejection:
		return "server_rejection"
	case failureServerRateLimit:
		return "server_rate_limit"
	default:
		return "unclassified"
	}
}

// Retain only a fixed classification; never store or print server payloads.
func (p *partyLoad) rejectServer(payload json.RawMessage) {
	p.mu.Lock()
	defer p.mu.Unlock()
	stage := failureServerRejection
	var message string
	if len(payload) <= 2048 && json.Unmarshal(payload, &message) == nil && message == "message rate limit exceeded" {
		stage = failureServerRateLimit
	}
	p.failAt(stage)
	for index := range p.members {
		p.signal(index)
	}
}
