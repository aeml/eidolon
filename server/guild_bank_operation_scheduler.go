package main

import (
	"errors"
	"sort"
	"sync"

	"eidolon-server/internal/database"
)

// Admission reads this account-local index, never Mongo on every game packet.
// A confirmed terminal intent stays indexed until its guild hold is released.
var guildBankPending = struct {
	sync.RWMutex
	accounts map[string]map[string]pendingGuildBankOperation
}{accounts: make(map[string]map[string]pendingGuildBankOperation)}

type pendingGuildBankOperation struct {
	op          database.GuildBankOperation
	unconfirmed bool
}

var guildBankRetryMu sync.Mutex

func trackGuildBankOperation(op database.GuildBankOperation, unconfirmed bool) {
	if op.Username == "" || op.ID == "" {
		return
	}
	guildBankPending.Lock()
	defer guildBankPending.Unlock()
	if guildBankPending.accounts[op.Username] == nil {
		guildBankPending.accounts[op.Username] = make(map[string]pendingGuildBankOperation)
	}
	if previous, exists := guildBankPending.accounts[op.Username][op.ID]; exists && !previous.unconfirmed && unconfirmed {
		return // A lost retry acknowledgement cannot weaken confirmed ownership.
	}
	op.ItemPayload = "" // Only the durable first plan can provide execution data.
	guildBankPending.accounts[op.Username][op.ID] = pendingGuildBankOperation{op: op, unconfirmed: unconfirmed}
}

func forgetGuildBankOperation(op database.GuildBankOperation) {
	guildBankPending.Lock()
	defer guildBankPending.Unlock()
	delete(guildBankPending.accounts[op.Username], op.ID)
	if len(guildBankPending.accounts[op.Username]) == 0 {
		delete(guildBankPending.accounts, op.Username)
	}
}

// Caller owns account work. No financial effect precedes confirmed preparation.
func prepareGuildBankOperationLocked(op database.GuildBankOperation) (*database.GuildBankOperation, error) {
	if guildBankOperations == nil {
		return nil, errors.New("guild bank recovery storage unavailable")
	}
	if err := op.Validate(); err != nil {
		return nil, err
	}
	if op.State != database.GuildBankPending || op.CharacterName != op.Username {
		return nil, errors.New("guild bank preparation requires the active character's pending intent")
	}
	stored, err := guildBankOperations.PrepareGuildBankOperation(op)
	if err != nil {
		if !errors.Is(err, database.ErrGuildBankOperationConflict) && !errors.Is(err, database.ErrGuildBankOperationBusy) &&
			!errors.Is(err, database.ErrGuildBankOperationRejected) && !errors.Is(err, database.ErrGuildBankOperationStale) {
			trackGuildBankOperation(op, true)
		}
		return nil, err
	}
	if stored == nil || stored.ID != op.ID || stored.Username != op.Username || stored.Fingerprint != op.Fingerprint {
		trackGuildBankOperation(op, true)
		return nil, errors.New("guild bank preparation remains unconfirmed")
	}
	if err := stored.Validate(); err != nil {
		trackGuildBankOperation(op, true)
		return nil, err
	}
	trackGuildBankOperation(*stored, false)
	return stored, nil
}

// Caller owns this account's work lock, including during login/join/resume.
func recoverAccountGuildBankOperationsLocked(username string) error {
	guildBankPending.RLock()
	entries := make([]pendingGuildBankOperation, 0, len(guildBankPending.accounts[username]))
	for _, entry := range guildBankPending.accounts[username] {
		entries = append(entries, entry)
	}
	guildBankPending.RUnlock()
	sort.Slice(entries, func(i, j int) bool { return entries[i].op.ID < entries[j].op.ID })
	for _, entry := range entries {
		if err := recoverCachedGuildBankOperationLocked(entry); err != nil {
			return err
		}
	}
	return nil
}

func recoverCachedGuildBankOperationLocked(entry pendingGuildBankOperation) error {
	if guildBankOperations == nil {
		return errors.New("pending guild bank recovery storage unavailable")
	}
	stored, err := guildBankOperations.GetGuildBankOperation(entry.op.ID)
	if err != nil {
		return err
	}
	if stored == nil {
		if !entry.unconfirmed {
			return errors.New("confirmed guild bank intent is missing; refusing character work")
		}
		forgetGuildBankOperation(entry.op) // Unconfirmed insertion had no effects.
		return nil
	}
	if stored.Username != entry.op.Username || stored.Fingerprint != entry.op.Fingerprint {
		return database.ErrGuildBankOperationConflict
	}
	trackGuildBankOperation(*stored, false)
	completed, err := completeGuildBankOperationLocked(*stored)
	if err != nil {
		return err
	}
	if completed == nil || (completed.State != database.GuildBankComplete && completed.State != database.GuildBankRejected) {
		return errors.New("guild bank recovery remains pending")
	}
	forgetGuildBankOperation(*completed)
	if client := getClientByPlayerID(completed.PlayerID); client != nil {
		client.sendGuildBankResult(guildBankSettlementResult(*completed))
	}
	refreshGuildBankSettlement(*completed)
	return nil
}

func recoverPendingGuildBankOperations() error   { return recoverGuildBankBatches(false) }
func recoverGuildBankOperationsOnStartup() error { return recoverGuildBankBatches(true) }

func recoverGuildBankBatches(drain bool) error {
	if guildBankOperations == nil {
		return errors.New("guild bank recovery storage unavailable")
	}
	guildBankRetryMu.Lock()
	defer guildBankRetryMu.Unlock()
	for {
		if !drain && serverStopping.Load() {
			return nil
		}
		operations, err := guildBankOperations.PendingGuildBankOperations("", 50)
		if err != nil {
			return err
		}
		entries := make([]pendingGuildBankOperation, 0, 50)
		seen := make(map[string]bool)
		for _, op := range operations {
			if len(entries) == 50 {
				break
			}
			if !seen[op.ID] {
				trackGuildBankOperation(op, false)
				entries = append(entries, pendingGuildBankOperation{op: op})
				seen[op.ID] = true
			}
		}
		// A crash after terminal completion but before hold release is absent
		// from the pending-intent index; discover those holds independently.
		if len(entries) < 50 {
			ids, err := guildBankOperations.ReservedGuildBankOperationIDs(50)
			if err != nil {
				return err
			}
			for _, id := range ids {
				if len(entries) == 50 {
					break
				}
				if seen[id] {
					continue
				}
				op, err := guildBankOperations.GetGuildBankOperation(id)
				if err != nil {
					return err
				}
				if op == nil {
					return errors.New("reserved guild bank intent is missing")
				}
				trackGuildBankOperation(*op, false)
				entries = append(entries, pendingGuildBankOperation{op: *op})
				seen[id] = true
			}
		}
		// Ambiguous insertions and lost terminal replies need recovery even
		// when neither durable query lists them. Copy without holding cache
		// locks across account acquisition or database IO.
		guildBankPending.RLock()
	outer:
		for _, account := range guildBankPending.accounts {
			for id, entry := range account {
				if len(entries) == 50 {
					break outer
				}
				if !seen[id] {
					entries = append(entries, entry)
					seen[id] = true
				}
			}
		}
		guildBankPending.RUnlock()
		for _, entry := range entries {
			unlock := lockCharacterWork(entry.op.Username)
			err := recoverCachedGuildBankOperationLocked(entry)
			unlock()
			if err != nil {
				return err // One storage outage, not fifty serial timeouts.
			}
		}
		if !drain || len(entries) == 0 {
			return nil
		}
	}
}
