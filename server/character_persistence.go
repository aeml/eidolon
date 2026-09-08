package main

import (
	"errors"
	"log"
	"sort"
	"sync"

	"eidolon-server/internal/database"
)

type characterCommitter interface {
	CommitCharacterSave(string, *database.Character, string) error
}

var characterSaveJournal *database.CharacterSaveJournal
var characterSaveCommitter characterCommitter
var failedCharacterSaves = struct {
	sync.Mutex
	users map[string]bool
}{users: make(map[string]bool)}

func noteCharacterSaveFailure(username string, failed bool) {
	failedCharacterSaves.Lock()
	defer failedCharacterSaves.Unlock()
	if failed {
		failedCharacterSaves.users[username] = true
	} else {
		delete(failedCharacterSaves.users, username)
	}
}

// All callers hold the per-account work lock. Journal before the database;
// acknowledge only after its atomic save receipt is confirmed.
func persistCharacterSnapshot(username string, character *database.Character) error {
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		return errors.New("character persistence is not initialized")
	}
	// Pin before filesystem IO: an expiry sweep must not remove the last live
	// copy while a slow/failed local write is still in flight.
	if world != nil {
		world.SetEntityUnjournaledSave("player-"+username, true)
	}
	pending, err := characterSaveJournal.Write(username, character)
	if world != nil {
		world.SetEntityUnjournaledSave("player-"+username, err != nil)
	}
	if err == nil {
		err = commitPendingCharacterSave(pending)
	}
	noteCharacterSaveFailure(username, err != nil)
	if err != nil {
		log.Printf("Character save pending for %s: %v", username, err)
	}
	return err
}

func commitPendingCharacterSave(pending *database.PendingCharacterSave) error {
	character, err := pending.Character()
	if err != nil {
		return err
	}
	if err := characterSaveCommitter.CommitCharacterSave(pending.Username, character, pending.SaveID); err != nil {
		return err
	}
	if err := characterSaveJournal.Acknowledge(pending.Username, pending.SaveID); err != nil {
		// Mongo has confirmed this exact receipt. A remaining file is safe to
		// replay idempotently; a failed directory sync after removal must not
		// falsely classify the confirmed database state as missing forever.
		log.Printf("Committed character journal cleanup pending for %s: %v", pending.Username, err)
	}
	return nil
}

// Prefer a newer live entity over an older pending record. If it has expired,
// the durable complete snapshot is replayed before any stale database hydration.
// Caller holds the account work lock; never call with the global hub lock.
func retryPendingCharacterSaveLocked(username string) error {
	if characterSaveJournal == nil {
		return nil
	}
	if world != nil {
		if entity := world.GetEntityCopy("player-" + username); entity != nil {
			return saveCharacterDB(&Client{username: username, playerID: entity.ID}, entity)
		}
	}
	pending, err := characterSaveJournal.Read(username)
	if err != nil {
		return err
	}
	if pending == nil {
		failedCharacterSaves.Lock()
		missing := failedCharacterSaves.users[username]
		failedCharacterSaves.Unlock()
		if missing {
			return errors.New("latest character save unavailable; refusing stale hydration")
		}
		return nil
	}
	err = commitPendingCharacterSave(pending)
	noteCharacterSaveFailure(username, err != nil)
	return err
}

func retryPendingCharacterSaves() error {
	if characterSaveJournal == nil {
		return nil
	}
	users, err := characterSaveJournal.PendingUsers()
	if err != nil {
		return err
	}
	unique := make(map[string]bool, len(users))
	for _, user := range users {
		unique[user] = true
	}
	failedCharacterSaves.Lock()
	for user := range failedCharacterSaves.users {
		unique[user] = true
	}
	failedCharacterSaves.Unlock()
	users = users[:0]
	for user := range unique {
		users = append(users, user)
	}
	sort.Strings(users)
	var failures []error
	for _, user := range users {
		unlock := lockCharacterWork(user)
		err := retryPendingCharacterSaveLocked(user)
		unlock()
		if err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}
