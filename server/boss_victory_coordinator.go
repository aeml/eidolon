package main

import (
	"errors"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func prepareAndDeliverBossVictory(op database.BossVictoryOperation) error {
	return deliverBossVictoryCohort(op, true)
}

// Private receipts, public loot lineage and the original dungeon finale all
// belong to the FIRST durable victory. Partial member failures must not reroll
// or starve other claims; terminal proof is permitted only after every barrier.
func deliverBossVictoryCohort(proposal database.BossVictoryOperation, allowPrepare bool) error {
	op, deliveryErr := prepareAndDeliverBossVictoryCharacters(proposal, allowPrepare)
	if bossVictories == nil {
		return deliveryErr
	}
	record, err := bossVictories.GetBossVictory(op.ID)
	if err != nil {
		return errors.Join(deliveryErr, err)
	}
	if record == nil || record.Validate() != nil || record.Fingerprint != op.Fingerprint {
		return errors.Join(deliveryErr, database.ErrBossVictoryConflict)
	}
	var failures []error
	if deliveryErr != nil {
		failures = append(failures, deliveryErr)
	}
	// Re-read original custody even on terminal replay. A consumed/partial
	// drop may never be replenished by the old victory's spawn projection.
	if err := restoreBossVictoryDrops(op); err != nil {
		failures = append(failures, err)
	}
	if record.State == database.BossVictoryPending {
		event, complete, err := game.BossVictoryDungeonCompletion(op)
		if err == nil && complete {
			err = recordGuildDungeonCompletion(event)
		}
		if err != nil {
			failures = append(failures, err)
		}
	}
	if len(failures) > 0 {
		return errors.Join(failures...)
	}
	if world != nil {
		if err := world.StartBossVictoryFinale(op); err != nil {
			return err
		}
	}
	if record.State == database.BossVictoryPending {
		record, err = bossVictories.CompleteBossVictory(op.ID, op.Fingerprint)
		if err != nil {
			return err
		}
		if record == nil || record.Validate() != nil || record.State != database.BossVictoryComplete || record.ID != op.ID || record.Fingerprint != op.Fingerprint {
			return database.ErrBossVictoryConflict
		}
	}
	if world != nil {
		return world.RetireBossVictoryPlan(op)
	}
	return nil
}
