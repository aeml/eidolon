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
	mu       sync.Mutex
	entities map[*game.Entity]*statepb.Entity
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
	frame.mu.Lock()
	defer frame.mu.Unlock()
	if encoded := frame.entities[actor]; encoded != nil {
		return encoded
	}
	encoded := entityToProtoForRecipient(actor, "")
	if frame.entities == nil {
		frame.entities = make(map[*game.Entity]*statepb.Entity)
	}
	frame.entities[actor] = encoded
	return encoded
}
