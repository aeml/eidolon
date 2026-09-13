package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestGroupFinderHandlerUsesCallerOwnershipAndRespectsBlocks(t *testing.T) {
	oldWorld, oldSessions, oldChat := world, activeSessions, chatService
	world, activeSessions, chatService = game.NewWorld(nil), make(map[string]*Client), newStructuredChatService(10)
	defer func() { world.StopBackground(); world, activeSessions, chatService = oldWorld, oldSessions, oldChat }()
	clients := make(map[string]*Client)
	for _, name := range []string{"owner", "applicant", "observer"} {
		client := newAutoStatusClient(name)
		clients[name], activeSessions[name] = client, client
		player := newAutoStatusPlayer(name, name, "available")
		player.Level = 100
		world.AddEntity(player)
	}
	send := func(name string, payload map[string]interface{}) {
		bytes, _ := json.Marshal(payload)
		handleMsgGroupFinder(clients[name], Message{Payload: bytes})
	}
	send("owner", map[string]interface{}{"action": "post", "mode": "recruit", "activity": "world", "role": "healer", "minLevel": 1, "ownerId": "observer"})
	send("applicant", map[string]interface{}{"action": "request", "ownerId": "owner", "role": "healer"})
	sendGroupFinder(clients["observer"])
	var board struct {
		Listings []game.GroupListing `json:"listings"`
	}
	for _, message := range drainSentMessages(clients["observer"].send) {
		if message.Type == "group_finder_update" {
			if err := json.Unmarshal(message.Payload, &board); err != nil {
				t.Fatal(err)
			}
		}
	}
	if len(board.Listings) != 1 || board.Listings[0].OwnerID != "owner" || len(board.Listings[0].Applicants) != 0 {
		t.Fatal("spoofed ownership or private request leak", board)
	}
	if world.GetEntityCopy("applicant").PartyID != "" {
		t.Fatal("request auto-joined a party")
	}
	chatService.SetBlocked("owner", "applicant", true)
	drainSentMessages(clients["applicant"].send)
	send("applicant", map[string]interface{}{"action": "request", "ownerId": "owner", "role": "healer"})
	blocked := false
	for _, message := range drainSentMessages(clients["applicant"].send) {
		blocked = blocked || message.Type == MsgError
	}
	if !blocked {
		t.Fatal("blocked application accepted")
	}
	sendGroupFinder(clients["applicant"])
	for _, message := range drainSentMessages(clients["applicant"].send) {
		if message.Type == "group_finder_update" {
			json.Unmarshal(message.Payload, &board)
		}
	}
	if len(board.Listings) != 0 {
		t.Fatal("blocked listing still visible")
	}
}
