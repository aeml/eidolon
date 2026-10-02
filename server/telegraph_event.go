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
	return BroadcastMessage{Type: MsgTelegraph, Data: data, InstanceID: event.InstanceID,
		Footprint: BroadcastFootprint{Present: true, X: event.X, Z: event.Z, Radius: event.Radius}}, err
}
