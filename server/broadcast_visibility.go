package main

import "math"

// Shared by actor snapshots and local effect interest. Keep warning/impact
// footprints visible when their edge overlaps the actor view circle.
const stateBroadcastRadius = 200.0

func broadcastRequiresFootprint(message BroadcastMessage) bool {
	return message.Type == MsgTelegraph || message.Type == MsgProjectileImpact
}

func broadcastFootprintVisible(message BroadcastMessage, x, z float64) bool {
	f := message.Footprint
	if !f.Present || !finiteBroadcastCoordinate(f.X) || !finiteBroadcastCoordinate(f.Z) ||
		!finiteBroadcastCoordinate(f.Radius) || f.Radius < 0 ||
		!finiteBroadcastCoordinate(x) || !finiteBroadcastCoordinate(z) {
		return false
	}
	return math.Hypot(f.X-x, f.Z-z) <= stateBroadcastRadius+f.Radius
}

func finiteBroadcastCoordinate(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}

func broadcastRequiresObservedActor(message BroadcastMessage) bool {
	switch message.Type {
	case MsgAbility, MsgAttack, MsgDamage, MsgHeal:
		return true
	default:
		return false
	}
}

// Actor-based visuals can only refer to the recipient's same-scene snapshot
// audience. Their own cast/hit/heal remains available before initial sync.
// Never acquire World.Mu while holding this lock: world/view reads happen first.
func (c *Client) observesBroadcastActor(message BroadcastMessage, playerID string) bool {
	if message.ActorID == "" {
		return false
	}
	if message.ActorID == playerID {
		return true
	}
	c.stateMu.Lock()
	defer c.stateMu.Unlock()
	return c.seenScene == message.InstanceID && c.seenIDs[message.ActorID]
}

// Global delivery is an explicit allowlist. Empty combat scope means overworld,
// not all instances; unknown future event kinds inherit that safe default.
func broadcastRequiresScene(message BroadcastMessage) bool {
	if message.InstanceID != "" {
		return true
	}
	switch message.Type {
	case MsgChat, "time", "public_event":
		return false
	default:
		return true
	}
}

func broadcastMatchesInstance(message BroadcastMessage, instanceID string) bool {
	return !broadcastRequiresScene(message) || message.InstanceID == instanceID
}

// Called only by the hub (and isolated synchronous delivery tests), preserving
// ownership of its clients map and the existing send/retirement policy.
func deliverBroadcast(message BroadcastMessage) {
	for client := range clients {
		if broadcastRequiresScene(message) {
			if world == nil || client.transportClosed.Load() || client.retired.Load() {
				continue
			}
			playerID := client.boundPlayerID()
			x, z, clientScene, joined := world.GetPlayerViewPosition(playerID)
			if !joined || !broadcastMatchesInstance(message, clientScene) {
				continue
			}
			if broadcastRequiresFootprint(message) && !broadcastFootprintVisible(message, x, z) {
				continue
			}
			if broadcastRequiresObservedActor(message) && !client.observesBroadcastActor(message, playerID) {
				continue
			}
		}

		if message.Type == MsgState || message.Type == "time" || message.Type == "public_event" {
			client.sendState(message.Data)
		} else if !client.sendSafe(message.Data) {
			client.markTransportClosed()
			scheduleCharacterWork(func() { cleanupClient(client) })
			delete(clients, client)
			client.closeSendQueues()
		}
	}
}
