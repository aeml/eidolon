package main

import (
	"errors"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// The first-victory record is the durable spawn origin; the existing ground
// ledger owns every accepted pickup. No invented character drop/debit or new
// transaction collection is used to represent an enemy's public loot.
func restoreBossVictoryDrops(captured database.BossVictoryOperation) error {
	if bossVictories == nil || groundItemOperations == nil || captured.Validate() != nil {
		return database.ErrBossVictoryConflict
	}
	current, err := bossVictories.GetBossVictory(captured.ID)
	if err != nil {
		return err
	}
	if current == nil || current.Validate() != nil || current.Fingerprint != captured.Fingerprint {
		return database.ErrBossVictoryConflict
	}
	var failures []error
	for index, drop := range current.Drops {
		latest, err := groundItemOperations.LatestGroundItemOperation(drop.LootID)
		if err == nil {
			if latest != nil {
				if !game.BossVictoryDropCustodyMatches(current.BossVictoryOperation, index, *latest) {
					err = database.ErrBossVictoryConflict
				} else {
					err = restoreGroundItemRecord(*latest)
				}
			} else if world != nil {
				err = world.RestoreOriginalBossDrop(current.BossVictoryOperation, index)
			}
		}
		if err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}

var bossDropRecovery = struct {
	sync.Mutex
	after string
}{}

// Include terminal victories. Startup discovers all still-available original
// spawns independently of whether a boss room is already cleared on restore.
func recoverBossDropsOnStartup() error {
	if bossVictories == nil || groundItemOperations == nil {
		return errors.New("boss drop recovery storage unavailable")
	}
	after := ""
	for {
		page, err := bossVictories.ActiveBossVictoryDropPage(after, time.Now(), 50)
		if err != nil {
			return err
		}
		if len(page) == 0 {
			return nil
		}
		for _, record := range page {
			if record.Validate() != nil || record.ID <= after {
				return database.ErrBossVictoryConflict
			}
			after = record.ID
			if err := restoreBossVictoryDrops(record.BossVictoryOperation); err != nil {
				return err
			}
		}
	}
}

// Bounded rotating pass, not one all-history scan per player action. Original
// availability comes from the first victory, never the time of this pass.
func recoverAvailableBossDrops() error {
	if bossVictories == nil || groundItemOperations == nil || !bossDropRecovery.TryLock() {
		return nil
	}
	defer bossDropRecovery.Unlock()
	page, err := bossVictories.ActiveBossVictoryDropPage(bossDropRecovery.after, time.Now(), 10)
	if err == nil && len(page) == 0 && bossDropRecovery.after != "" {
		bossDropRecovery.after = ""
		page, err = bossVictories.ActiveBossVictoryDropPage("", time.Now(), 10)
	}
	if err != nil {
		return err
	}
	var failures []error
	for _, record := range page {
		if record.Validate() != nil || record.ID <= bossDropRecovery.after {
			return database.ErrBossVictoryConflict
		}
		bossDropRecovery.after = record.ID
		if err := restoreBossVictoryDrops(record.BossVictoryOperation); err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}
