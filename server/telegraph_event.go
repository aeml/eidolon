package main

import (
	"eidolon-server/internal/game"
	"encoding/json"
)

func telegraphBroadcast(event game.TelegraphEvent) (BroadcastMessage, error) {
	payload, err := json.Marshal(TelegraphPayload(event))
	if err != nil {
		return BroadcastMessage{}, err
	}
	data, err := json.Marshal(Message{Type: MsgTelegraph, Payload: payload})
	return BroadcastMessage{Type: MsgTelegraph, Data: data, InstanceID: event.InstanceID}, err
}

func broadcastMatchesInstance(message BroadcastMessage, instanceID string) bool {
	// Empty is the overworld for telegraphs, not a request to warn every dungeon.
	return (message.InstanceID == "" && message.Type != MsgTelegraph) || message.InstanceID == instanceID
}
