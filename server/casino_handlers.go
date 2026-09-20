package main

import (
	"eidolon-server/internal/game"
	"encoding/json"
	"time"
)

func handleMsgCasino(client *Client, message Message) {
	var request struct {
		Action        string             `json:"action"`
		TableID       string             `json:"tableId"`
		Seat          int                `json:"seat"`
		SessionID     string             `json:"sessionId"`
		Ready         bool               `json:"ready"`
		Revision      string             `json:"revision"`
		RoundID       string             `json:"roundId"`
		RoundRevision uint64             `json:"roundRevision"`
		GameAction    string             `json:"gameAction"`
		Bet           int                `json:"bet"`
		Choice        int                `json:"choice"`
		Wagers        []game.CasinoWager `json:"wagers"`
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
	case "vip", "downstairs":
		if request.Action == "vip" {
			err = requireCasinoVIPLocked(client, time.Now())
		}
		if err == nil {
			err = world.ChangeCasinoFloor(client.playerID, request.Action == "vip", time.Now())
		}
		if err == nil {
			p := world.GetEntityCopy(client.playerID)
			payload, _ := json.Marshal(map[string]interface{}{"upstairs": p.CasinoVIPFloor, "x": p.X, "y": p.Y, "z": p.Z})
			client.sendSafe(createMessage("casino_floor", payload))
		}
	case "get":
		if err := prepareSeatedSlotLocked(client); err != nil {
			client.sendError(err.Error())
		}
		sendCasinoState(client)
		return
	case "sit":
		p := world.GetEntityCopy(client.playerID)
		if table, ok := game.CasinoTableByID(request.TableID); ok && table.Floor == "vip" && (p == nil || p.CasinoSeat == nil || p.CasinoSeat.TableID != request.TableID || p.CasinoSeat.Seat != request.Seat) {
			err = requireCasinoVIPLocked(client, time.Now())
		}
		if err == nil && game.IsCasinoPokerTable(request.TableID) {
			err = validatePokerSeatClaim(client.playerID, request.Seat, request.TableID)
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
	case "house_bet":
		err = handleHouseBet(client, request.SessionID, request.RoundID, request.Wagers, time.Now())
	default:
		client.sendError("unsupported casino action")
		return
	}
	if err != nil {
		client.sendError(err.Error())
		// Explicit rejection acknowledgement: polling unchanged state alone cannot
		// distinguish a rejected wager from one still in flight.
		rejected, _ := json.Marshal(struct {
			SessionID     string `json:"sessionId"`
			Action        string `json:"action"`
			RoundID       string `json:"roundId"`
			RoundRevision uint64 `json:"roundRevision"`
			Error         string `json:"error"`
		}{request.SessionID, request.Action, request.RoundID, request.RoundRevision, err.Error()})
		client.sendSafe(createMessage("casino_action_error", rejected))
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
		Floor     string             `json:"floor"`
		VIP       bool               `json:"vip"`
		Blackjack blackjackTableView `json:"blackjack"`
		Slots     *slotMachineView   `json:"slots,omitempty"`
		Poker     pokerTableView     `json:"poker"`
		House     *houseTableView    `json:"house,omitempty"`
	}{CasinoPresence: world.CasinoPresenceFor(client.playerID, time.Now()), Floor: casinoFloorFor(client.playerID), VIP: casinoVIPFor(client.playerID), Blackjack: blackjackViewFor(client.playerID), Slots: slotViewFor(client.playerID), Poker: pokerViewFor(client.playerID), House: houseViewFor(client.playerID)})
	client.sendSafe(createMessage("casino_update", encoded))
}

func casinoFloorFor(playerID string) string {
	if p := world.GetEntityCopy(playerID); p != nil && p.CasinoVIPFloor && p.InstanceID == game.CasinoInstanceID {
		return "vip"
	}
	return "public"
}
func casinoVIPFor(playerID string) bool {
	p := world.GetEntityCopy(playerID)
	return p != nil && time.Now().Before(p.VIPUntil)
}
