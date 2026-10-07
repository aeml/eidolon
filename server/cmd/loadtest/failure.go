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
	failureServerRaidEntryRateLimit
	failureServerMoveRateLimit
	failureServerAttackRateLimit
	failureServerAbilityRateLimit
	failureServerRecallRateLimit
	failureServerRespawnRateLimit
	failureWeeklyPhaseEnvelope
	failureWeeklyPhaseScene
	failureWeeklyPhaseInactive
	failureWeeklyPhaseIdentity
	failureWeeklyPhaseOrder
	failureEventEnvelope
	failureEventIdentity
	failureEventOrder
	failureEventExpired
	failureEventMissingWave
	failureEventViewTimeout
	failureEventLevel
	failureEventRequest
	failureServerRecoveryContext
	failureServerRespawnRequired
	failureRecoveryEchoTimeout
	failureRecoveryTownStateTimeout
	failureRecoveryTownDead
	failureRecoveryOutsideTown
	failureRecoveryWrongScene
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
	case failureServerRaidEntryRateLimit:
		return "server_rate_limit_raid_enter"
	case failureServerMoveRateLimit:
		return "server_rate_limit_move"
	case failureServerAttackRateLimit:
		return "server_rate_limit_attack"
	case failureServerAbilityRateLimit:
		return "server_rate_limit_ability"
	case failureServerRecallRateLimit:
		return "server_rate_limit_recall"
	case failureServerRespawnRateLimit:
		return "server_rate_limit_respawn"
	case failureServerRecoveryContext:
		return "server_recovery_context"
	case failureServerRespawnRequired:
		return "server_respawn_required"
	case failureRecoveryEchoTimeout:
		return "recovery_echo_timeout"
	case failureRecoveryTownStateTimeout:
		return "recovery_town_state_timeout"
	case failureRecoveryTownDead:
		return "recovery_town_dead"
	case failureRecoveryOutsideTown:
		return "recovery_outside_town"
	case failureRecoveryWrongScene:
		return "recovery_wrong_scene"
	case failureWeeklyPhaseEnvelope:
		return "weekly_phase_envelope"
	case failureWeeklyPhaseScene:
		return "weekly_phase_scene"
	case failureWeeklyPhaseInactive:
		return "weekly_phase_inactive"
	case failureWeeklyPhaseIdentity:
		return "weekly_phase_identity"
	case failureWeeklyPhaseOrder:
		return "weekly_phase_order"
	case failureEventEnvelope:
		return "event_envelope"
	case failureEventIdentity:
		return "event_identity"
	case failureEventOrder:
		return "event_order"
	case failureEventExpired:
		return "event_expired"
	case failureEventMissingWave:
		return "event_missing_wave"
	case failureEventViewTimeout:
		return "event_view_timeout"
	case failureEventLevel:
		return "event_level"
	case failureEventRequest:
		return "event_request"
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
	if len(payload) <= 2048 && json.Unmarshal(payload, &message) == nil {
		switch message {
		case "message rate limit exceeded":
			stage = failureServerRateLimit // Retain older game executable compatibility.
		case "message rate limit exceeded: raid_enter":
			stage = failureServerRaidEntryRateLimit
		case "message rate limit exceeded: move":
			stage = failureServerMoveRateLimit
		case "message rate limit exceeded: attack":
			stage = failureServerAttackRateLimit
		case "message rate limit exceeded: ability":
			stage = failureServerAbilityRateLimit
		case "message rate limit exceeded: recall":
			stage = failureServerRecallRateLimit
		case "message rate limit exceeded: respawn":
			stage = failureServerRespawnRateLimit
		case "request a fresh recovery context":
			stage = failureServerRecoveryContext
		case "use Respawn to recover in Lanternhold before recalling":
			stage = failureServerRespawnRequired
		}
	}
	p.failAt(stage)
	for index := range p.members {
		p.signal(index)
	}
}
