package main

import (
	"encoding/json"
	"flag"
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
}

// Global instances
var (
	db    *database.DB
	world *game.World
)

// Client represents a connected player
type Client struct {
	conn     *websocket.Conn
	send     chan []byte
	playerID string
	username string
}

// Message types
const (
	MsgJoin      = "join"
	MsgLogin     = "login"
	MsgRegister  = "register"
	MsgMove      = "move"
	MsgAttack    = "attack"
	MsgDamage    = "damage"
	MsgChat      = "chat"
	MsgState     = "state"
	MsgError     = "error"
	MsgPickup    = "pickup"
	MsgInventory = "inventory"
	MsgAbility   = "ability"
	MsgEquip     = "equip"
	MsgBuyGamble = "buy_gamble"
	MsgSell      = "sell"
)

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
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

type EquipPayload struct {
	ItemID string `json:"itemId"`
	Slot   string `json:"slot"`
}

type AbilityPayload struct {
	TargetX  float64 `json:"targetX"`
	TargetZ  float64 `json:"targetZ"`
	TargetID string  `json:"targetId"`
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

var clients = make(map[*Client]bool)
var activeSessions = make(map[string]*Client)
var sessionsMu sync.Mutex
var broadcast = make(chan []byte)
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

	world = game.NewWorld()

	// Game Loop
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond) // 10 TPS (Reduced from 20 TPS to save bandwidth)
		for range ticker.C {
			world.Update(0.1) // Update dt to match ticker
			broadcastState()
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
				// Save character state before removing
				savePlayer(client)
				if client.playerID != "" {
					world.RemoveEntity(client.playerID)
				}

				// Remove from active sessions
				sessionsMu.Lock()
				if existing, exists := activeSessions[client.username]; exists && existing == client {
					delete(activeSessions, client.username)
				}
				sessionsMu.Unlock()

				delete(clients, client)
				close(client.send)
			}
		case message := <-broadcast:
			for client := range clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(clients, client)
				}
			}
		}
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
		send: make(chan []byte, 1024), // Increased buffer size
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

			w, err := c.conn.NextWriter(websocket.TextMessage)
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
		if oldClient, ok := activeSessions[c.username]; ok {
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
		c.send <- data

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
				X:     0,
				Y:     0,
				Z:     0,
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
			BaseStats: game.Stats{
				Strength:     char.Stats.Strength,
				Dexterity:    char.Stats.Dexterity,
				Intelligence: char.Stats.Intelligence,
				Wisdom:       char.Stats.Wisdom,
				Vitality:     char.Stats.Vitality,
			},
		}

		// Convert DB Inventory to Game Inventory
		if len(char.Inventory) > 0 {
			log.Printf("Loading inventory for %s: %d items", c.username, len(char.Inventory))
			entity.Inventory = make([]game.Item, len(char.Inventory))
			for i, dbItem := range char.Inventory {
				// Manual conversion or JSON marshal/unmarshal hack
				// Let's do manual for safety
				entity.Inventory[i] = game.Item{
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
				}
			}
		}

		// Convert DB Equipment to Game Equipment
		if len(char.Equipment) > 0 {
			entity.Equipment = make(map[string]game.Item)
			for slot, dbItem := range char.Equipment {
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
				}
			}
		}

		entity.RecalculateStats()
		world.AddEntity(entity)

		// Send initial inventory
		if len(entity.Inventory) > 0 {
			invPayload, _ := json.Marshal(entity.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.send <- b
		}

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
		if e := world.GetEntity(c.playerID); e != nil {
			e.X = payload.X
			e.Y = payload.Y
			e.Z = payload.Z
			e.Rotation = payload.Rotation
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

		damage, success := world.PerformAttack(c.playerID, payload.TargetID)
		if success {
			// Broadcast damage event
			dmgPayload := DamagePayload{
				TargetID: payload.TargetID,
				Amount:   damage,
				SourceID: c.playerID,
			}
			b, _ := json.Marshal(dmgPayload)
			outMsg := Message{
				Type:    MsgDamage,
				Payload: b,
			}
			data, _ := json.Marshal(outMsg)
			broadcast <- data
		}

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
			c.send <- b
		}

	case MsgAbility:
		if c.playerID == "" {
			return
		}
		var payload AbilityPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		world.PerformAbility(c.playerID, payload.TargetX, payload.TargetZ, payload.TargetID)

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
		broadcast <- data

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
			c.send <- b
		}

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
			c.send <- b
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
			c.send <- b
		}
	}
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
	state := world.GetState()
	payload, _ := json.Marshal(state)
	msg := Message{
		Type:    MsgState,
		Payload: payload,
	}
	data, _ := json.Marshal(msg)
	broadcast <- data
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
	broadcast <- data
}

func saveAllPlayers() {
	for client := range clients {
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
	}

	// Convert Game Inventory to DB Inventory
	if len(entity.Inventory) > 0 {
		char.Inventory = make([]database.Item, len(entity.Inventory))
		for i, item := range entity.Inventory {
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
			}
		}
	}

	// Convert Game Equipment to DB Equipment
	if len(entity.Equipment) > 0 {
		char.Equipment = make(map[string]database.Item)
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
			}
		}
	}

	// Run in goroutine to not block
	// go func(u string, c *database.Character) {
	if err := db.SaveCharacter(client.username, char); err != nil {
		log.Printf("Failed to save character for %s: %v", client.username, err)
	} else {
		log.Printf("Saved character for %s (Inv: %d, Equip: %d)", client.username, len(char.Inventory), len(char.Equipment))
	}
	// }(client.username, char)
}
