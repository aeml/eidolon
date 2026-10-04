package main

import (
	"errors"
	"log"
	"sort"
	"sync"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type characterCommitter interface {
	CommitCharacterSave(string, *database.Character, string) error
}

type boundCharacterCommitter interface {
	CommitBoundCharacterSave(primitive.ObjectID, string, *database.Character, string) error
}

var characterSaveJournal *database.CharacterSaveJournal
var characterSaveCommitter characterCommitter

// Enabled by the production entry point before replay/admission. Old fixture
// writers may exercise compatibility, but no running server can opt into it.
var requireBoundCharacterSaves bool
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

// Caller owns the account work lock. Reconcile a prior durable snapshot before
// any new operation or offline hydration can act on older database state.
func reconcilePendingCharacterSaveLocked(username string) error {
	_, err := reconcilePendingCharacterSaveWithStatusLocked(username)
	return err
}

// Reports whether this command had to settle a previous uncertain post-image.
// Random purchases can then resynchronize without treating a recovery attempt
// as consent to pay for another roll. The caller still owns the account lock.
func reconcilePendingCharacterSaveWithStatusLocked(username string) (bool, error) {
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		return false, errors.New("character persistence unavailable")
	}
	pending, err := characterSaveJournal.Read(username)
	if err != nil {
		return false, err
	}
	failedCharacterSaves.Lock()
	failed := failedCharacterSaves.users[username]
	failedCharacterSaves.Unlock()
	if pending != nil || failed {
		return true, retryPendingCharacterSaveLocked(username)
	}
	return false, nil
}

// All callers hold the per-account work lock. Journal before the database;
// acknowledge only after its atomic save receipt is confirmed.
func persistCharacterSnapshot(username string, character *database.Character) error {
	pending, err := journalCharacterSnapshot(username, character)
	if err == nil {
		err = commitPendingCharacterSave(pending)
	}
	noteCharacterSaveFailure(username, err != nil)
	if err != nil {
		log.Printf("Character save pending for %s: %v", username, err)
	}
	return err
}

// Also used for the shutdown journal-all-before-database pass. A slow database
// must not prevent the remaining characters from reaching durable local storage.
func journalCharacterSnapshot(username string, character *database.Character) (snapshot *database.PendingCharacterSave, resultErr error) {
	defer func() { recordOperationalResult(boundaryCharacterJournal, resultErr) }()
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		return nil, errors.New("character persistence is not initialized")
	}
	// Pin before filesystem IO: an expiry sweep must not remove the last live
	// copy while a slow/failed local write is still in flight.
	if world != nil {
		world.SetEntityUnjournaledSave("player-"+username, true)
	}
	var pending *database.PendingCharacterSave
	var err error
	if character == nil {
		err = errors.New("character snapshot required")
	} else if !character.AccountID.IsZero() {
		pending, err = characterSaveJournal.WriteForAccount(character.AccountID, username, character)
	} else if requireBoundCharacterSaves {
		err = errors.New("character snapshot account identity missing; refusing unbound save")
	} else {
		pending, err = characterSaveJournal.Write(username, character)
	}
	if world != nil {
		world.SetEntityUnjournaledSave("player-"+username, err != nil)
	}
	return pending, err
}

func commitPendingCharacterSave(pending *database.PendingCharacterSave) error {
	if pending == nil {
		return errors.New("character journal record required")
	}
	character, err := pending.Character()
	if err != nil {
		return err
	}
	if pending.Version == 2 && !pending.AccountID.IsZero() {
		bound, ok := characterSaveCommitter.(boundCharacterCommitter)
		if !ok {
			return errors.New("bound character commit unavailable; preserving journal")
		}
		err = bound.CommitBoundCharacterSave(pending.AccountID, pending.Username, character, pending.SaveID)
	} else if pending.Version == 1 && pending.AccountID.IsZero() {
		if requireBoundCharacterSaves {
			return errors.New("legacy character journal requires controlled transition; preserving file")
		}
		err = characterSaveCommitter.CommitCharacterSave(pending.Username, character, pending.SaveID)
	} else {
		return errors.New("invalid character journal identity version")
	}
	recordOperationalResult(boundaryCharacterCommit, err)
	if err != nil {
		return err
	}
	cleanupErr := characterSaveJournal.Acknowledge(pending.Username, pending.SaveID)
	recordOperationalResult(boundaryCharacterCleanup, cleanupErr)
	if cleanupErr != nil {
		// Mongo has confirmed this exact receipt. A remaining file is safe to
		// replay idempotently; a failed directory sync after removal must not
		// falsely classify the confirmed database state as missing forever.
		log.Printf("Committed character journal cleanup pending for %s: %v", pending.Username, cleanupErr)
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
		client := getClientByPlayerID("player-" + username)
		questSequence := questProgressSaveSequence(client)
		if entity := world.GetEntityCopy("player-" + username); entity != nil {
			err := saveCharacterDB(&Client{username: username, playerID: entity.ID}, entity)
			if err == nil {
				sendSavedQuestProgress(client, questSequence, entity.Quests)
			}
			return err
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

func retryPendingCharacterSaves() (resultErr error) {
	defer func() { recordOperationalResult(boundaryCharacterRecovery, resultErr) }()
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
