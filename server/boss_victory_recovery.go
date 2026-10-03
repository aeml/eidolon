package main

import (
	"errors"
	"slices"
	"sort"
	"strings"
	"sync"

	"eidolon-server/internal/database"
)

var bossVictoryRecovery = struct {
	sync.Mutex
	cacheAfter, storeAfter string
}{}

func recoverBossVictoriesOnStartup() error {
	if bossVictories == nil {
		return errors.New("boss victory recovery storage unavailable")
	}
	after := ""
	for {
		page, err := bossVictories.PendingBossVictories("", after, 50)
		if err != nil {
			return err
		}
		if len(page) == 0 {
			return nil
		}
		for _, record := range page {
			if record.Validate() != nil || record.State != database.BossVictoryPending || record.ID <= after {
				return database.ErrBossVictoryConflict
			}
			after = record.ID
			if err := deliverBossVictoryCohort(record.BossVictoryOperation, false); err != nil {
				return err
			}
		}
	}
}

// Rotate independently through retained local prepares and stored unpaid
// cohorts. No all-history polling per movement; an early failed account must
// not monopolize every pass. Existing account locks serialize recipient work.
func recoverPendingBossVictories() error {
	if bossVictories == nil || !bossVictoryRecovery.TryLock() {
		return nil
	}
	defer bossVictoryRecovery.Unlock()
	var failures []error
	seen := map[string]bool{}
	if world != nil {
		plans := world.PendingBossVictoryPlans()
		slices.SortFunc(plans, func(a, b database.BossVictoryOperation) int { return strings.Compare(a.ID, b.ID) })
		start := sort.Search(len(plans), func(i int) bool { return plans[i].ID > bossVictoryRecovery.cacheAfter })
		if start == len(plans) {
			start = 0
		}
		for _, op := range plans[start:min(start+10, len(plans))] {
			if err := prepareAndDeliverBossVictory(op); err != nil {
				failures = append(failures, err)
			}
			seen[op.ID], bossVictoryRecovery.cacheAfter = true, op.ID
		}
	}
	page, err := bossVictories.PendingBossVictories("", bossVictoryRecovery.storeAfter, 10)
	if err == nil && len(page) == 0 && bossVictoryRecovery.storeAfter != "" {
		bossVictoryRecovery.storeAfter = ""
		page, err = bossVictories.PendingBossVictories("", "", 10)
	}
	if err != nil {
		return errors.Join(append(failures, err)...)
	}
	for _, record := range page {
		if record.Validate() != nil || record.State != database.BossVictoryPending || record.ID <= bossVictoryRecovery.storeAfter {
			return database.ErrBossVictoryConflict
		}
		bossVictoryRecovery.storeAfter = record.ID
		if !seen[record.ID] {
			if err := deliverBossVictoryCohort(record.BossVictoryOperation, false); err != nil {
				failures = append(failures, err)
			}
		}
	}
	return errors.Join(failures...)
}
