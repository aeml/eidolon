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
	mu       sync.RWMutex
	entries  map[*game.Entity]*stateDeltaFrameEntry
	prepared bool
}

// Freeze membership before starting recipient workers. The detached recipient
// maps cannot change during this broadcast, so hot lookups need no frame lock.
// Preparation does not encode or cache any owner's private message.
func newBroadcastFrameCaches(states map[string]map[string]*game.Entity) (*publicFrameEncoding, *stateDeltaFrame) {
	public := &publicFrameEncoding{entries: make(map[*game.Entity]*publicFrameEntry), prepared: true}
	delta := &stateDeltaFrame{entries: make(map[*game.Entity]*stateDeltaFrameEntry), prepared: true}
	for _, state := range states {
		for _, actor := range state {
			if actor == nil || delta.entries[actor] != nil {
				continue
			}
			delta.entries[actor] = &stateDeltaFrameEntry{}
			public.entries[actor] = &publicFrameEntry{}
		}
	}
	return public, delta
}

type stateDeltaFrameEntry struct {
	mu       sync.Mutex
	snapshot *EntitySnapshot
	changes  map[*EntitySnapshot]bool
}

// The frame lock protects only membership, never actor work. Entries are keyed
// by detached actor identity, not a reusable player ID or mutable live actor.
func (frame *stateDeltaFrame) entry(actor *game.Entity) *stateDeltaFrameEntry {
	if frame.prepared {
		if entry := frame.entries[actor]; entry != nil {
			return entry
		}
		// A foreign snapshot must not mutate frozen membership or borrow an ID.
		return &stateDeltaFrameEntry{}
	}
	frame.mu.RLock()
	entry := frame.entries[actor]
	frame.mu.RUnlock()
	if entry != nil {
		return entry
	}
	frame.mu.Lock()
	defer frame.mu.Unlock()
	if frame.entries == nil {
		frame.entries = make(map[*game.Entity]*stateDeltaFrameEntry)
	}
	entry = frame.entries[actor]
	if entry == nil {
		entry = &stateDeltaFrameEntry{}
		frame.entries[actor] = entry
	}
	return entry
}

func (frame *stateDeltaFrame) snapshot(actor *game.Entity) *EntitySnapshot {
	entry := frame.entry(actor)
	entry.mu.Lock()
	defer entry.mu.Unlock()
	if entry.snapshot == nil {
		entry.snapshot = entityToSnapshot(actor)
	}
	return entry.snapshot
}

func (frame *stateDeltaFrame) changed(actor *game.Entity, last *EntitySnapshot) bool {
	entry := frame.entry(actor)
	entry.mu.Lock()
	defer entry.mu.Unlock()
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
