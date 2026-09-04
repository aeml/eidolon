package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"eidolon-server/internal/game"

	"github.com/gorilla/websocket"
)

func runHub() {
	for {
		select {
		case client := <-register:
			clients[client] = true
		case client := <-unregister:
			if _, ok := clients[client]; ok {
				cleanupClient(client)
				delete(clients, client)
				close(client.send)
				if client.prioritySend != nil {
					close(client.prioritySend)
				}
			}
		case message := <-broadcast:
			for client := range clients {
				// Filter by InstanceID
				if message.InstanceID != "" {
					clientInstance := world.GetPlayerInstance(client.playerID)
					if clientInstance != message.InstanceID {
						continue
					}
				}

				if message.Type == MsgState || message.Type == "time" {
					// Non-blocking send for state/time updates
					// If channel is full, drop the message instead of disconnecting
					select {
					case client.send <- message.Data:
					default:
						// Drop message, client is too slow
					}
				} else {
					// Critical messages (Chat, Damage, etc.)
					// Try to send, if full, we might have to disconnect or risk blocking
					select {
					case client.send <- message.Data:
					default:
						cleanupClient(client)
						delete(clients, client)
						close(client.send)
						if client.prioritySend != nil {
							close(client.prioritySend)
						}
					}
				}
			}
		}
	}
}

// sendInitialPlayerState pushes inventory, stash, buyback, quests, skill runes,
// and (optionally) the current dungeon instance layout to the client. It is
// called both on a fresh MsgJoin and on a successful MsgResumeSession.
func sendInitialPlayerState(c *Client, entity *game.Entity, instanceID string) {
	// Cooldowns are server-owned and survive the session-resume window. Send a
	// complete snapshot so reconnecting clients do not show abilities as ready
	// only to have the server reject their first cast.
	cooldowns, _ := world.GetAbilityCooldownSnapshot(entity.ID)
	cooldownPayload, _ := json.Marshal(map[string]interface{}{
		"cooldowns": cooldowns,
	})
	cooldownMessage, _ := json.Marshal(Message{Type: MsgAbilityCooldowns, Payload: cooldownPayload})
	c.sendSafe(cooldownMessage)

	// Inventory
	if len(entity.Inventory) > 0 {
		invPayload, _ := json.Marshal(entity.Inventory)
		msg := Message{Type: MsgInventory, Payload: invPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Stash
	if len(entity.Stash) > 0 {
		stashPayload, _ := json.Marshal(entity.Stash)
		msg := Message{Type: MsgStash, Payload: stashPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Buyback list
	if len(entity.Buyback) > 0 {
		buybackPayload, _ := json.Marshal(entity.Buyback)
		msg := Message{Type: MsgBuybackList, Payload: buybackPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Quests
	if len(entity.Quests) > 0 {
		questPayload, _ := json.Marshal(entity.Quests)
		msg := Message{Type: MsgQuestUpdate, Payload: questPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Skill runes
	if len(entity.SkillRunes) > 0 {
		runesPayload, _ := json.Marshal(map[string]interface{}{
			"skillRunes": entity.SkillRunes,
		})
		msg := Message{Type: MsgSelectRune, Payload: runesPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Dungeon instance layout (reconnect / session-resume)
	if instanceID != "" {
		layout, hasLayout := world.GetInstanceLayout(instanceID)
		if hasLayout {
			log.Printf("Sending instance layout to %s for instance %s: %d rooms", c.username, instanceID, len(layout.Rooms))
			resp := map[string]interface{}{
				"instanceId": instanceID,
				"type":       world.GetInstanceType(instanceID),
				"layout":     layout,
			}
			if roomState, ok := world.GetDungeonRoomSummary(instanceID, c.playerID); ok {
				resp["roomState"] = roomState
			}
			payloadBytes, _ := json.Marshal(resp)
			instMsg := Message{Type: MsgEnterInstance, Payload: payloadBytes}
			b, _ := json.Marshal(instMsg)
			c.sendSafe(b)
		}
	}

	chatService.Replay(c, entity.PartyID)
	sendGuildState(c)
	hydratePvPProfile(c.playerID)
	sendPvPState(c)
	sendEndgameState(c)
	go touchAndBroadcastGuildPresence(c.playerID, time.Now())
}

func cleanupClient(client *Client) {
	world.ForfeitPvP(client.playerID)
	// 1. Return any direct-trade escrow before snapshotting persistent state.
	if trade := world.CancelDirectTradesForPlayer(client.playerID); trade != nil {
		sendDirectTradeUpdate(trade, "cancelled")
		sendInventoryForPlayer(trade.PlayerAID)
		sendInventoryForPlayer(trade.PlayerBID)
	}

	// 2. Get state (fast, in-memory)
	var entity *game.Entity
	if client.playerID != "" {
		entity = world.GetEntityCopy(client.playerID)
	}

	// 3. Mark entity as disconnected instead of removing it immediately.
	//    The entity remains in the world during the resume window so a
	//    reconnecting client can pick up where it left off.
	if client.playerID != "" {
		if !world.SetEntityDisconnected(client.playerID, time.Now()) {
			// Entity was already gone (e.g. removed by the sweep); nothing to do.
			log.Printf("cleanupClient: entity %s not found in world", client.playerID)
		}
	}

	// 4. Cleanup session (fast)
	sessionsMu.Lock()
	if existing, exists := activeSessions[client.username]; exists && existing == client {
		delete(activeSessions, client.username)
	}
	sessionsMu.Unlock()

	// 5. Notify online friends that this player has gone offline (0.38.1).
	if client.username != "" {
		go notifyFriendsPresence(client.username, false)
		go touchAndBroadcastGuildPresence(client.playerID, time.Now())
	}

	// 6. Save to DB (slow, do async)
	if entity != nil {
		go func(c *Client, e *game.Entity) {
			saveCharacterDB(c, e)
		}(client, entity)
	}
}

func serveWs(w http.ResponseWriter, r *http.Request) {
	if !websocket.IsWebSocketUpgrade(r) {
		logSuspicious(r, "non-websocket request to /ws", nil)
		http.Error(w, "websocket upgrade required", http.StatusBadRequest)
		return
	}

	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logSuspicious(r, "websocket upgrade failed", err)
		return
	}

	client := &Client{
		conn:         c,
		send:         make(chan []byte, 256), // State traffic is lossy under pressure.
		prioritySend: make(chan []byte, 64),  // Control/UI messages must not starve behind state.
		lastState:    make(map[string]*EntitySnapshot),
		seenIDs:      make(map[string]bool),
	}
	register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		msg, err := decodeInboundMessage(message)
		if err != nil {
			log.Println("invalid inbound frame:", err)
			continue
		}

		c.handleMessage(msg)
	}
}

func decodeInboundMessage(frame []byte) (Message, error) {
	if len(frame) == 0 {
		return Message{}, fmt.Errorf("empty frame")
	}
	if len(frame) > maxMessageSize {
		return Message{}, fmt.Errorf("frame exceeds %d bytes", maxMessageSize)
	}
	var message Message
	if err := json.Unmarshal(frame, &message); err != nil {
		return Message{}, fmt.Errorf("decode JSON envelope: %w", err)
	}
	if message.Type == "" {
		return Message{}, fmt.Errorf("message type is required")
	}
	if len(message.Payload) > 0 && !json.Valid(message.Payload) {
		return Message{}, fmt.Errorf("payload must be valid JSON")
	}
	return message, nil
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	writeMessage := func(message []byte) error {
		c.conn.SetWriteDeadline(time.Now().Add(writeWait))
		msgType := websocket.TextMessage
		if len(message) > 5 && bytes.Equal(message[0:4], stateProtoMagic) {
			msgType = websocket.BinaryMessage
		}
		w, err := c.conn.NextWriter(msgType)
		if err != nil {
			return err
		}
		if _, err := w.Write(message); err != nil {
			_ = w.Close()
			return err
		}
		return w.Close()
	}

	for {
		// Give already-queued control traffic strict precedence without
		// preventing state or ping progress when the priority lane is empty.
		select {
		case message, ok := <-c.prioritySend:
			if !ok || writeMessage(message) != nil {
				return
			}
			continue
		default:
		}

		select {
		case message, ok := <-c.prioritySend:
			if !ok || writeMessage(message) != nil {
				return
			}
		case message, ok := <-c.send:
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if writeMessage(message) != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
