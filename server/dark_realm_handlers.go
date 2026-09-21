package main

import (
	"encoding/json"

	"eidolon-server/internal/game"
)

func handleEnterDarkRealm(client *Client, message Message) {
	// No destination, party or player IDs come from this request.
	var request struct{}
	if len(message.Payload) > 0 && json.Unmarshal(message.Payload, &request) != nil {
		client.sendError("invalid Dark Realm request")
		return
	}
	if err := world.EnterDarkRealm(client.playerID); err != nil {
		client.sendError(err.Error())
		return
	}
	player := world.GetEntityCopy(client.playerID)
	if player == nil || player.InstanceID != game.DarkRealmInstanceID {
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"instanceId": game.DarkRealmInstanceID, "type": game.DarkRealmInstanceType,
		"layout": game.DarkRealmLayout(),
		"spawn":  map[string]float64{"x": player.X, "y": player.Y, "z": player.Z},
	})
	client.sendSafe(createMessage(MsgEnterInstance, payload))
}
