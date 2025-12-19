package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 8192 // Increased for larger payloads
)

var addr = flag.String("addr", ":8080", "http service address")
var mongoURI = flag.String("mongo-uri", "mongodb://localhost:27017", "MongoDB connection URI")
var certFile = flag.String("cert", "", "Path to SSL certificate file")
var keyFile = flag.String("key", "", "Path to SSL key file")

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	// EnableCompression: true, // Disabled, using manual GZIP
}

// Global instances
var (
	db    *database.DB
	world *game.World
)

// GZIP Writer Pool to reduce memory allocation
var gzipWriterPool = sync.Pool{
	New: func() interface{} {
		w, _ := gzip.NewWriterLevel(nil, gzip.BestSpeed)
		return w
	},
}

// Client represents a connected player
type Client struct {
	conn     *websocket.Conn
	send     chan []byte
	playerID string
	username string
}

// Message types
const (
	MsgJoin          = "join"
	MsgLogin         = "login"
	MsgRegister      = "register"
	MsgMove          = "move"
	MsgAttack        = "attack"
	MsgDamage        = "damage"
	MsgChat          = "chat"
	MsgState         = "state"
	MsgError         = "error"
	MsgPickup        = "pickup"
	MsgInventory     = "inventory"
	MsgAbility       = "ability"
	MsgEquip         = "equip"
	MsgBuyGamble     = "buy_gamble"
	MsgSell          = "sell"
	MsgSocial        = "social"
	MsgRespawn       = "respawn"
	MsgRecall        = "recall"
	MsgReport        = "report"
	MsgStashDeposit  = "stash_deposit"
	MsgStashWithdraw = "stash_withdraw"
	MsgStash         = "stash"
	MsgQuestUpdate   = "quest_update"
	MsgAcceptQuest   = "accept_quest"
	MsgCompleteQuest = "complete_quest"
	MsgSelectBranch  = "selectBranch"
	MsgUnlockSkill   = "unlockSkill"
	MsgForgeUpgrade  = "forge_upgrade"
	MsgForgePotency  = "forge_potency"
	MsgForgeSocket   = "forge_socket"
	MsgPartyInvite   = "party_invite"
	MsgPartyResponse = "party_response"
	MsgPartyRequest  = "party_request"
	MsgPartyJoinResp = "party_join_resp"
	MsgPartyKick     = "party_kick"
	MsgPartyPromote  = "party_promote"
	MsgPartyLeave    = "party_leave"
	MsgPartyUpdate   = "party_update"
	MsgBuyback       = "buyback"
	MsgBuybackList   = "buyback_list"
	MsgUnequip       = "unequip"

	// Trading
	MsgTradingSearch     = "trading_search"
	MsgTradingCreate     = "trading_create"
	MsgTradingMyAuctions = "trading_my_auctions"
	MsgTradingBuyout     = "trading_buyout"
	MsgTradingCollect    = "trading_collect"
	MsgTradingCancel     = "trading_cancel"
	MsgTradingBid        = "trading_bid"
	MsgInventoryMove     = "inventory_move"
	MsgEnterDungeon      = "enter_dungeon"
	MsgEnterInstance     = "enter_instance"
	MsgSplitStack        = "split_stack"
	MsgGetDungeonStatus  = "get_dungeon_status"
	MsgResetDungeon      = "reset_dungeon"
)

type SplitStackPayload struct {
	Slot   int `json:"slot"`
	Amount int `json:"amount"`
}

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type TradingBidPayload struct {
	AuctionID string `json:"auctionId"`
	Amount    int    `json:"amount"`
}

type InventoryMovePayload struct {
	FromIndex int `json:"fromIndex"`
	ToIndex   int `json:"toIndex"`
}

type SocialEntry struct {
	Name  string `json:"name"`
	Class string `json:"class"`
	Level int    `json:"level"`
}

type AuthPayload struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type JoinPayload struct {
	Type string `json:"type"` // Class type
}

type MovePayload struct {
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Rotation float64 `json:"rotation"`
	State    string  `json:"state"`
}

type AttackPayload struct {
	TargetID string `json:"targetId"`
}

type PickupPayload struct {
	LootID string `json:"lootId"`
}

type BuyGamblePayload struct {
	Slot string `json:"slot"`
}

type SellPayload struct {
	ItemID string `json:"itemId"`
}

type BuybackPayload struct {
	ItemID string `json:"itemId"`
}

type StashDepositPayload struct {
	ItemID string `json:"itemId"`
}

type StashWithdrawPayload struct {
	ItemID string `json:"itemId"`
}

type ForgeUpgradePayload struct {
	Slot   string `json:"slot"`
	Amount int    `json:"amount"`
}

type ForgePotencyPayload struct {
	Slot string `json:"slot"`
}

type ForgeSocketPayload struct {
	Slot string `json:"slot"`
}

type AcceptQuestPayload struct {
	QuestID string `json:"questId"`
}

type CompleteQuestPayload struct {
	QuestID string `json:"questId"`
}

type EquipPayload struct {
	ItemID string `json:"itemId"`
	Slot   string `json:"slot"`
}

type TradingSearchPayload struct {
	Query string `json:"query"`
}

type TradingCreatePayload struct {
	SlotIndex int `json:"slotIndex"`
	Bid       int `json:"bid"`
	Buyout    int `json:"buyout"`
	Duration  int `json:"duration"`
}

type TradingBuyoutPayload struct {
	AuctionID string `json:"auctionId"`
}

type TradingCollectPayload struct {
	AuctionID string `json:"auctionId"`
}

type TradingCancelPayload struct {
	AuctionID string `json:"auctionId"`
}

type UnequipPayload struct {
	Slot string `json:"slot"`
}

type AbilityPayload struct {
	TargetX   float64 `json:"targetX"`
	TargetZ   float64 `json:"targetZ"`
	TargetID  string  `json:"targetId"`
	SkillName string  `json:"skillName"`
	SourceID  string  `json:"sourceId"`
}

type DamagePayload struct {
	TargetID string `json:"targetId"`
	Amount   int    `json:"amount"`
	SourceID string `json:"sourceId"`
}

type ChatPayload struct {
	Message string `json:"message"`
	Sender  string `json:"sender"`
}

type ReportPayload struct {
	ReportType string `json:"reportType"`
	Text       string `json:"text"`
}

type SelectBranchPayload struct {
	Branch string `json:"branch"`
}

type UnlockSkillPayload struct {
	SkillName string `json:"skillName"`
}

type PartyInvitePayload struct {
	TargetName string `json:"targetName"`
}

type PartyResponsePayload struct {
	InviterName string `json:"inviterName"`
	Accepted    bool   `json:"accepted"`
}

type PartyRequestPayload struct {
	TargetName string `json:"targetName"`
}

type PartyJoinRespPayload struct {
	RequesterName string `json:"requesterName"`
	Approved      bool   `json:"approved"`
}

type PartyKickPayload struct {
	TargetID string `json:"targetId"`
}

type PartyPromotePayload struct {
	TargetID string `json:"targetId"`
}

type BroadcastMessage struct {
	Type       string
	Data       []byte
	InstanceID string
}

var clients = make(map[*Client]bool)
var activeSessions = make(map[string]*Client)
var sessionsMu sync.Mutex
var broadcast = make(chan BroadcastMessage)
var register = make(chan *Client)
var unregister = make(chan *Client)

func main() {
	flag.Parse()
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	var err error
	db, err = database.New(*mongoURI)
	if err != nil {
		log.Fatal(err)
	}

	// Seed the random number generator
	rand.Seed(time.Now().UnixNano())

	world = game.NewWorld(db)

	// Set up World Event Callback
	world.OnEvent = func(eventType string, data interface{}) {
		switch eventType {
		case "elite_spawn":
			msgText, ok := data.(string)
			if !ok {
				return
			}
			// Broadcast chat message
			outPayload := ChatPayload{
				Message: msgText,
				Sender:  "System",
			}
			b, _ := json.Marshal(outPayload)
			outMsg := Message{
				Type:    MsgChat,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			// Send in goroutine to avoid deadlock if hub is busy
			go func() {
				broadcast <- BroadcastMessage{Type: MsgChat, Data: dataBytes}
			}()
		case "ability":
			evt, ok := data.(game.AbilityEvent)
			if !ok {
				return
			}
			payload := AbilityPayload{
				TargetX:   evt.TargetX,
				TargetZ:   evt.TargetZ,
				TargetID:  evt.TargetID,
				SkillName: evt.SkillName,
				SourceID:  evt.SourceID,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgAbility,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)
			go func() {
				broadcast <- BroadcastMessage{Type: MsgAbility, Data: dataBytes}
			}()
		case "inventory_update":
			playerID, ok := data.(string)
			if !ok {
				return
			}
			log.Printf("Handling inventory_update event for player: %s", playerID)

			sessionsMu.Lock()
			client, exists := activeSessions[playerID]
			sessionsMu.Unlock()

			if exists {
				player := world.GetEntity(playerID)
				if player != nil {
					player.Mu.RLock()
					// Copy inventory to avoid race conditions during marshal
					inv := make([]game.Item, len(player.Inventory))
					copy(inv, player.Inventory)
					player.Mu.RUnlock()

					b, err := json.Marshal(inv)
					if err != nil {
						log.Printf("Error marshaling inventory for %s: %v", playerID, err)
						return
					}

					outMsg := Message{
						Type:    MsgInventory,
						Payload: b,
					}
					dataBytes, _ := json.Marshal(outMsg)
					client.sendSafe(dataBytes)
					log.Printf("Sent inventory update to client %s. Payload size: %d bytes", playerID, len(dataBytes))
				} else {
					log.Printf("Player entity %s not found during inventory update", playerID)
				}
			} else {
				log.Printf("No active session found for player %s during inventory update", playerID)
			}
		case "damage":
			evt, ok := data.(game.DamageEvent)
			if !ok {
				return
			}

			payload := DamagePayload{
				TargetID: evt.TargetID,
				Amount:   evt.Amount,
				SourceID: evt.SourceID,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgDamage,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			go func() {
				broadcast <- BroadcastMessage{Type: MsgDamage, Data: dataBytes}
			}()
		}
	}

	world.OnQuestUpdate = func(playerID string, quests []game.Quest) {
		// Find client
		sessionsMu.Lock()
		var client *Client
		for _, c := range activeSessions {
			if c.playerID == playerID {
				client = c
				break
			}
		}
		sessionsMu.Unlock()

		if client != nil {
			payload, _ := json.Marshal(quests)
			msg := Message{
				Type:    MsgQuestUpdate,
				Payload: payload,
			}
			b, _ := json.Marshal(msg)
			client.sendSafe(b)
		}
	}

	// Game Loop
	go func() {
		ticker := time.NewTicker(33 * time.Millisecond) // 30 TPS
		for range ticker.C {
			world.Update(0.033)
			broadcastState()
		}
	}()

	// Party Update Loop (Every 1 second)
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		for range ticker.C {
			parties := world.GetAllParties()
			for _, party := range parties {
				broadcastPartyUpdate(party)
			}
		}
	}()

	// Time Sync Loop (Every 1 second)
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		for range ticker.C {
			broadcastTime()
		}
	}()

	// Hub
	go runHub()

	// Periodic Save Loop (Every 1 minute)
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		for range ticker.C {
			saveAllPlayers()
			world.Trading.CleanupExpired()
		}
	}()

	// Graceful Shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stop
		log.Println("Shutting down server...")
		saveAllPlayers()
		os.Exit(0)
	}()

	http.HandleFunc("/ws", serveWs)
	log.Printf("Server started on %s", *addr)

	if *certFile != "" && *keyFile != "" {
		log.Printf("Serving with SSL/TLS")
		log.Fatal(http.ListenAndServeTLS(*addr, *certFile, *keyFile, nil))
	} else {
		log.Printf("Serving without SSL (HTTP)")
		log.Fatal(http.ListenAndServe(*addr, nil))
	}
}

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
					}
				}
			}
		}
	}
}

func cleanupClient(client *Client) {
	// 1. Get state (fast, in-memory)
	var entity *game.Entity
	if client.playerID != "" {
		entity = world.GetEntityCopy(client.playerID)
	}

	// 2. Remove from world (fast, in-memory)
	if client.playerID != "" {
		world.RemoveEntity(client.playerID)
	}

	// 3. Cleanup session (fast)
	sessionsMu.Lock()
	if existing, exists := activeSessions[client.username]; exists && existing == client {
		delete(activeSessions, client.username)
	}
	sessionsMu.Unlock()

	// 4. Save to DB (slow, do async)
	if entity != nil {
		go func(c *Client, e *game.Entity) {
			saveCharacterDB(c, e)
		}(client, entity)
	}
}

func serveWs(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}

	client := &Client{
		conn: c,
		send: make(chan []byte, 256), // Increased buffer size to prevent drops
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

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Println("json unmarshal:", err)
			continue
		}

		c.handleMessage(msg)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Check if data is GZIP compressed (Magic numbers: 1f 8b)
			msgType := websocket.TextMessage
			if len(message) > 2 && message[0] == 0x1f && message[1] == 0x8b {
				msgType = websocket.BinaryMessage
			}

			w, err := c.conn.NextWriter(msgType)
			if err != nil {
				return
			}

			w.Write(message)

			if err := w.Close(); err != nil {
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

func (c *Client) handleMessage(msg Message) {
	switch msg.Type {
	case MsgRegister:
		var payload AuthPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if err := db.CreateUser(payload.Username, payload.Email, payload.Password); err != nil {
			c.sendError("Registration failed: " + err.Error())
			return
		}
		c.sendError("Registration successful! Please login.")

	case MsgLogin:
		var payload AuthPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		success, err := db.Authenticate(payload.Username, payload.Password)
		if err != nil {
			c.sendError("Login error")
			return
		}
		if !success {
			c.sendError("Invalid credentials")
			return
		}
		c.username = payload.Username

		// Enforce single session
		sessionsMu.Lock()
		if oldClient, ok := activeSessions[c.username]; ok && oldClient != c {
			// Kick old client
			// Use a goroutine to avoid blocking and potential deadlocks if oldClient is stuck
			go func(clientToKick *Client) {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("Recovered from kick panic: %v", r)
					}
				}()
				clientToKick.sendError("Logged in from another location")
				// Give a small delay for the message to be sent before closing
				time.Sleep(100 * time.Millisecond)
				clientToKick.conn.Close()
			}(oldClient)
		}
		activeSessions[c.username] = c
		sessionsMu.Unlock()

		// Check for characters
		user, err := db.GetUser(c.username)
		hasCharacter := false
		characterType := ""
		if err == nil && len(user.Characters) > 0 {
			hasCharacter = true
			characterType = user.Characters[0].Class
		}

		// Send success message
		response := map[string]interface{}{
			"message":       "Login successful",
			"hasCharacter":  hasCharacter,
			"characterType": characterType,
		}
		payloadBytes, _ := json.Marshal(response)

		successMsg := Message{
			Type:    "login_success",
			Payload: payloadBytes,
		}
		data, _ := json.Marshal(successMsg)
		c.sendSafe(data)

	case MsgJoin:
		if c.username == "" {
			log.Printf("MsgJoin failed: User not logged in (Client: %s)", c.conn.RemoteAddr())
			c.sendError("Please login first")
			return
		}
		var payload JoinPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			log.Printf("MsgJoin failed: Invalid payload from %s", c.username)
			return
		}

		log.Printf("Player joining: %s (Class: %s)", c.username, payload.Type)

		// Load user from DB to check for existing character
		user, err := db.GetUser(c.username)
		if err != nil {
			c.sendError("Failed to load user data")
			return
		}

		var char *database.Character
		// Simple logic: Use the first character if it exists, otherwise create one
		// In a real game, we'd have a character selection screen
		if len(user.Characters) > 0 {
			// Find character matching the requested class if possible, or just use the first one
			// For now, let's just use the first one to support persistence
			char = user.Characters[0]
			// If the class doesn't match what they selected in UI, we might want to warn or just use the DB one
			// Let's assume the DB one is authoritative
		} else {
			// Create new character
			char = &database.Character{
				Name:  c.username, // Simple name
				Class: payload.Type,
				Level: 1,
				XP:    0,
				X:     -1.25, // Midpoint between Quest NPC (-25) and Merchant (22.5)
				Y:     0,
				Z:     200, // Town Center Z
				Stats: database.Stats{
					Strength:     10,
					Dexterity:    10,
					Intelligence: 10,
					Wisdom:       10,
					Vitality:     10,
				},
			}
			// Save new character to DB
			var err error
			if user.Characters == nil {
				// If characters array is nil/null in DB, use $set to initialize it
				err = db.SetFirstCharacter(c.username, char)
			} else {
				// Otherwise use $push
				err = db.CreateCharacter(c.username, char)
			}

			if err != nil {
				log.Printf("Failed to create character for %s: %v", c.username, err)
				c.sendError("Failed to create character")
				return
			}
		}

		// Create player entity from DB character
		playerID := "player-" + c.username
		c.playerID = playerID

		entity := &game.Entity{
			ID:             playerID,
			Name:           c.username,
			Type:           game.TypePlayer,
			SubType:        char.Class,
			X:              char.X,
			Y:              char.Y,
			Z:              char.Z,
			Health:         char.Stats.Vitality * 10,
			MaxHealth:      char.Stats.Vitality * 10,
			Mana:           char.Stats.Intelligence * 10,
			MaxMana:        char.Stats.Intelligence * 10,
			Level:          char.Level,
			Experience:     char.XP,
			MaxExperience:  int(100 * math.Pow(1.2, float64(char.Level-1))),
			Gold:           char.Gold,
			State:          "IDLE",
			Damage:         char.Stats.Strength * 2,
			Defense:        0,
			AttackCooldown: 1000 * time.Millisecond,
			Scale:          1.0,
			BaseStats: game.Stats{
				Strength:     char.Stats.Strength,
				Dexterity:    char.Stats.Dexterity,
				Intelligence: char.Stats.Intelligence,
				Wisdom:       char.Stats.Wisdom,
				Vitality:     char.Stats.Vitality,
			},
			SkillPoints:    0,
			SelectedBranch: char.SelectedBranch,
			UnlockedSkills: []string{},
		}

		// Auto-Unlock Skills based on Level and Branch
		world.UpdateUnlockedSkills(entity)

		log.Printf("Login %s: Level %d, Branch %s, Unlocked %v",
			c.username, entity.Level, entity.SelectedBranch, entity.UnlockedSkills)

		// Convert DB Inventory to Game Inventory
		entity.Inventory = make([]game.Item, game.MaxInventorySize)
		if len(char.Inventory) > 0 {
			log.Printf("Loading inventory for %s: %d items", c.username, len(char.Inventory))
			// Fill slots sequentially for now (since DB doesn't store slot index)
			for i, dbItem := range char.Inventory {
				if i >= game.MaxInventorySize {
					break
				}
				// Fix for old items (Shards/Hearts missing MaxStack)
				maxStack := dbItem.MaxStack
				if (dbItem.Name == "Shard" || dbItem.Name == "Eidolon Shard" || dbItem.Name == "Heart" || dbItem.Name == "Eidolon Heart") && maxStack == 0 {
					maxStack = 1000
				}

				// Migration: Rename "Heart" to "Eidolon Heart"
				name := dbItem.Name
				if name == "Heart" {
					name = "Eidolon Heart"
					// Also update icon if needed
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/heart.png" {
						dbItem.Icon = "assets/items/eidolon_heart/eidolon_heart.png"
					}
				}
				// Migration: Rename "Shard" to "Eidolon Shard"
				if name == "Shard" {
					name = "Eidolon Shard"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/shard.png" {
						dbItem.Icon = "assets/items/eidolon_shard/eidolon_shard.png"
					}
				}

				// Fix for old items (Missing Stack count)
				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}

				entity.Inventory[i] = game.Item{
					ID:          dbItem.ID,
					Name:        name,
					Type:        game.ItemType(dbItem.Type),
					Rarity:      game.ItemRarity(dbItem.Rarity),
					Slot:        dbItem.Slot,
					Level:       dbItem.Level,
					Value:       dbItem.Value,
					Icon:        dbItem.Icon,
					Description: dbItem.Description,
					Stats:       dbItem.Stats,
					Stack:       stack,
					MaxStack:    maxStack,
					Potency:     dbItem.Potency,
					Sockets:     dbItem.Sockets,
				}
			}
		}

		// Convert DB Stash to Game Stash
		entity.Stash = make([]game.Item, 0)
		if len(char.Stash) > 0 {
			entity.Stash = make([]game.Item, len(char.Stash))
			for i, dbItem := range char.Stash {
				// Fix for old items
				maxStack := dbItem.MaxStack
				if (dbItem.Name == "Shard" || dbItem.Name == "Eidolon Shard" || dbItem.Name == "Heart" || dbItem.Name == "Eidolon Heart") && maxStack == 0 {
					maxStack = 1000
				}

				// Migration: Rename "Heart" to "Eidolon Heart"
				name := dbItem.Name
				if name == "Heart" {
					name = "Eidolon Heart"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/heart.png" {
						dbItem.Icon = "assets/items/eidolon_heart/eidolon_heart.png"
					}
				}
				// Migration: Rename "Shard" to "Eidolon Shard"
				if name == "Shard" {
					name = "Eidolon Shard"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/shard.png" {
						dbItem.Icon = "assets/items/eidolon_shard/eidolon_shard.png"
					}
				}

				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}

				entity.Stash[i] = game.Item{
					ID:          dbItem.ID,
					Name:        name,
					Type:        game.ItemType(dbItem.Type),
					Rarity:      game.ItemRarity(dbItem.Rarity),
					Slot:        dbItem.Slot,
					Level:       dbItem.Level,
					Value:       dbItem.Value,
					Icon:        dbItem.Icon,
					Description: dbItem.Description,
					Stats:       dbItem.Stats,
					Stack:       stack,
					MaxStack:    maxStack,
					Potency:     dbItem.Potency,
					Sockets:     dbItem.Sockets,
				}
			}
		}

		// Convert DB Buyback to Game Buyback
		entity.Buyback = make([]game.Item, 0)
		if len(char.Buyback) > 0 {
			entity.Buyback = make([]game.Item, len(char.Buyback))
			for i, dbItem := range char.Buyback {
				// Fix for old items
				maxStack := dbItem.MaxStack
				if (dbItem.Name == "Shard" || dbItem.Name == "Eidolon Shard" || dbItem.Name == "Heart" || dbItem.Name == "Eidolon Heart") && maxStack == 0 {
					maxStack = 1000
				}

				// Migration: Rename "Heart" to "Eidolon Heart"
				name := dbItem.Name
				if name == "Heart" {
					name = "Eidolon Heart"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/heart.png" {
						dbItem.Icon = "assets/items/eidolon_heart/eidolon_heart.png"
					}
				}
				// Migration: Rename "Shard" to "Eidolon Shard"
				if name == "Shard" {
					name = "Eidolon Shard"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/shard.png" {
						dbItem.Icon = "assets/items/eidolon_shard/eidolon_shard.png"
					}
				}

				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}

				entity.Buyback[i] = game.Item{
					ID:          dbItem.ID,
					Name:        name,
					Type:        game.ItemType(dbItem.Type),
					Rarity:      game.ItemRarity(dbItem.Rarity),
					Slot:        dbItem.Slot,
					Level:       dbItem.Level,
					Value:       dbItem.Value,
					Icon:        dbItem.Icon,
					Description: dbItem.Description,
					Stats:       dbItem.Stats,
					Stack:       stack,
					MaxStack:    maxStack,
					Potency:     dbItem.Potency,
					Sockets:     dbItem.Sockets,
				}
			}
		}

		// Convert DB Equipment to Game Equipment
		entity.Equipment = make(map[string]game.Item)
		if len(char.Equipment) > 0 {
			for slot, dbItem := range char.Equipment {
				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}
				entity.Equipment[slot] = game.Item{
					ID:          dbItem.ID,
					Name:        dbItem.Name,
					Type:        game.ItemType(dbItem.Type),
					Rarity:      game.ItemRarity(dbItem.Rarity),
					Slot:        dbItem.Slot,
					Level:       dbItem.Level,
					Value:       dbItem.Value,
					Icon:        dbItem.Icon,
					Description: dbItem.Description,
					Stats:       dbItem.Stats,
					Stack:       stack,
					MaxStack:    dbItem.MaxStack,
					Potency:     dbItem.Potency,
					Sockets:     dbItem.Sockets,
				}
			}
		}

		// Convert DB Quests to Game Quests
		if len(char.Quests) > 0 {
			entity.Quests = make([]game.Quest, len(char.Quests))
			for i, q := range char.Quests {
				entity.Quests[i] = game.Quest{
					ID:        q.ID,
					Type:      q.Type,
					Target:    q.Target,
					Count:     q.Count,
					MaxCount:  q.MaxCount,
					RewardXP:  q.RewardXP,
					Completed: q.Completed,
					Accepted:  q.Accepted,
				}
			}
		}
		entity.LastDailyQuest = char.LastDailyQuest

		// Fix for persistence issue: If we have quests but no date (or zero date), assume they are valid for today to prevent reset
		if len(entity.Quests) > 0 && entity.LastDailyQuest.IsZero() {
			log.Printf("Restoring LastDailyQuest for %s (was zero, setting to Now)", c.username)
			entity.LastDailyQuest = time.Now().UTC()
		}

		entity.RecalculateStats()
		world.AddEntity(entity)

		// Generate Daily Quests if needed
		world.GenerateDailyQuests(playerID)

		// Send initial inventory
		if len(entity.Inventory) > 0 {
			invPayload, _ := json.Marshal(entity.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

		// Send initial stash
		if len(entity.Stash) > 0 {
			stashPayload, _ := json.Marshal(entity.Stash)
			msg := Message{
				Type:    MsgStash,
				Payload: stashPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

		// Send initial quests
		if len(entity.Quests) > 0 {
			questPayload, _ := json.Marshal(entity.Quests)
			msg := Message{
				Type:    MsgQuestUpdate,
				Payload: questPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgEnterDungeon:
		if c.playerID == "" {
			return
		}

		var req struct {
			DungeonType string `json:"dungeonType"`
		}
		if len(msg.Payload) > 0 {
			json.Unmarshal(msg.Payload, &req)
		}
		dungeonType := req.DungeonType
		if dungeonType == "" {
			dungeonType = "crypt"
		}

		player := world.GetEntityCopy(c.playerID)
		if player == nil {
			return
		}

		if player.PartyID == "" {
			c.sendError("You must be in a party to enter a dungeon.")
			return
		}

		// Create Dungeon
		log.Printf("Creating dungeon for party %s (Player: %s)", player.PartyID, c.playerID)
		instanceID := world.CreateDungeon(player.PartyID, dungeonType)
		log.Printf("Dungeon created: %s", instanceID)
		// c.sendError(fmt.Sprintf("Debug: Dungeon Created %s", instanceID))

		// Get Party
		party := world.GetParty(player.PartyID)
		if party == nil {
			c.sendError("Debug: Party not found")
			return
		}

		// Get members safely
		_, _, members := party.GetSnapshot()

		for _, memberID := range members {
			err := world.EnterInstance(memberID, instanceID)
			if err != nil {
				// c.sendError(fmt.Sprintf("Debug: EnterInstance failed for %s: %v", memberID, err))
				continue
			}

			// Notify Client
			sessionsMu.Lock()
			var memberClient *Client
			for _, mc := range activeSessions {
				if mc.playerID == memberID {
					memberClient = mc
					break
				}
			}
			sessionsMu.Unlock()

			if memberClient != nil {
				layout, hasLayout := world.GetInstanceLayout(instanceID)
				if hasLayout {
					log.Printf("Sending layout to %s: %d rooms", memberID, len(layout.Rooms))
				} else {
					log.Printf("Sending NO layout to %s", memberID)
				}

				resp := map[string]interface{}{
					"instanceId": instanceID,
					"type":       dungeonType,
				}
				if hasLayout {
					resp["layout"] = layout
				}
				payloadBytes, _ := json.Marshal(resp)

				msg := Message{
					Type:    MsgEnterInstance,
					Payload: payloadBytes,
				}
				b, _ := json.Marshal(msg)
				memberClient.sendSafe(b)
				// memberClient.sendError("Debug: Sent EnterInstance")
			}
		}

	case MsgGetDungeonStatus:
		if c.playerID == "" {
			return
		}
		player := world.GetEntityCopy(c.playerID)
		if player == nil {
			return
		}

		// Auto-create party for solo players
		if player.PartyID == "" {
			party := world.CreateParty(c.playerID)
			if party != nil {
				broadcastPartyUpdate(party)
				// Update local player copy's PartyID
				player.PartyID = party.ID
			} else {
				// Check if failure was due to race condition (already in party)
				updatedPlayer := world.GetEntityCopy(c.playerID)
				if updatedPlayer != nil && updatedPlayer.PartyID != "" {
					player.PartyID = updatedPlayer.PartyID
				} else {
					// DEBUG: Detailed failure reason
					exists := false
					pid := "nil"
					if updatedPlayer != nil {
						exists = true
						pid = updatedPlayer.PartyID
					}
					c.sendError(fmt.Sprintf("Failed to create party. Exists: %v, PID: %s, ID: %s", exists, pid, c.playerID))
					return
				}
			}
		}

		hasInstance, timeLeft := world.GetDungeonStatus(player.PartyID)

		// Check if leader
		party := world.GetParty(player.PartyID)
		isLeader := false
		if party != nil {
			leaderID, _, _ := party.GetSnapshot()
			isLeader = (leaderID == c.playerID)
		}

		resp := map[string]interface{}{
			"hasInstance": hasInstance,
			"timeLeft":    timeLeft,
			"isLeader":    isLeader,
		}
		payloadBytes, _ := json.Marshal(resp)
		log.Printf("Sending Dungeon Menu to %s: %+v", c.username, resp)
		c.sendSafe(createMessage(MsgGetDungeonStatus, payloadBytes))
		// c.sendError(fmt.Sprintf("Debug: Menu Data Sent. Party: %s, Leader: %v", player.PartyID, isLeader))

	case MsgResetDungeon:
		if c.playerID == "" {
			return
		}
		player := world.GetEntityCopy(c.playerID)
		if player == nil || player.PartyID == "" {
			return
		}

		party := world.GetParty(player.PartyID)
		if party == nil {
			return
		}
		leaderID, _, _ := party.GetSnapshot()
		if leaderID != c.playerID {
			c.sendError("Only the party leader can reset the dungeon.")
			return
		}

		world.ResetDungeon(player.PartyID)
		c.sendError("Dungeon reset.") // Using sendError for notification for now

	case MsgMove:
		if c.playerID == "" {
			return
		}
		var payload MovePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		// Authoritative movement validation should happen here
		// For now, trust client but update world state

		// Check for respawn immunity first
		if e := world.GetEntity(c.playerID); e != nil {
			if time.Since(e.LastRespawnTime) < 1*time.Second {
				return
			}

			// Basic distance validation to prevent teleporting across map due to lag/race conditions
			// e.g. Client sends (0,0) after server moved player to (20000, 20000)
			dx := payload.X - e.X
			dz := payload.Z - e.Z
			distSq := dx*dx + dz*dz
			if distSq > 100*100 { // 100 units max jump per frame
				// Ignore this move packet, it's likely from the previous context
				// log.Printf("Ignored large move for %s: distSq=%f", c.playerID, distSq)
				return
			}
		}

		world.UpdateEntityPosition(c.playerID, payload.X, payload.Y, payload.Z, payload.Rotation)
		if e := world.GetEntity(c.playerID); e != nil {
			if payload.State != "" {
				e.State = payload.State
			} else {
				e.State = "MOVING" // Fallback
			}
		}

	case MsgAttack:
		if c.playerID == "" {
			return
		}
		var payload AttackPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		world.PerformAttack(c.playerID, payload.TargetID)
		// Damage is now broadcast via OnEvent("damage") asynchronously

	case MsgPickup:
		if c.playerID == "" {
			return
		}
		var payload PickupPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformPickup(c.playerID, payload.LootID)
		if success {
			// Send inventory update to player
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgAbility:
		if c.playerID == "" {
			return
		}
		var payload AbilityPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		world.PerformAbility(c.playerID, payload.TargetX, payload.TargetZ, payload.TargetID, payload.SkillName)

	case MsgChat:
		if c.username == "" {
			return
		}
		var payload ChatPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		// Broadcast chat
		outPayload := ChatPayload{
			Message: payload.Message,
			Sender:  c.username,
		}
		b, _ := json.Marshal(outPayload)
		outMsg := Message{
			Type:    MsgChat,
			Payload: b,
		}
		data, _ := json.Marshal(outMsg)
		broadcast <- BroadcastMessage{Type: MsgChat, Data: data}

	case MsgEquip:
		if c.playerID == "" {
			return
		}
		var payload EquipPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformEquip(c.playerID, payload.ItemID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgUnequip:
		if c.playerID == "" {
			return
		}
		var payload UnequipPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformUnequip(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgInventoryMove:
		if c.playerID == "" {
			return
		}
		var payload InventoryMovePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformInventoryMove(c.playerID, payload.FromIndex, payload.ToIndex)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgSplitStack:
		if c.playerID == "" {
			return
		}
		var payload SplitStackPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformSplitStack(c.playerID, payload.Slot, payload.Amount)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgTradingSearch:
		var payload TradingSearchPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		results := world.Trading.SearchAuctions(payload.Query)

		resPayload, _ := json.Marshal(results)
		msg := Message{
			Type:    "trading_list",
			Payload: resPayload,
		}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)

	case MsgTradingMyAuctions:
		if c.playerID == "" {
			return
		}
		results := world.Trading.GetPlayerAuctions(c.playerID)

		resPayload, _ := json.Marshal(results)
		msg := Message{
			Type:    "trading_my_list",
			Payload: resPayload,
		}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)

	case MsgTradingCreate:
		if c.playerID == "" {
			return
		}
		var payload TradingCreatePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		world.Mu.Lock()
		player, ok := world.Entities[c.playerID]
		world.Mu.Unlock()

		if !ok {
			return
		}

		player.Mu.Lock()
		if payload.SlotIndex < 0 || payload.SlotIndex >= len(player.Inventory) {
			player.Mu.Unlock()
			c.sendError("Invalid inventory slot")
			return
		}
		item := player.Inventory[payload.SlotIndex]

		if item.ID == "" {
			player.Mu.Unlock()
			c.sendError("No item in slot")
			return
		}

		// Remove item immediately to prevent duplication
		copy(player.Inventory[payload.SlotIndex:], player.Inventory[payload.SlotIndex+1:])
		player.Inventory = player.Inventory[:len(player.Inventory)-1]
		player.Mu.Unlock()

		_, err := world.Trading.CreateAuction(player, item, payload.Bid, payload.Buyout, payload.Duration)
		if err != nil {
			// Refund item on failure
			player.Mu.Lock()
			player.AddItemToInventory(item)
			player.Mu.Unlock()
			c.sendError(err.Error())

			// Send Inventory Update (to show item back)
			player.Mu.Lock()
			invPayload, _ := json.Marshal(player.Inventory)
			player.Mu.Unlock()
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
			return
		}

		invPayload, _ := json.Marshal(player.Inventory)
		msg := Message{
			Type:    MsgInventory,
			Payload: invPayload,
		}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)

		results := world.Trading.GetPlayerAuctions(c.playerID)
		resPayload, _ := json.Marshal(results)
		msg2 := Message{
			Type:    "trading_my_list",
			Payload: resPayload,
		}
		b2, _ := json.Marshal(msg2)
		c.sendSafe(b2)

	case MsgTradingBid:
		if c.playerID == "" {
			return
		}
		var payload TradingBidPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		world.Mu.Lock()
		player, ok := world.Entities[c.playerID]
		world.Mu.Unlock()

		if !ok {
			return
		}

		refundFunc := func(targetID, targetName string, amount int) {
			// Try to find online player
			world.Mu.Lock()
			target, ok := world.Entities[targetID]
			world.Mu.Unlock()

			if ok {
				target.Mu.Lock()
				target.Gold += amount
				target.Mu.Unlock()

				// We could try to notify them if we had the client, but gold update is enough for now.
				// Next time they check inventory it will be there.
			} else {
				// Offline refund
				char, err := db.GetCharacter(targetID, targetName)
				if err == nil {
					char.Gold += amount
					db.SaveCharacter(targetID, char)
				}
			}
		}

		err := world.Trading.BidAuction(payload.AuctionID, player, payload.Amount, refundFunc)
		if err != nil {
			c.sendError(err.Error())
			return
		}

		// Send Inventory Update (Gold changed)
		player.Mu.Lock()
		invPayload, _ := json.Marshal(player.Inventory)
		player.Mu.Unlock()
		msgInv := Message{
			Type:    MsgInventory,
			Payload: invPayload,
		}
		bInv, _ := json.Marshal(msgInv)
		c.sendSafe(bInv)

		c.sendError("Bid placed!")

		// Refresh Search List
		msgRefresh := Message{
			Type:    "trading_refresh",
			Payload: nil,
		}
		bRefresh, _ := json.Marshal(msgRefresh)
		c.sendSafe(bRefresh)

	case MsgTradingBuyout:
		if c.playerID == "" {
			return
		}
		var payload TradingBuyoutPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		world.Mu.Lock()
		player, ok := world.Entities[c.playerID]
		world.Mu.Unlock()

		if !ok {
			return
		}

		_, err := world.Trading.BuyoutAuction(payload.AuctionID, player, world)
		if err != nil {
			c.sendError(err.Error())
			return
		}

		invPayload, _ := json.Marshal(player.Inventory)
		msg := Message{
			Type:    MsgInventory,
			Payload: invPayload,
		}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)

		c.sendError("Auction bought!")

		// Refresh Search List
		msgRefresh := Message{
			Type:    "trading_refresh",
			Payload: nil,
		}
		bRefresh, _ := json.Marshal(msgRefresh)
		c.sendSafe(bRefresh)

	case MsgTradingCollect:
		if c.playerID == "" {
			return
		}
		var payload TradingCollectPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		world.Mu.Lock()
		player, ok := world.Entities[c.playerID]
		world.Mu.Unlock()

		if !ok {
			return
		}

		result, err := world.Trading.CollectAuction(payload.AuctionID, player)
		if err != nil {
			c.sendError(err.Error())
			return
		}

		if gold, ok := result.(int); ok {
			c.sendError(fmt.Sprintf("Collected %d gold", gold))
		} else if item, ok := result.(game.Item); ok {
			player.Mu.Lock()
			remaining := player.AddItemToInventory(item)
			player.Mu.Unlock()

			if remaining > 0 {
				// Update item stack to remaining amount
				item.Stack = remaining

				// Fallback to Stash
				player.Mu.Lock()
				stashRemaining := player.AddItemToStash(item)
				player.Mu.Unlock()

				if stashRemaining == 0 {
					c.sendError("Inventory full! Item sent to Stash.")
					// Send Stash Update
					stashPayload, _ := json.Marshal(player.Stash)
					msgStash := Message{
						Type:    MsgStash,
						Payload: stashPayload,
					}
					bStash, _ := json.Marshal(msgStash)
					c.sendSafe(bStash)
				} else {
					// Stash also full - Drop on Ground
					item.Stack = stashRemaining
					world.DropLoot(item, player.X, player.Z)
					c.sendError("Inventory & Stash full! Item dropped on ground.")
				}
			} else {
				c.sendError("Item reclaimed")
			}
		}

		invPayload, _ := json.Marshal(player.Inventory)
		msg := Message{
			Type:    MsgInventory,
			Payload: invPayload,
		}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)

		results := world.Trading.GetPlayerAuctions(c.playerID)
		resPayload, _ := json.Marshal(results)
		msg2 := Message{
			Type:    "trading_my_list",
			Payload: resPayload,
		}
		b2, _ := json.Marshal(msg2)
		c.sendSafe(b2)

		// Refresh Search List
		msgRefresh := Message{
			Type:    "trading_refresh",
			Payload: nil,
		}
		bRefresh, _ := json.Marshal(msgRefresh)
		c.sendSafe(bRefresh)

	case MsgTradingCancel:
		if c.playerID == "" {
			return
		}
		var payload TradingCancelPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		world.Mu.Lock()
		player, ok := world.Entities[c.playerID]
		world.Mu.Unlock()

		if !ok {
			return
		}

		err := world.Trading.CancelAuction(payload.AuctionID, player, world)
		if err != nil {
			c.sendError(err.Error())
			return
		}

		c.sendError("Auction cancelled & item reclaimed")

		// Send Inventory Update
		player.Mu.Lock()
		invPayload, _ := json.Marshal(player.Inventory)
		player.Mu.Unlock()
		msgInv := Message{
			Type:    MsgInventory,
			Payload: invPayload,
		}
		bInv, _ := json.Marshal(msgInv)
		c.sendSafe(bInv)

		// Refresh My Auctions
		results := world.Trading.GetPlayerAuctions(c.playerID)
		resPayload, _ := json.Marshal(results)
		msg2 := Message{
			Type:    "trading_my_list",
			Payload: resPayload,
		}
		b2, _ := json.Marshal(msg2)
		c.sendSafe(b2)

		// Refresh Search List
		msgRefresh := Message{
			Type:    "trading_refresh",
			Payload: nil,
		}
		bRefresh, _ := json.Marshal(msgRefresh)
		c.sendSafe(bRefresh)

	case MsgBuyGamble:
		if c.playerID == "" {
			return
		}
		var payload BuyGamblePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformBuyGamble(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgSell:
		if c.playerID == "" {
			return
		}
		var payload SellPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformSell(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)

			// Send Buyback Update
			buybackPayload, _ := json.Marshal(player.Buyback)
			msgBuyback := Message{
				Type:    MsgBuybackList,
				Payload: buybackPayload,
			}
			bBuyback, _ := json.Marshal(msgBuyback)
			c.sendSafe(bBuyback)
		}

	case MsgBuyback:
		if c.playerID == "" {
			return
		}
		var payload BuybackPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformBuyback(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)

			// Send Buyback Update
			buybackPayload, _ := json.Marshal(player.Buyback)
			msgBuyback := Message{
				Type:    MsgBuybackList,
				Payload: buybackPayload,
			}
			bBuyback, _ := json.Marshal(msgBuyback)
			c.sendSafe(bBuyback)
		}

	case MsgPartyInvite:
		if c.playerID == "" {
			return
		}
		var payload PartyInvitePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		targetClient := getClientByUsername(payload.TargetName)
		if targetClient == nil {
			c.sendError("Player not found or offline")
			return
		}

		// Check if self
		if targetClient.playerID == c.playerID {
			c.sendError("Cannot invite yourself")
			return
		}

		inviter := world.GetEntity(c.playerID)
		if inviter == nil {
			return
		}

		// Create party if not exists
		if inviter.PartyID == "" {
			party := world.CreateParty(c.playerID)
			if party == nil {
				c.sendError("Failed to create party")
				return
			}
			broadcastPartyUpdate(party) // Update inviter's UI
		} else {
			// Check if leader
			party := world.GetParty(inviter.PartyID)
			if party == nil {
				// Inconsistent state
				inviter.PartyID = ""
				return
			}
			if party.LeaderID != c.playerID {
				c.sendError("Only party leader can invite")
				return
			}
			if len(party.Members) >= party.MaxSize {
				c.sendError("Party is full")
				return
			}
		}

		// Send request to target
		reqPayload := PartyRequestPayload{
			TargetName: c.username, // The name of the person inviting
		}
		reqBytes, _ := json.Marshal(reqPayload)
		targetClient.sendSafe(createMessage(MsgPartyRequest, reqBytes))
		c.sendError("Invite sent to " + payload.TargetName)

	case MsgPartyResponse:
		if c.playerID == "" {
			return
		}
		var payload PartyResponsePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		if !payload.Accepted {
			// Notify inviter?
			return
		}

		inviterClient := getClientByUsername(payload.InviterName)
		if inviterClient == nil {
			c.sendError("Inviter is no longer online")
			return
		}

		inviter := world.GetEntity(inviterClient.playerID)
		if inviter == nil || inviter.PartyID == "" {
			c.sendError("Party no longer exists")
			return
		}

		err := world.JoinParty(inviter.PartyID, c.playerID)
		if err != nil {
			c.sendError("Failed to join party: " + err.Error())
			return
		}

		party := world.GetParty(inviter.PartyID)
		broadcastPartyUpdate(party)

	case MsgPartyLeave:
		if c.playerID == "" {
			return
		}
		party, err := world.LeaveParty(c.playerID)
		if err != nil {
			c.sendError(err.Error())
			return
		}

		// Clear client's party UI
		emptyPayload := map[string]interface{}{
			"partyId": "",
			"members": []interface{}{},
		}
		emptyBytes, _ := json.Marshal(emptyPayload)
		c.sendSafe(createMessage(MsgPartyUpdate, emptyBytes))

		if party != nil {
			broadcastPartyUpdate(party)
		}

	case MsgPartyKick:
		if c.playerID == "" {
			return
		}
		var payload PartyKickPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		party, err := world.KickPartyMember(c.playerID, payload.TargetID)
		if err != nil {
			c.sendError(err.Error())
			return
		}

		broadcastPartyUpdate(party)

		// Notify kicked player
		targetClient := getClientByPlayerID(payload.TargetID)
		if targetClient != nil {
			emptyPayload := map[string]interface{}{
				"partyId": "",
				"members": []interface{}{},
			}
			emptyBytes, _ := json.Marshal(emptyPayload)
			targetClient.sendSafe(createMessage(MsgPartyUpdate, emptyBytes))
			targetClient.sendError("You have been kicked from the party")
		}

	case MsgPartyPromote:
		if c.playerID == "" {
			return
		}
		var payload PartyPromotePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		party, err := world.PromotePartyMember(c.playerID, payload.TargetID)
		if err != nil {
			c.sendError(err.Error())
			return
		}

		broadcastPartyUpdate(party)

	case MsgSocial:
		// Gather online players
		var playerList []SocialEntry
		sessionsMu.Lock()
		for _, client := range activeSessions {
			if client.playerID != "" {
				entity := world.GetEntity(client.playerID)
				if entity != nil {
					playerList = append(playerList, SocialEntry{
						Name:  entity.Name,
						Class: entity.SubType,
						Level: entity.Level,
					})
				}
			}
		}
		sessionsMu.Unlock()

		payload, _ := json.Marshal(playerList)
		msg := Message{
			Type:    MsgSocial,
			Payload: payload,
		}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	case MsgRespawn:
		if c.playerID == "" {
			return
		}

		// Check if in instance before respawn resets it
		p := world.GetEntity(c.playerID)
		wasInInstance := p != nil && p.InstanceID != ""

		world.PerformRespawn(c.playerID)

		if wasInInstance {
			log.Printf("Respawn: Sending return to overworld for %s", c.playerID)
			// Send "return to overworld" message
			resp := map[string]interface{}{
				"instanceId": "",
				"type":       "overworld",
			}
			payloadBytes, _ := json.Marshal(resp)
			msg := Message{
				Type:    MsgEnterInstance,
				Payload: payloadBytes,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgRecall:
		if c.playerID == "" {
			return
		}

		// Check if in instance before recall resets it
		p := world.GetEntity(c.playerID)
		wasInInstance := p != nil && p.InstanceID != ""

		world.PerformRecall(c.playerID)

		if wasInInstance {
			log.Printf("Recall: Sending return to overworld for %s", c.playerID)
			// Send "return to overworld" message
			resp := map[string]interface{}{
				"instanceId": "",
				"type":       "overworld",
			}
			payloadBytes, _ := json.Marshal(resp)
			msg := Message{
				Type:    MsgEnterInstance,
				Payload: payloadBytes,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgReport:
		var payload ReportPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		saveReport(c.username, payload)

	case MsgStashDeposit:
		if c.playerID == "" {
			return
		}
		var payload StashDepositPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformStashDeposit(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)

			// Send Stash Update
			stashPayload, _ := json.Marshal(player.Stash)
			msgStash := Message{
				Type:    MsgStash,
				Payload: stashPayload,
			}
			bStash, _ := json.Marshal(msgStash)
			c.sendSafe(bStash)
		}

	case MsgStashWithdraw:
		if c.playerID == "" {
			return
		}
		var payload StashWithdrawPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformStashWithdraw(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)

			// Send Stash Update
			stashPayload, _ := json.Marshal(player.Stash)
			msgStash := Message{
				Type:    MsgStash,
				Payload: stashPayload,
			}
			bStash, _ := json.Marshal(msgStash)
			c.sendSafe(bStash)
		}

	case MsgAcceptQuest:
		if c.playerID == "" {
			return
		}
		var payload AcceptQuestPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformAcceptQuest(c.playerID, payload.QuestID)
		if success {
			// Send Quest Update
			questPayload, _ := json.Marshal(player.Quests)
			msg := Message{
				Type:    MsgQuestUpdate,
				Payload: questPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgCompleteQuest:
		if c.playerID == "" {
			return
		}
		var payload CompleteQuestPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformCompleteQuest(c.playerID, payload.QuestID)
		if success {
			// Send Quest Update
			questPayload, _ := json.Marshal(player.Quests)
			msg := Message{
				Type:    MsgQuestUpdate,
				Payload: questPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgForgeUpgrade:
		if c.playerID == "" {
			return
		}
		var payload ForgeUpgradePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeUpgrade(c.playerID, payload.Slot, payload.Amount)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
		} else {
			c.sendError(msgStr)
		}

	case MsgForgePotency:
		if c.playerID == "" {
			return
		}
		var payload ForgePotencyPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgePotency(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
		} else {
			c.sendError(msgStr)
		}

	case MsgForgeSocket:
		if c.playerID == "" {
			return
		}
		var payload ForgeSocketPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeSocket(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
		} else {
			c.sendError(msgStr)
		}

	case MsgSelectBranch:
		if c.playerID == "" {
			return
		}
		var payload SelectBranchPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if _, success := world.PerformSelectBranch(c.playerID, payload.Branch); success {
			savePlayer(c) // Persist immediately
		}

	case MsgUnlockSkill:
		if c.playerID == "" {
			return
		}
		var payload UnlockSkillPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if _, success := world.PerformUnlockSkill(c.playerID, payload.SkillName); success {
			savePlayer(c) // Persist immediately
		}
	}
}

func (c *Client) sendSafe(data []byte) {
	defer func() {
		if r := recover(); r != nil {
			// Channel closed, client disconnected
		}
	}()
	c.send <- data
}

func (c *Client) sendError(msg string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from sendError panic: %v", r)
		}
	}()
	m := Message{
		Type:    MsgError,
		Payload: json.RawMessage(`"` + msg + `"`),
	}
	b, _ := json.Marshal(m)
	c.send <- b
}

func broadcastState() {
	// 1. Copy active sessions to minimize lock time
	sessionsMu.Lock()
	clients := make([]*Client, 0, len(activeSessions))
	for _, client := range activeSessions {
		if client.playerID != "" {
			clients = append(clients, client)
		}
	}
	sessionsMu.Unlock()

	// 2. Process in parallel
	var wg sync.WaitGroup

	// Pre-defined JSON parts to avoid double-marshaling
	stateHeader := []byte(`{"type":"state","payload":`)
	stateFooter := []byte(`}`)

	for _, client := range clients {
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					// Client likely disconnected
				}
			}()

			// Get custom state (100 unit radius)
			state := world.GetStateForPlayer(c.playerID, 100.0)

			payload, err := json.Marshal(state)
			if err != nil {
				return
			}

			// Construct full JSON message
			data := make([]byte, 0, len(stateHeader)+len(payload)+len(stateFooter))
			data = append(data, stateHeader...)
			data = append(data, payload...)
			data = append(data, stateFooter...)

			// Compress using GZIP (Pooled)
			var b bytes.Buffer
			gz := gzipWriterPool.Get().(*gzip.Writer)
			gz.Reset(&b)

			if _, err := gz.Write(data); err != nil {
				gzipWriterPool.Put(gz)
				return
			}
			if err := gz.Close(); err != nil {
				gzipWriterPool.Put(gz)
				return
			}
			gzipWriterPool.Put(gz) // Return to pool

			compressedData := b.Bytes()

			// Non-blocking send (Binary Message)
			select {
			case c.send <- compressedData:
			default:
				// Drop message if client is too slow
			}
		}(client)
	}
	wg.Wait()
}

func broadcastTime() {
	// Send server time (seconds since epoch or just a counter)
	// For game timer, maybe just send seconds elapsed since server start or a specific game time
	// Let's send current Unix timestamp
	now := time.Now().Unix()
	payload, _ := json.Marshal(map[string]int64{"time": now})
	msg := Message{
		Type:    "time",
		Payload: payload,
	}
	data, _ := json.Marshal(msg)
	broadcast <- BroadcastMessage{Type: "time", Data: data}
}

func saveAllPlayers() {
	// Create a snapshot of active sessions to avoid holding the lock during DB operations
	var clientsToSave []*Client
	sessionsMu.Lock()
	for _, client := range activeSessions {
		clientsToSave = append(clientsToSave, client)
	}
	sessionsMu.Unlock()

	for _, client := range clientsToSave {
		savePlayer(client)
	}
}

func savePlayer(client *Client) {
	if client.playerID == "" || client.username == "" {
		return
	}

	entity := world.GetEntityCopy(client.playerID)
	if entity == nil {
		return
	}
	saveCharacterDB(client, entity)
}

func saveCharacterDB(client *Client, entity *game.Entity) {
	// Update DB character
	char := &database.Character{
		Name:  client.username,
		Class: entity.SubType,
		Level: entity.Level,
		XP:    entity.Experience,
		Gold:  entity.Gold,
		X:     entity.X,
		Y:     entity.Y,
		Z:     entity.Z,
		Stats: database.Stats{
			Vitality:     entity.BaseStats.Vitality,
			Strength:     entity.BaseStats.Strength,
			Dexterity:    entity.BaseStats.Dexterity,
			Intelligence: entity.BaseStats.Intelligence,
			Wisdom:       entity.BaseStats.Wisdom,
		},
		SkillPoints:    entity.SkillPoints,
		SelectedBranch: entity.SelectedBranch,
		UnlockedSkills: entity.UnlockedSkills,
	}

	// Convert Game Inventory to DB Inventory
	char.Inventory = make([]database.Item, 0)
	if len(entity.Inventory) > 0 {
		// Filter empty items
		validItems := make([]game.Item, 0)
		for _, item := range entity.Inventory {
			if item.ID != "" {
				validItems = append(validItems, item)
			}
		}

		char.Inventory = make([]database.Item, len(validItems))
		for i, item := range validItems {
			char.Inventory[i] = database.Item{
				ID:          item.ID,
				Name:        item.Name,
				Type:        string(item.Type),
				Rarity:      string(item.Rarity),
				Slot:        item.Slot,
				Level:       item.Level,
				Value:       item.Value,
				Icon:        item.Icon,
				Description: item.Description,
				Stats:       item.Stats,
				Stack:       item.Stack,
				MaxStack:    item.MaxStack,
				Potency:     item.Potency,
				Sockets:     item.Sockets,
			}
		}
	}

	// Convert Game Stash to DB Stash
	char.Stash = make([]database.Item, 0)
	if len(entity.Stash) > 0 {
		char.Stash = make([]database.Item, len(entity.Stash))
		for i, item := range entity.Stash {
			char.Stash[i] = database.Item{
				ID:          item.ID,
				Name:        item.Name,
				Type:        string(item.Type),
				Rarity:      string(item.Rarity),
				Slot:        item.Slot,
				Level:       item.Level,
				Value:       item.Value,
				Icon:        item.Icon,
				Description: item.Description,
				Stats:       item.Stats,
				Stack:       item.Stack,
				MaxStack:    item.MaxStack,
				Potency:     item.Potency,
				Sockets:     item.Sockets,
			}
		}
	}

	// Convert Game Buyback to DB Buyback
	char.Buyback = make([]database.Item, 0)
	if len(entity.Buyback) > 0 {
		char.Buyback = make([]database.Item, len(entity.Buyback))
		for i, item := range entity.Buyback {
			char.Buyback[i] = database.Item{
				ID:          item.ID,
				Name:        item.Name,
				Type:        string(item.Type),
				Rarity:      string(item.Rarity),
				Slot:        item.Slot,
				Level:       item.Level,
				Value:       item.Value,
				Icon:        item.Icon,
				Description: item.Description,
				Stats:       item.Stats,
				Stack:       item.Stack,
				MaxStack:    item.MaxStack,
				Potency:     item.Potency,
				Sockets:     item.Sockets,
			}
		}
	}

	// Convert Game Equipment to DB Equipment
	char.Equipment = make(map[string]database.Item)
	if len(entity.Equipment) > 0 {
		for slot, item := range entity.Equipment {
			char.Equipment[slot] = database.Item{
				ID:          item.ID,
				Name:        item.Name,
				Type:        string(item.Type),
				Rarity:      string(item.Rarity),
				Slot:        item.Slot,
				Level:       item.Level,
				Value:       item.Value,
				Icon:        item.Icon,
				Description: item.Description,
				Stats:       item.Stats,
				Stack:       item.Stack,
				MaxStack:    item.MaxStack,
				Potency:     item.Potency,
				Sockets:     item.Sockets,
			}
		}
	}

	// Convert Game Quests to DB Quests
	if len(entity.Quests) > 0 {
		char.Quests = make([]database.Quest, len(entity.Quests))
		for i, q := range entity.Quests {
			char.Quests[i] = database.Quest{
				ID:        q.ID,
				Type:      q.Type,
				Target:    q.Target,
				Count:     q.Count,
				MaxCount:  q.MaxCount,
				RewardXP:  q.RewardXP,
				Completed: q.Completed,
				Accepted:  q.Accepted,
			}
		}
	}
	char.LastDailyQuest = entity.LastDailyQuest

	if err := db.SaveCharacter(client.username, char); err != nil {
		log.Printf("Failed to save character for %s: %v", client.username, err)
	} else {
		log.Printf("Saved character for %s (Inv: %d, Equip: %d)", client.username, len(char.Inventory), len(char.Equipment))
	}
}

type SavedReport struct {
	Timestamp  string `json:"timestamp"`
	Username   string `json:"username"`
	ReportType string `json:"reportType"`
	Text       string `json:"text"`
}

func saveReport(username string, payload ReportPayload) {
	report := SavedReport{
		Timestamp:  time.Now().Format(time.RFC3339),
		Username:   username,
		ReportType: payload.ReportType,
		Text:       payload.Text,
	}

	filename := "bug_reports.json"
	var reports []SavedReport

	// Read existing
	data, err := os.ReadFile(filename)
	if err == nil {
		json.Unmarshal(data, &reports)
	}

	// Append
	reports = append(reports, report)

	// Write back
	newData, err := json.MarshalIndent(reports, "", "  ")
	if err != nil {
		log.Printf("Failed to marshal reports: %v", err)
		return
	}

	if err := os.WriteFile(filename, newData, 0644); err != nil {
		log.Printf("Failed to write report file: %v", err)
	} else {
		log.Printf("Saved report from %s: %s", username, payload.ReportType)
	}
}
