package main

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
			clientScene, joined := world.GetPlayerInstanceIfPresent(client.boundPlayerID())
			if !joined || !broadcastMatchesInstance(message, clientScene) {
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
