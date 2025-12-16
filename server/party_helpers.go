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

	membersData := []map[string]interface{}{}

	for _, mid := range memberIDs {
		entity := world.GetEntityCopy(mid)
		if entity != nil {
			membersData = append(membersData, map[string]interface{}{
				"id":       entity.ID,
				"name":     entity.Name,
				"class":    entity.SubType,
				"level":    entity.Level,
				"hp":       entity.Health,
				"maxHp":    entity.MaxHealth,
				"isLeader": entity.ID == leaderID,
				"x":        entity.X,
				"z":        entity.Z,
			})
		}
	}

	payload := map[string]interface{}{
		"partyId":  id,
		"leaderId": leaderID,
		"members":  membersData,
	}

	jsonPayload, _ := json.Marshal(payload)
	msg := createMessage(MsgPartyUpdate, jsonPayload)

	for _, mid := range memberIDs {
		client := getClientByPlayerID(mid)
		if client != nil {
			client.send <- msg
		}
	}
}
