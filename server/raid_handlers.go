package main

import (
	"encoding/json"
	"fmt"
	"time"

	"eidolon-server/internal/game"
)

func requestedRaidType(message Message) string {
	var request struct {
		RaidType string `json:"raidType"`
	}
	if len(message.Payload) > 0 {
		_ = json.Unmarshal(message.Payload, &request)
	}
	if request.RaidType == "" {
		return "weekly_raid"
	}
	return request.RaidType
}

func handleMsgRaidConvert(client *Client, message Message) {
	raidType := requestedRaidType(message)
	party, err := world.ConvertPartyToRaidForType(client.playerID, raidType)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	broadcastPartyUpdate(party)
	client.sendSystemChat("Raid group formed. Invite 5-10 qualified players, then complete a ready check.")
}

func handleMsgRaidEnter(client *Client, message Message) {
	raidType := requestedRaidType(message)
	var party *game.Party
	var members []string
	var err error
	runLevel := game.MaxPlayerLevel
	difficulty := game.DifficultyMythic
	if definition, elemental := game.ElementalRaidDefinitionForType(raidType); elemental {
		party, members, err = world.ValidateElementalRaidParty(client.playerID, raidType)
		runLevel = definition.RequiredLevel
		difficulty = game.DifficultyNormal
	} else if raidType == "weekly_raid" {
		party, members, err = world.ValidateWeeklyRaidParty(client.playerID)
		if err == nil {
			err = world.RequirePartyChronicleQuest(party.ID, game.ChronicleGateOpenedID)
		}
	} else {
		err = fmt.Errorf("unknown raid")
	}
	if err != nil {
		client.sendError(err.Error())
		return
	}
	instanceID := world.CreateDungeon(party.ID, raidType, difficulty, runLevel)
	if world.GetInstanceType(instanceID) != raidType {
		client.sendError("reset the party's active instance before entering this raid")
		return
	}
	layout, ok := world.GetInstanceLayout(instanceID)
	if !ok {
		client.sendError("raid instance failed to initialize")
		return
	}
	for _, memberID := range members {
		if err := world.EnterInstance(memberID, instanceID); err != nil {
			continue
		}
		memberClient := getClientByPlayerID(memberID)
		if memberClient == nil {
			continue
		}
		response := map[string]interface{}{"instanceId": instanceID, "type": raidType, "layout": layout}
		if roomState, exists := world.GetDungeonRoomSummary(instanceID, memberID); exists {
			response["roomState"] = roomState
		}
		payload, _ := json.Marshal(response)
		memberClient.sendSafe(createMessage(MsgEnterInstance, payload))
		autoSetSocialStatus(memberClient, memberID, "in_run")
		if raidType == "weekly_raid" {
			claimed, _ := db.HasWeeklyRaidReward(memberID, time.Now().UTC())
			if claimed {
				memberClient.sendSystemChat("You already claimed this week's cache; you may still help the raid.")
			}
		}
	}
}
