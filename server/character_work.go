package main

import (
	"eidolon-server/internal/lifecycle"
	"slices"
	"sync"
)

// Serialize a character's handoff, commands and persistence without holding the
// shared sessions/hub lock during IO. Entries exist only while in use/queued.
type characterWorkEntry struct {
	mu    sync.Mutex
	users int
}

var characterWork = struct {
	sync.Mutex
	entries map[string]*characterWorkEntry
}{entries: make(map[string]*characterWorkEntry)}
var backgroundCharacterWork = &lifecycle.Group{}

// Acquire all accounts in one global order. Call this instead of nesting
// lockCharacterWork when an operation touches another player (for example an
// administrator teleport). No character lock may already be held by the caller.
// Duplicate/self targets take one lock; unrelated accounts remain independent.
func lockCharactersWork(usernames ...string) func() {
	accounts := slices.Clone(usernames)
	slices.Sort(accounts)
	accounts = slices.Compact(accounts)
	releases := make([]func(), 0, len(accounts))
	for _, account := range accounts {
		if account != "" {
			releases = append(releases, lockCharacterWork(account))
		}
	}
	return func() {
		for i := len(releases) - 1; i >= 0; i-- {
			releases[i]()
		}
	}
}

func lockCharacterWork(username string) func() {
	characterWork.Lock()
	entry := characterWork.entries[username]
	if entry == nil {
		entry = &characterWorkEntry{}
		characterWork.entries[username] = entry
	}
	entry.users++
	characterWork.Unlock()
	entry.mu.Lock()
	return func() {
		entry.mu.Unlock()
		characterWork.Lock()
		entry.users--
		if entry.users == 0 {
			delete(characterWork.entries, username)
		}
		characterWork.Unlock()
	}
}

func scheduleCharacterWork(work func()) {
	backgroundCharacterWork.Go(work)
}

// Caller holds character work lock. A stale socket may neither issue commands
// nor mark/save the entity now owned by a newer connection.
func currentCharacterConnection(client *Client) bool {
	if client == nil || client.retired.Load() {
		return false
	}
	sessionsMu.Lock()
	owner := activeSessions[client.username]
	sessionsMu.Unlock()
	return owner == nil || owner == client
}
