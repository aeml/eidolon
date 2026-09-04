package main

import (
	"eidolon-server/internal/game"
	"encoding/json"
)

func getClientByUsername(username string) *Client {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	return activeSessions[username]
}

func getClientByPlayerID(playerID string) *Client {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	for _, c := range activeSessions {
		if c.playerID == playerID {
			return c
		}
	}
	return nil
}

func createMessage(msgType string, payload []byte) []byte {
	msg := Message{
		Type:    msgType,
		Payload: payload,
	}
	b, _ := json.Marshal(msg)
	return b
}

func broadcastPartyUpdate(party *game.Party) {
	if party == nil {
		return
	}

	id, leaderID, memberIDs := party.GetSnapshot()
	party.Mu.RLock()
	ready := make(map[string]bool, len(party.Ready))
	for memberID, isReady := range party.Ready {
		ready[memberID] = isReady
	}
	readyCheckActive := party.ReadyCheckActive
	lootRule := party.LootRule
	masterLooterID := party.MasterLooterID
	allReady := len(memberIDs) > 0
	for _, memberID := range memberIDs {
		allReady = allReady && ready[memberID]
	}
	party.Mu.RUnlock()
	if lootRule == "" {
		lootRule = "ffa"
	}

	membersData := []map[string]interface{}{}

	for _, mid := range memberIDs {
		entity := world.GetEntityCopy(mid)
		if entity != nil {
			membersData = append(membersData, map[string]interface{}{
				"id":         entity.ID,
				"name":       entity.Name,
				"class":      entity.SubType,
				"level":      entity.Level,
				"hp":         entity.Health,
				"maxHp":      entity.MaxHealth,
				"isLeader":   entity.ID == leaderID,
				"role":       game.PartyRoleForClass(entity.SubType),
				"ready":      ready[entity.ID],
				"instanceId": entity.InstanceID,
				"x":          entity.X,
				"z":          entity.Z,
			})
		}
	}

	payload := map[string]interface{}{
		"partyId":          id,
		"leaderId":         leaderID,
		"members":          membersData,
		"readyCheckActive": readyCheckActive,
		"lootRule":         lootRule,
		"masterLooterId":   masterLooterID,
		"allReady":         allReady,
	}

	jsonPayload, _ := json.Marshal(payload)
	msg := createMessage(MsgPartyUpdate, jsonPayload)

	for _, mid := range memberIDs {
		client := getClientByPlayerID(mid)
		if client != nil {
			client.sendSafe(msg)
		}
	}
}
