package main

import (
	"bytes"
	"sync/atomic"
)

const (
	transientBroadcastCapacity = 1024
	encounterBroadcastCapacity = 128
	maxTransientBroadcastBytes = 16 * 1024
	maxBroadcastSceneBytes     = 256
)

var transientBroadcastDropped atomic.Uint64
var encounterBroadcastDropped atomic.Uint64
var invalidBroadcastDropped atomic.Uint64

type broadcastQueueMetrics struct {
	Queued            int    `json:"queued"`
	Capacity          int    `json:"capacity"`
	EncounterQueued   int    `json:"encounterQueued"`
	EncounterCapacity int    `json:"encounterCapacity"`
	Dropped           uint64 `json:"dropped"`
	EncounterDropped  uint64 `json:"encounterDropped"`
	InvalidDropped    uint64 `json:"invalidDropped"`
}

func transientBroadcastMetrics() broadcastQueueMetrics {
	return broadcastQueueMetrics{Queued: len(broadcast), Capacity: cap(broadcast),
		EncounterQueued: len(encounterBroadcast), EncounterCapacity: cap(encounterBroadcast),
		Dropped: transientBroadcastDropped.Load(), EncounterDropped: encounterBroadcastDropped.Load(),
		InvalidDropped: invalidBroadcastDropped.Load()}
}

// Only lossy world presentation belongs here. Money, inventory, quest/reward
// acknowledgements and saves keep their independent durable/private paths.
// No goroutine waits for a busy hub, including when the caller holds World.Mu.
func enqueueTransientBroadcast(message BroadcastMessage) bool {
	if len(message.Data) == 0 || len(message.Data) > maxTransientBroadcastBytes || len(message.InstanceID) > maxBroadcastSceneBytes {
		invalidBroadcastDropped.Add(1)
		return false
	}
	var queue chan BroadcastMessage
	var dropped *atomic.Uint64
	switch message.Type {
	case MsgTelegraph, "raid_phase", "crystal_repair":
		queue, dropped = encounterBroadcast, &encounterBroadcastDropped
	case MsgAbility, MsgAttack, MsgDamage, MsgHeal, MsgProjectileImpact, MsgChat, "time", "public_event":
		queue, dropped = broadcast, &transientBroadcastDropped
	default:
		// New private/durable reply types cannot accidentally enter a lossy lane.
		invalidBroadcastDropped.Add(1)
		return false
	}
	if serverStopping.Load() || (cap(queue) > 0 && len(queue) >= cap(queue)) {
		dropped.Add(1)
		return false
	}
	// Own the bytes before asynchronous delivery. Skip this allocation when an
	// already-full queue is observed; concurrent contenders are still bounded
	// by the final non-blocking send below.
	message.Data = bytes.Clone(message.Data)
	select {
	case queue <- message:
		return true
	default:
		dropped.Add(1)
		return false
	}
}
