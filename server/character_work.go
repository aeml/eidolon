package main

import (
	"eidolon-server/internal/lifecycle"
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
