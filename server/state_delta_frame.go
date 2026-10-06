package main

import (
	"sync"

	"eidolon-server/internal/game"
)

// Only one broadcast's detached, immutable actors enter this cache. History
// snapshots are immutable and can be shared by recipients that queued the same
// actor. Different last-queued baselines must keep different change results.
// No world/actor snapshot or comparison is retained across broadcasts.
type stateDeltaFrame struct {
	mu      sync.Mutex
	entries map[*game.Entity]*stateDeltaFrameEntry
}

type stateDeltaFrameEntry struct {
	snapshot *EntitySnapshot
	changes  map[*EntitySnapshot]bool
}

// Caller holds frame.mu. Entries are keyed by detached actor identity, not a
// reusable player ID or a mutable live actor. No IO or delivery happens here.
func (frame *stateDeltaFrame) entry(actor *game.Entity) *stateDeltaFrameEntry {
	if frame.entries == nil {
		frame.entries = make(map[*game.Entity]*stateDeltaFrameEntry)
	}
	entry := frame.entries[actor]
	if entry == nil {
		entry = &stateDeltaFrameEntry{}
		frame.entries[actor] = entry
	}
	return entry
}

func (frame *stateDeltaFrame) snapshot(actor *game.Entity) *EntitySnapshot {
	frame.mu.Lock()
	defer frame.mu.Unlock()
	entry := frame.entry(actor)
	if entry.snapshot == nil {
		entry.snapshot = entityToSnapshot(actor)
	}
	return entry.snapshot
}

func (frame *stateDeltaFrame) changed(actor *game.Entity, last *EntitySnapshot) bool {
	frame.mu.Lock()
	defer frame.mu.Unlock()
	entry := frame.entry(actor)
	if changed, ok := entry.changes[last]; ok {
		return changed
	}
	changed := hasEntityChanged(actor, last)
	if entry.changes == nil {
		entry.changes = make(map[*EntitySnapshot]bool)
	}
	entry.changes[last] = changed
	return changed
}
