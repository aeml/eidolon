package main

import (
	"errors"
	"slices"
	"sort"
	"sync"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

var dungeonRoomRewardRecovery = struct {
	sync.Mutex
	cacheAfter, storeAfter string
}{}

func recoverAccountDungeonRoomRewardsLocked(username string) error {
	entry, found := roomRewardPendingFor(username)
	if !found {
		return nil // No remote polling on every movement/combat message.
	}
	_, err := deliverDungeonRoomRewardRecipientLocked(entry.op, username)
	return err
}

// Authentication has succeeded and this account's work lock is owned. Drain
// every pending page before stale character hydration; full bags may log in.
func recoverColdAccountDungeonRoomRewardsLocked(username string) error {
	if dungeonRoomRewards == nil {
		return nil
	}
	if err := recoverAccountDungeonRoomRewardsLocked(username); err != nil {
		return err
	}
	after := ""
	for {
		page, err := dungeonRoomRewards.PendingDungeonRoomRewards(username, after, 50)
		if err != nil {
			return err
		}
		if len(page) == 0 {
			return nil
		}
		for _, record := range page {
			if record.Validate() != nil || record.State != database.DungeonRoomRewardPending || record.ID <= after {
				return database.ErrDungeonRoomRewardConflict
			}
			after = record.ID
			if _, err := deliverDungeonRoomRewardRecipientLocked(record.DungeonRoomRewardOperation, username); err != nil && !errors.Is(err, game.ErrDungeonRoomRewardFull) {
				return err
			}
		}
	}
}

// Run once before admission. Every party claim survives independently of a
// restored/expired scene or another player's already saved room progress.
func recoverDungeonRoomRewardsOnStartup() error {
	if dungeonRoomRewards == nil {
		return errors.New("room reward recovery storage unavailable")
	}
	after := ""
	for {
		page, err := dungeonRoomRewards.PendingDungeonRoomRewards("", after, 50)
		if err != nil {
			return err
		}
		if len(page) == 0 {
			return nil
		}
		for _, record := range page {
			if record.Validate() != nil || record.State != database.DungeonRoomRewardPending || record.ID <= after {
				return database.ErrDungeonRoomRewardConflict
			}
			after = record.ID
			if err := deliverDungeonRoomRewardCohort(record.DungeonRoomRewardOperation, false); err != nil && !onlyFullRoomRewardFailures(err) {
				return err
			}
		}
	}
}

func onlyFullRoomRewardFailures(err error) bool {
	if err == nil {
		return false
	}
	if joined, ok := err.(interface{ Unwrap() []error }); ok {
		for _, failure := range joined.Unwrap() {
			if !onlyFullRoomRewardFailures(failure) {
				return false
			}
		}
		return true
	}
	return errors.Is(err, game.ErrDungeonRoomRewardFull)
}

// Independent, non-overlapping, bounded rotating passes prevent an unhealthy
// earliest cohort from starving later rooms. Include unacknowledged prepares
// that are not yet visible in the shared pending scan.
func recoverPendingDungeonRoomRewards() error {
	if dungeonRoomRewards == nil || !dungeonRoomRewardRecovery.TryLock() {
		return nil
	}
	defer dungeonRoomRewardRecovery.Unlock()
	var failures []error
	seen := map[string]bool{}
	if world != nil {
		plans := world.PendingDungeonRoomRewardPlans()
		slices.SortFunc(plans, func(a, b database.DungeonRoomRewardOperation) int {
			if a.ID < b.ID {
				return -1
			}
			if a.ID > b.ID {
				return 1
			}
			return 0
		})
		start := sort.Search(len(plans), func(index int) bool { return plans[index].ID > dungeonRoomRewardRecovery.cacheAfter })
		if start == len(plans) {
			start = 0
		}
		for _, op := range plans[start:min(start+10, len(plans))] {
			if err := prepareAndDeliverDungeonRoomReward(op); err != nil && !onlyFullRoomRewardFailures(err) {
				failures = append(failures, err)
			}
			seen[op.ID], dungeonRoomRewardRecovery.cacheAfter = true, op.ID
		}
	}
	page, err := dungeonRoomRewards.PendingDungeonRoomRewards("", dungeonRoomRewardRecovery.storeAfter, 10)
	if err == nil && len(page) == 0 && dungeonRoomRewardRecovery.storeAfter != "" {
		dungeonRoomRewardRecovery.storeAfter = ""
		page, err = dungeonRoomRewards.PendingDungeonRoomRewards("", "", 10)
	}
	if err != nil {
		return errors.Join(append(failures, err)...)
	}
	for _, record := range page {
		if record.Validate() != nil || record.State != database.DungeonRoomRewardPending || record.ID <= dungeonRoomRewardRecovery.storeAfter {
			return database.ErrDungeonRoomRewardConflict
		}
		dungeonRoomRewardRecovery.storeAfter = record.ID
		if seen[record.ID] {
			continue
		}
		if err := deliverDungeonRoomRewardCohort(record.DungeonRoomRewardOperation, false); err != nil && !onlyFullRoomRewardFailures(err) {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}

func retryDungeonRoomRewardsAfterBagChangeLocked(client *Client, action string) {
	switch action {
	case MsgSell, MsgStashDeposit, MsgEquip, MsgInventoryMove, MsgInventorySort:
	default:
		return
	}
	// Called after bag-changing work, not every movement. Include rewards whose
	// bags were full and therefore had no failed-save admission marker.
	if err := recoverColdAccountDungeonRoomRewardsLocked(client.username); err != nil {
		client.sendError("Your room reward is retained while its save recovers. Please retry shortly.")
	}
}
