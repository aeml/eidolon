package main

import (
	"errors"
	"sort"
	"sync"

	"eidolon-server/internal/database"
)

// Ordinary commands consult only this small in-process pending index. Never
// query Mongo per movement/combat packet. Startup drains durable operations
// before admission; preparation adds new intents before attempting any effect.
var adminPending = struct {
	sync.RWMutex
	accounts map[string]map[string]pendingAdminOperation
}{accounts: make(map[string]map[string]pendingAdminOperation)}

type pendingAdminOperation struct {
	op          database.AdminOperation
	unconfirmed bool
}

var adminOperationRetryMu sync.Mutex

func trackAdminOperation(op database.AdminOperation) {
	trackAdminOperationDecision(op, false)
}

func trackAdminOperationDecision(op database.AdminOperation, unconfirmed bool) {
	if op.Target == "" || op.State == database.AdminOperationComplete || op.Audit.Result != "success" {
		return // An unauthorised attempt must not block the named victim's gameplay.
	}
	adminPending.Lock()
	defer adminPending.Unlock()
	if adminPending.accounts[op.Target] == nil {
		adminPending.accounts[op.Target] = make(map[string]pendingAdminOperation)
	}
	if existing, found := adminPending.accounts[op.Target][op.ID]; found && !existing.unconfirmed && unconfirmed {
		return // An uncertain retry cannot weaken an already-confirmed intent.
	}
	op.Payload = nil // Recovery always fetches the durable first plan, never a cached roll.
	adminPending.accounts[op.Target][op.ID] = pendingAdminOperation{op: op, unconfirmed: unconfirmed}
}

func forgetAdminOperation(op database.AdminOperation) {
	adminPending.Lock()
	defer adminPending.Unlock()
	delete(adminPending.accounts[op.Target], op.ID)
	if len(adminPending.accounts[op.Target]) == 0 {
		delete(adminPending.accounts, op.Target)
	}
}

// Caller owns actor and target work locks and has freshly authorised the action.
// An ambiguous insertion error is cached too: before gameplay can continue we
// resolve whether the intent exists, rather than assume the write failed.
func prepareAdminOperationLocked(op database.AdminOperation) (*database.AdminOperation, error) {
	if adminOperations == nil {
		return nil, errors.New("administration operation storage unavailable")
	}
	if err := op.Validate(); err != nil {
		return nil, err
	}
	stored, err := adminOperations.PrepareAdminOperation(op)
	if err != nil {
		if !errors.Is(err, database.ErrAdminOperationConflict) {
			trackAdminOperationDecision(op, true)
		}
		return nil, err
	}
	if stored == nil {
		trackAdminOperationDecision(op, true)
		return nil, errors.New("administration operation preparation returned no decision")
	}
	trackAdminOperation(*stored)
	return stored, nil
}

// The caller holds this exact account's work lock, including during join/resume.
// Recovery finishes an already-authorised durable intent; role revocation never
// discards an effect already committed to a character or its required audit.
func recoverAccountAdminOperationsLocked(username string) error {
	adminPending.RLock()
	operations := make([]pendingAdminOperation, 0, len(adminPending.accounts[username]))
	for _, op := range adminPending.accounts[username] {
		operations = append(operations, op)
	}
	adminPending.RUnlock()
	if len(operations) == 0 {
		return nil
	}
	if adminOperations == nil {
		return errors.New("pending administration operation storage unavailable")
	}
	sort.Slice(operations, func(i, j int) bool { return operations[i].op.ID < operations[j].op.ID })
	for _, entry := range operations {
		if err := recoverCachedAdminOperationLocked(entry); err != nil {
			return err
		}
	}
	return nil
}

func recoverCachedAdminOperationLocked(entry pendingAdminOperation) error {
	cached := entry.op
	stored, err := adminOperations.GetAdminOperation(cached.ID)
	if err != nil {
		return err
	}
	if stored == nil {
		if !entry.unconfirmed {
			return errors.New("confirmed administration intent is missing; refusing unaudited character work")
		}
		// No mutation can precede a confirmed insertion. A genuinely failed
		// prepare has nothing to replay; a confirmed but missing intent is fatal.
		forgetAdminOperation(cached)
		return nil
	}
	if stored.Target != cached.Target || stored.Fingerprint != cached.Fingerprint {
		return database.ErrAdminOperationConflict
	}
	completed, err := completeAdminOperationLocked(*stored)
	if err != nil {
		return err
	}
	if completed == nil || completed.State != database.AdminOperationComplete {
		return errors.New("administration operation remains pending")
	}
	forgetAdminOperation(*completed)
	return nil
}

func recoverPendingAdminOperations() error   { return recoverAdminOperationBatches(false) }
func recoverAdminOperationsOnStartup() error { return recoverAdminOperationBatches(true) }

func recoverAdminOperationBatches(drain bool) error {
	if adminOperations == nil {
		return errors.New("administration operation storage unavailable")
	}
	adminOperationRetryMu.Lock()
	defer adminOperationRetryMu.Unlock()
	for {
		if !drain && serverStopping.Load() {
			return nil
		}
		operations, err := adminOperations.PendingAdminOperations("", 50)
		if err != nil {
			return err
		}
		if len(operations) == 0 {
			// Ambiguous failed inserts and lost completion replies do not appear
			// in Mongo's pending queue. Resolve up to one batch of cached identities
			// too, without requiring the affected player to reconnect or retry.
			var cached []pendingAdminOperation
			adminPending.RLock()
		outer:
			for _, account := range adminPending.accounts {
				for _, entry := range account {
					cached = append(cached, entry)
					if len(cached) == 50 {
						break outer
					}
				}
			}
			adminPending.RUnlock()
			for _, entry := range cached {
				unlock := lockCharacterWork(entry.op.Target)
				err := recoverCachedAdminOperationLocked(entry)
				unlock()
				if err != nil {
					return err
				}
			}
			if !drain || len(cached) == 0 {
				return nil
			}
			continue
		}
		for _, op := range operations {
			trackAdminOperation(op)
		}
		for _, op := range operations {
			// No shared cache/world/session mutex spans the account lock or IO.
			unlock := lockCharactersWork(op.Target)
			completed, err := completeAdminOperationLocked(op)
			if err == nil && (completed == nil || completed.State != database.AdminOperationComplete) {
				err = errors.New("administration recovery did not complete")
			}
			if err == nil {
				forgetAdminOperation(op)
			}
			unlock()
			if err != nil {
				return err // One outage causes one failure, not fifty timeouts.
			}
		}
		if !drain {
			return nil // Bounded runtime pass; startup drains every batch.
		}
	}
}
