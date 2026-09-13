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
		Choice        int    `json:"choice"`
	}
	if json.Unmarshal(message.Payload, &request) != nil {
		client.sendError("invalid casino interaction")
		return
	}
	var err error
	switch request.Action {
	case "enter":
		if err = world.EnterCasino(client.playerID); err != nil {
			client.sendError(err.Error())
			return
		}
		sendMovementContext(client)
		payload, _ := json.Marshal(map[string]interface{}{"instanceId": game.CasinoInstanceID, "type": game.CasinoInstanceType,
			"spawn": map[string]float64{"x": 0, "z": 200}})
		client.sendSafe(createMessage(MsgEnterInstance, payload))
		sendCasinoState(client)
		return
	case "vip":
		client.sendError("You must be a VIP to enter")
		return
	case "get":
		if err := prepareSeatedSlotLocked(client); err != nil {
			client.sendError(err.Error())
		}
		sendCasinoState(client)
		return
	case "sit":
		if request.TableID == publicPokerTable {
			err = validatePokerSeatClaim(client.playerID, request.Seat)
		}
		if err == nil {
			_, err = world.TakeCasinoSeat(client.playerID, request.TableID, request.Seat, time.Now())
		}
		if err == nil {
			err = prepareSeatedSlotLocked(client)
		}
	case "leave":
		err = handlePokerLeave(client, request.SessionID, time.Now())
		if err == nil {
			err = world.ChangeCasinoSeat(client.playerID, request.SessionID, request.Action, request.Ready, time.Now(), request.Revision)
		}
	case "ready":
		err = world.ChangeCasinoSeat(client.playerID, request.SessionID, request.Action, request.Ready, time.Now(), request.Revision)
	case "bet":
		err = handleBlackjackBet(client, request.SessionID, request.RoundID, request.Bet, time.Now())
	case "play":
		err = handleBlackjackPlay(client, request.SessionID, request.RoundID, request.GameAction, request.RoundRevision, time.Now())
	case "slot_spin":
		err = handleSlotAction(client, request.SessionID, request.RoundRevision, "spin", request.Bet, 0)
	case "slot_bonus":
		err = handleSlotAction(client, request.SessionID, request.RoundRevision, "bonus", 0, request.Choice)
	case "poker_buy_in":
		err = handlePokerBuyIn(client, request.SessionID, request.RoundID, request.Bet, time.Now())
	case "poker_play":
		err = handlePokerPlay(client, request.SessionID, request.RoundID, request.GameAction, request.Bet, request.RoundRevision, time.Now())
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
		if observer == client || (player != nil && player.InstanceID == game.CasinoInstanceID) {
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
		Slots     *slotMachineView   `json:"slots,omitempty"`
		Poker     pokerTableView     `json:"poker"`
	}{world.CasinoPresenceFor(client.playerID, time.Now()), blackjackViewFor(client.playerID), slotViewFor(client.playerID), pokerViewFor(client.playerID)})
	client.sendSafe(createMessage("casino_update", encoded))
}
