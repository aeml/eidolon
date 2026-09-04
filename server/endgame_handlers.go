package main

import "encoding/json"

func handleMsgEndgameGet(client *Client, _ Message) {
	sendEndgameState(client)
}

func handleMsgEndgameSpend(client *Client, message Message) {
	var payload EndgameSpendPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid resonance request")
		return
	}
	if _, err := world.SpendResonancePoint(client.playerID, payload.Trait); err != nil {
		client.sendError(err.Error())
		return
	}
	savePlayer(client)
	sendEndgameState(client)
}

func sendEndgameState(client *Client) {
	if client == nil || client.playerID == "" {
		return
	}
	progress, ok := world.EndgameProgressForPlayer(client.playerID)
	if !ok {
		return
	}
	payload, _ := json.Marshal(progress)
	client.sendSafe(createMessage(MsgEndgameUpdate, payload))
}
