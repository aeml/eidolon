package main

import (
	"eidolon-server/internal/game"
	"encoding/json"
	"time"
)

func handleMsgCasino(client *Client, message Message) {
	var request struct {
		Action        string `json:"action"`
		TableID       string `json:"tableId"`
		Seat          int    `json:"seat"`
		SessionID     string `json:"sessionId"`
		Ready         bool   `json:"ready"`
		Revision      string `json:"revision"`
		RoundID       string `json:"roundId"`
		RoundRevision uint64 `json:"roundRevision"`
		GameAction    string `json:"gameAction"`
		Bet           int    `json:"bet"`
	}
	if json.Unmarshal(message.Payload, &request) != nil {
		client.sendError("invalid casino interaction")
		return
	}
	var err error
	switch request.Action {
	case "get":
		sendCasinoState(client)
		return
	case "sit":
		_, err = world.TakeCasinoSeat(client.playerID, request.TableID, request.Seat, time.Now())
	case "leave", "ready":
		err = world.ChangeCasinoSeat(client.playerID, request.SessionID, request.Action, request.Ready, time.Now(), request.Revision)
	case "bet":
		err = handleBlackjackBet(client, request.SessionID, request.RoundID, request.Bet, time.Now())
	case "play":
		err = handleBlackjackPlay(client, request.SessionID, request.RoundID, request.GameAction, request.RoundRevision, time.Now())
	default:
		client.sendError("unsupported casino action")
		return
	}
	if err != nil {
		client.sendError(err.Error())
		sendCasinoState(client)
		return
	}
	sendMovementContext(client)
	// Do not hold the session map while obtaining World.Mu for presence.
	sessionsMu.Lock()
	clients := make([]*Client, 0, len(activeSessions))
	for _, observer := range activeSessions {
		clients = append(clients, observer)
	}
	sessionsMu.Unlock()
	for _, observer := range clients {
		player := world.GetEntityCopy(observer.playerID)
		if observer == client || (player != nil && player.InstanceID == "" && world.SafeZoneAt("", player.X, player.Z) != "") {
			sendCasinoState(observer)
		}
	}
}

func sendCasinoState(client *Client) {
	if client == nil || client.playerID == "" || world == nil {
		return
	}
	encoded, _ := json.Marshal(struct {
		game.CasinoPresence
		Blackjack blackjackTableView `json:"blackjack"`
	}{world.CasinoPresenceFor(client.playerID, time.Now()), blackjackViewFor(client.playerID)})
	client.sendSafe(createMessage("casino_update", encoded))
}
