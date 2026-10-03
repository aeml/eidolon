package main

import (
	"errors"
	"slices"
	"sort"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

var groundItemRecoveryPass = struct {
	sync.Mutex
	cacheAfter, storeAfter string
}{}

func recoverStoredGroundItem(record database.GroundItemRecord) error {
	if record.Validate() != nil || record.State != database.GroundItemPending {
		return database.ErrGroundItemConflict
	}
	unlock := lockCharacterWork(record.Username)
	defer unlock()
	current, err := groundItemOperations.GetGroundItemOperation(record.ID)
	if err != nil {
		return err
	}
	if current == nil || current.Validate() != nil || current.Fingerprint != record.Fingerprint {
		return database.ErrGroundItemConflict
	}
	if current.State == database.GroundItemComplete {
		if entry, found := pendingGroundItemForAccount(record.Username); !found || entry.op.ID != record.ID {
			return nil // Scan went stale; never register an already retired intent.
		}
	}
	if err := trackGroundItemLocked(record.GroundItemOperation, true); err != nil {
		return err
	}
	_, err = prepareAndCompleteGroundItemLocked(record.GroundItemOperation)
	if err == nil && world != nil {
		sendInventoryForPlayer(record.PlayerID)
	}
	return err
}

// Before admission, drain ALL pending pages. Full bags retain their accepted
// reserved pickup but may log in to free space; no first-page retry loop.
// Then restore the active latest generations, including pending reservations.
func recoverGroundItemsOnStartup() error {
	if groundItemOperations == nil {
		return errors.New("ground item recovery storage unavailable")
	}
	after := ""
	for {
		page, err := groundItemOperations.PendingGroundItemOperations("", after, 50)
		if err != nil {
			return err
		}
		if len(page) == 0 {
			break
		}
		for _, record := range page {
			if record.ID <= after {
				return database.ErrGroundItemConflict
			}
			after = record.ID
			if err := recoverStoredGroundItem(record); err != nil && !errors.Is(err, game.ErrGroundItemFull) {
				return err
			}
		}
	}
	after = ""
	for {
		page, err := groundItemOperations.GroundItemProjectionPage(after, time.Now(), 50)
		if err != nil {
			return err
		}
		if len(page) == 0 {
			return nil
		}
		for _, record := range page {
			if record.LootID <= after {
				return database.ErrGroundItemConflict
			}
			after = record.LootID
			// Re-read rather than restore a scan snapshot if custody advanced.
			latest, err := groundItemOperations.LatestGroundItemOperation(record.LootID)
			if err != nil {
				return err
			}
			if latest == nil || latest.Generation < record.Generation {
				return database.ErrGroundItemConflict
			}
			if err := restoreGroundItemRecord(*latest); err != nil {
				return err
			}
		}
	}
}

// One bounded pass; cursor rotation lets other accounts progress when a save
// or full bag keeps the earliest IDs pending. Include unknown prepares not yet
// returned by storage. Never start redundant passes during slow persistence.
func recoverPendingGroundItems() error {
	if groundItemOperations == nil || !groundItemRecoveryPass.TryLock() {
		return nil
	}
	defer groundItemRecoveryPass.Unlock()
	groundItemPending.RLock()
	entries := make(map[string]pendingGroundItem, len(groundItemPending.accounts))
	for _, entry := range groundItemPending.accounts {
		entries[entry.op.ID] = entry
	}
	groundItemPending.RUnlock()
	ids := make([]string, 0, len(entries))
	for id := range entries {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	start := sort.Search(len(ids), func(index int) bool { return ids[index] > groundItemRecoveryPass.cacheAfter })
	if start == len(ids) {
		start = 0
	}
	var failures []error
	seen := map[string]bool{}
	for _, id := range ids[start:min(start+10, len(ids))] {
		entry := entries[id]
		unlock := lockCharacterWork(entry.op.Username)
		current, found := pendingGroundItemForAccount(entry.op.Username)
		if !found || current.op.ID != entry.op.ID || current.op.Fingerprint != entry.op.Fingerprint {
			unlock()
			seen[id], groundItemRecoveryPass.cacheAfter = true, id
			continue // A rejected/retired snapshot cannot recreate an old proposal.
		}
		_, err := prepareAndCompleteGroundItemLocked(entry.op)
		if err == nil && world != nil {
			sendInventoryForPlayer(entry.op.PlayerID)
		}
		unlock()
		if err != nil && !errors.Is(err, game.ErrGroundItemFull) {
			failures = append(failures, err)
		}
		seen[id], groundItemRecoveryPass.cacheAfter = true, id
	}
	page, err := groundItemOperations.PendingGroundItemOperations("", groundItemRecoveryPass.storeAfter, 10)
	if err == nil && len(page) == 0 && groundItemRecoveryPass.storeAfter != "" {
		groundItemRecoveryPass.storeAfter = ""
		page, err = groundItemOperations.PendingGroundItemOperations("", "", 10)
	}
	if err != nil {
		return errors.Join(append(failures, err)...)
	}
	for _, record := range page {
		if record.ID <= groundItemRecoveryPass.storeAfter {
			failures = append(failures, database.ErrGroundItemConflict)
			break
		}
		groundItemRecoveryPass.storeAfter = record.ID
		if seen[record.ID] {
			continue
		}
		if err := recoverStoredGroundItem(record); err != nil && !errors.Is(err, game.ErrGroundItemFull) {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}
