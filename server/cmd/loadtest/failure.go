package main

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
	default:
		return "unclassified"
	}
}
