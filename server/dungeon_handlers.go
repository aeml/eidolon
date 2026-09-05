package main

import (
	"encoding/json"

	"eidolon-server/internal/game"
)

func sendDungeonEntry(run game.PartyDungeonRun, members []string) {
	layout, exists := world.GetInstanceLayout(run.InstanceID)
	for _, memberID := range members {
		client := getClientByPlayerID(memberID)
		if client == nil {
			continue
		}
		response := map[string]interface{}{"instanceId": run.InstanceID, "type": run.DungeonType}
		if exists {
			response["layout"] = layout
		}
		if summary, ok := world.GetDungeonRoomSummary(run.InstanceID, memberID); ok {
			response["roomState"] = summary
		}
		payload, _ := json.Marshal(response)
		client.sendSafe(createMessage(MsgEnterInstance, payload))
		autoSetSocialStatus(client, memberID, "in_run")
	}
}
