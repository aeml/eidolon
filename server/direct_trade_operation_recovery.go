package main

import (
	"errors"
	"slices"
	"sync"

	"eidolon-server/internal/database"
)

type directTradeOperationStore interface {
	directTradeCharacterStore
	GetDirectTradeOperation(string) (*database.DirectTradeOperation, error)
	PrepareDirectTradeOperation(database.DirectTradeOperation) (*database.DirectTradeOperation, error)
	CompleteDirectTradeOperation(string, string) (*database.DirectTradeOperation, error)
	PendingDirectTradeOperations(string, int) ([]database.DirectTradeOperation, error)
}

var directTradeOperations directTradeOperationStore

// Index BOTH accounts before an insertion whose acknowledgement can be lost.
// Admission must include both work locks before calling recovery; it need not
// query the database on every ordinary movement/combat packet.
var directTradePending = struct {
	sync.RWMutex
	accounts map[string]pendingDirectTradeOperation
}{accounts: make(map[string]pendingDirectTradeOperation)}

type pendingDirectTradeOperation struct {
	op          database.DirectTradeOperation
	unconfirmed bool
}

func sameDirectTradeParticipants(first, second database.DirectTradeOperation) bool {
	return (first.Participants == second.Participants) ||
		(first.Participants[0] == second.Participants[1] && first.Participants[1] == second.Participants[0])
}

func trackDirectTradeOperationLocked(op database.DirectTradeOperation) (database.DirectTradeOperation, error) {
	if err := op.Validate(); err != nil {
		return op, err
	}
	directTradePending.Lock()
	defer directTradePending.Unlock()
	chosen := pendingDirectTradeOperation{op: op, unconfirmed: true}
	var existingFound bool
	for _, participant := range op.Participants {
		if existing, found := directTradePending.accounts[participant.Username]; found {
			if existing.op.ID != op.ID || !sameDirectTradeParticipants(existing.op, op) {
				return op, database.ErrDirectTradeBusy
			}
			if existingFound && existing.op.Fingerprint != chosen.op.Fingerprint {
				return op, database.ErrDirectTradeConflict
			}
			chosen = existing // Never replace an unknown first prepare with cancel.
			existingFound = true
		}
	}
	for _, participant := range chosen.op.Participants {
		directTradePending.accounts[participant.Username] = chosen
	}
	return chosen.op, nil
}

// A durable same-ID read wins over an unconfirmed proposal, but never rewrites
// an already confirmed first decision. Mark both accounts atomically.
func confirmDirectTradeOperationLocked(op database.DirectTradeOperation) error {
	if err := op.Validate(); err != nil {
		return err
	}
	directTradePending.Lock()
	defer directTradePending.Unlock()
	for _, participant := range op.Participants {
		if existing, found := directTradePending.accounts[participant.Username]; found {
			if existing.op.ID != op.ID || !sameDirectTradeParticipants(existing.op, op) || (!existing.unconfirmed && existing.op.Fingerprint != op.Fingerprint) {
				return database.ErrDirectTradeConflict
			}
		}
	}
	for _, participant := range op.Participants {
		directTradePending.accounts[participant.Username] = pendingDirectTradeOperation{op: op}
	}
	return nil
}

func forgetDirectTradeOperationLocked(op database.DirectTradeOperation) {
	directTradePending.Lock()
	defer directTradePending.Unlock()
	for _, participant := range op.Participants {
		if existing, found := directTradePending.accounts[participant.Username]; found && existing.op.ID == op.ID && existing.op.Fingerprint == op.Fingerprint {
			delete(directTradePending.accounts, participant.Username)
		}
	}
}

func pendingDirectTradeForAccount(username string) (pendingDirectTradeOperation, bool) {
	directTradePending.RLock()
	defer directTradePending.RUnlock()
	op, found := directTradePending.accounts[username]
	return op, found
}

// Caller holds BOTH globally sorted account work locks, including recovery.
// Freeze/re-read one shared intent, save each participant's private receipt,
// then let the store prove both durable receipts before completion. Delivery
// claiming is deliberately separate: failure/full bags must not undo settlement.
func prepareAndCompleteDirectTradeLocked(captured database.DirectTradeOperation) (*database.DirectTradeOperation, error) {
	if directTradeOperations == nil || characterSaveJournal == nil || characterSaveCommitter == nil {
		return nil, errors.New("direct trade recovery persistence unavailable")
	}
	if captured.State != database.DirectTradePending && captured.State != database.DirectTradeComplete {
		return nil, database.ErrDirectTradeConflict
	}
	for _, participant := range captured.Participants {
		if participant.CharacterName != participant.Username {
			return nil, database.ErrDirectTradeConflict // Current active-character identity is account-bound.
		}
	}
	captured, err := trackDirectTradeOperationLocked(captured)
	if err != nil {
		return nil, err
	}
	// Before freezing a decision, recover any offer whose bag/Gold debit has
	// not reached durable character storage. A RAM-only offer must never create
	// a shared intent that survives its only escrow copy after a restart.
	for _, participant := range captured.Participants {
		if err := reconcilePendingCharacterSaveLocked(participant.Username); err != nil {
			return nil, err
		}
	}
	op, err := directTradeOperations.GetDirectTradeOperation(captured.ID)
	if err != nil {
		return nil, err
	}
	if op == nil {
		entry, found := pendingDirectTradeForAccount(captured.Participants[0].Username)
		if captured.State != database.DirectTradePending || !found || !entry.unconfirmed {
			return nil, database.ErrDirectTradeConflict
		}
		for _, participant := range captured.Participants {
			character, err := directTradeOperations.GetDirectTradeCharacter(participant.Username, participant.CharacterName)
			if err != nil {
				return nil, err
			}
			if character == nil {
				return nil, database.ErrDirectTradeConflict
			}
			candidate := *character
			candidate.DirectTradeState = database.CloneDirectTradeState(character.DirectTradeState)
			changed, err := database.ApplyDirectTradeCharacterDecision(participant.Username, &candidate, captured)
			if err != nil || !changed {
				return nil, database.ErrDirectTradeConflict // Missing escrow or missing old intent, not a new plan.
			}
		}
		op, err = directTradeOperations.PrepareDirectTradeOperation(captured)
		if err != nil {
			return nil, err // Keep BOTH account fences for same-ID reconciliation.
		}
	}
	if op == nil || op.Validate() != nil || op.ID != captured.ID || op.TradeID != captured.TradeID || !sameDirectTradeParticipants(*op, captured) {
		return nil, database.ErrDirectTradeConflict
	}
	if err := confirmDirectTradeOperationLocked(*op); err != nil {
		return nil, err
	}
	// The durable first decision wins even if a later caller requested cancel.
	// Its account-bound offers/revisions must still be the exact captured custody.
	participants := slices.Clone(op.Participants[:])
	slices.SortFunc(participants, func(a, b database.DirectTradeParticipant) int {
		if a.Username < b.Username {
			return -1
		}
		return 1
	})
	if op.State == database.DirectTradePending {
		for _, participant := range participants {
			if err := applyAndSaveDirectTradeParticipantLocked(*op, participant, directTradeOperations); err != nil {
				return nil, err
			}
		}
		completed, err := directTradeOperations.CompleteDirectTradeOperation(op.ID, op.Fingerprint)
		if err != nil {
			return nil, err // Lost terminal ACK is resolved by reading the same ID.
		}
		if completed == nil || completed.Validate() != nil || completed.ID != op.ID || completed.Fingerprint != op.Fingerprint || completed.State != database.DirectTradeComplete || !sameDirectTradeParticipants(*completed, *op) {
			return nil, database.ErrDirectTradeConflict
		}
		op = completed
	}
	if world != nil {
		if _, err := world.RetireDurableDirectTrade(*op); err != nil {
			return nil, err
		}
	}
	forgetDirectTradeOperationLocked(*op)
	return op, nil
}

// Account admission calls this only after its work-lock set includes the cached
// peer. No nesting a peer's lock beneath an already-owned single-account lock.
func recoverAccountDirectTradesLocked(username string) error {
	if err := recoverAccountBossLootLocked(username); err != nil {
		return err
	}
	if err := recoverAccountDungeonRoomRewardsLocked(username); err != nil {
		return err
	}
	// Existing actor/peer admission resolves its own prior ground transfer too.
	if err := recoverAccountGroundItemLocked(username); err != nil {
		return err
	}
	entry, found := pendingDirectTradeForAccount(username)
	if !found {
		return nil
	}
	completed, err := prepareAndCompleteDirectTradeLocked(entry.op)
	if err != nil {
		return err
	}
	return finishDirectTradeDeliveryLocked(*completed)
}

// For startup/background callers with no account work locks already held.
// Re-read the immutable record after acquiring both locks, never execute only
// the earlier scan's snapshot or hold world/actor locks during persistence IO.
func recoverDirectTradeOperation(op database.DirectTradeOperation) error {
	if err := op.Validate(); err != nil {
		return err
	}
	unlock := lockCharactersWork(op.Participants[0].Username, op.Participants[1].Username)
	defer unlock()
	if err := confirmDirectTradeOperationLocked(op); err != nil {
		return err
	}
	_, err := prepareAndCompleteDirectTradeLocked(op)
	return err
}
