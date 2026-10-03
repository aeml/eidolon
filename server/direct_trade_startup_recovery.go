package main

import (
	"errors"
	"slices"
	"sync"

	"eidolon-server/internal/database"
)

var directTradeRecoveryPass sync.Mutex

// Before admission, drain all durable pending decisions in bounded pages. A
// failed page stops startup rather than leaving unindexed stale accounts free.
// This never cancels unrelated unconfirmed escrow: its peer is found on login.
func recoverDirectTradesOnStartup() error {
	if directTradeOperations == nil {
		return errors.New("direct trade recovery storage unavailable")
	}
	for {
		pending, err := directTradeOperations.PendingDirectTradeOperations("", 50)
		if err != nil {
			return err
		}
		if len(pending) == 0 {
			return nil
		}
		for _, op := range pending {
			if err := recoverStoredDirectTradeAndDelivery(op); err != nil {
				return err
			}
		}
	}
}

func recoverStoredDirectTradeAndDelivery(op database.DirectTradeOperation) error {
	if op.Validate() != nil || op.State != database.DirectTradePending {
		return database.ErrDirectTradeConflict
	}
	unlock := lockCharactersWork(op.Participants[0].Username, op.Participants[1].Username)
	defer unlock()
	if err := confirmDirectTradeOperationLocked(op); err != nil {
		return err
	}
	completed, err := prepareAndCompleteDirectTradeLocked(op)
	if err != nil {
		return err
	}
	return finishDirectTradeDeliveryLocked(*completed)
}

// One bounded pass, including unknown prepares that do not yet appear in a
// database scan. The cache's unconfirmed flag is not promoted by that scan's
// absence. No redundant workers pile up behind an unavailable account.
func recoverPendingDirectTrades() error {
	if directTradeOperations == nil || !directTradeRecoveryPass.TryLock() {
		return nil
	}
	defer directTradeRecoveryPass.Unlock()
	unique := map[string]database.DirectTradeOperation{}
	directTradePending.RLock()
	for _, entry := range directTradePending.accounts {
		unique[entry.op.ID] = entry.op
	}
	directTradePending.RUnlock()
	ids := make([]string, 0, len(unique))
	for id := range unique {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	for _, id := range ids[:min(10, len(ids))] {
		op := unique[id]
		unlock := lockCharactersWork(op.Participants[0].Username, op.Participants[1].Username)
		completed, err := prepareAndCompleteDirectTradeLocked(op)
		if err == nil {
			err = finishDirectTradeDeliveryLocked(*completed)
		}
		unlock()
		if err != nil {
			return err
		}
	}
	pending, err := directTradeOperations.PendingDirectTradeOperations("", 10)
	if err != nil {
		return err
	}
	for _, op := range pending {
		if err := recoverStoredDirectTradeAndDelivery(op); err != nil {
			return err
		}
	}
	return nil
}
