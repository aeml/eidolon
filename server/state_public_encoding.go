package main

import (
	"sync"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
)

// One broadcast owns this cache and its detached, immutable world snapshots.
// Public messages are immutable after encoding and may be marshaled concurrently.
// Never cache an owner's private message, and never retain entries across frames.
type publicFrameEncoding struct {
	mu       sync.RWMutex
	entries  map[*game.Entity]*publicFrameEntry
	prepared bool
}

type publicFrameEntry struct {
	mu      sync.Mutex
	encoded *statepb.Entity
}

func (frame *publicFrameEncoding) entry(actor *game.Entity) *publicFrameEntry {
	if frame.prepared {
		if entry := frame.entries[actor]; entry != nil {
			return entry
		}
		return &publicFrameEntry{} // Never write to a prepared frame's map.
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
		frame.entries = make(map[*game.Entity]*publicFrameEntry)
	}
	entry = frame.entries[actor]
	if entry == nil {
		entry = &publicFrameEntry{}
		frame.entries[actor] = entry
	}
	return entry
}

func (frame *publicFrameEncoding) forRecipient(actor *game.Entity, recipient string) *statepb.Entity {
	if actor == nil {
		return nil
	}
	actor.Mu.RLock()
	owner := actor.Type == game.TypePlayer && recipient != "" && actor.ID == recipient
	actor.Mu.RUnlock()
	if owner {
		return entityToProtoForRecipient(actor, recipient)
	}
	// Independent actors can encode concurrently; only duplicate work for the
	// same detached actor is serialized. Owners still bypass the public cache.
	entry := frame.entry(actor)
	entry.mu.Lock()
	defer entry.mu.Unlock()
	if entry.encoded == nil {
		entry.encoded = entityToProtoForRecipient(actor, "")
	}
	return entry.encoded
}
