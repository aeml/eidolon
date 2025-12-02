package main

import (
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	addr  = flag.String("addr", "localhost:8080", "http service address")
	count = flag.Int("n", 10, "number of bots")
)

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type Entity struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	X         float64         `json:"x"`
	Z         float64         `json:"z"`
	State     string          `json:"state"`
	Health    int             `json:"health"`
	Equipment map[string]Item `json:"equipment"`
}

type Item struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Slot   string `json:"slot"`
	Level  int    `json:"level"`
	Rarity string `json:"rarity"`
	Value  int    `json:"value"`
}

func main() {
	flag.Parse()
	rand.Seed(time.Now().UnixNano())
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	u := url.URL{Scheme: "wss", Host: *addr, Path: "/ws"}
	log.Printf("Connecting to %s with %d bots...", u.String(), *count)

	var wg sync.WaitGroup

	for i := 0; i < *count; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			runBot(id, u.String())
		}(i)
		// Stagger connections slightly to avoid hammering the server all at once
		time.Sleep(50 * time.Millisecond)
	}

	// Wait for interrupt to stop
	<-interrupt
	log.Println("Stopping bots...")
}

func runBot(id int, urlStr string) {
	dialer := *websocket.DefaultDialer
	dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}

	c, resp, err := dialer.Dial(urlStr, nil)
	if err != nil {
		if resp != nil {
			log.Printf("Bot %d dial error: %v, Status: %s", id, err, resp.Status)
		} else {
			log.Printf("Bot %d dial error: %v", id, err)
		}
		return
	}
	defer c.Close()

	// Unique username for each run/bot
	username := generateRandomName()
	password := "password123"

	// 1. Register
	regPayload := map[string]string{
		"username": username,
		"email":    username + "@bot.com",
		"password": password,
	}
	if err := send(c, "register", regPayload); err != nil {
		log.Printf("Bot %d register error: %v", id, err)
		return
	}

	// Small delay to ensure registration processes
	time.Sleep(200 * time.Millisecond)

	// 2. Login
	loginPayload := map[string]string{
		"username": username,
		"password": password,
	}
	if err := send(c, "login", loginPayload); err != nil {
		log.Printf("Bot %d login error: %v", id, err)
		return
	}

	// State tracking
	var stateMu sync.RWMutex
	worldState := make(map[string]Entity)
	var inventory []Item
	isSelling := false
	myID := "player-" + username

	// Start reading messages to keep connection alive and handle server responses
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				return
			}

			var msg Message
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			if msg.Type == "state" {
				var entities map[string]Entity
				if err := json.Unmarshal(msg.Payload, &entities); err == nil {
					stateMu.Lock()
					worldState = entities
					stateMu.Unlock()
				}
			} else if msg.Type == "inventory" {
				var inv []Item
				if err := json.Unmarshal(msg.Payload, &inv); err == nil {
					stateMu.Lock()
					inventory = inv

					// Check for upgrades immediately
					me, ok := worldState[myID]
					if ok {
						for _, item := range inv {
							if item.Slot == "" {
								continue
							}

							current, hasEquip := me.Equipment[item.Slot]

							// Simple score: Rarity * 1000 + Level
							getScore := func(i Item) int {
								r := 0
								switch i.Rarity {
								case "Legendary":
									r = 4
								case "Epic":
									r = 3
								case "Rare":
									r = 2
								case "Uncommon":
									r = 1
								}
								return r*1000 + i.Level
							}

							newScore := getScore(item)
							curScore := -1
							if hasEquip {
								curScore = getScore(current)
							}

							if newScore > curScore {
								// Equip it!
								// Note: We launch this in a goroutine or just send it?
								// Send is safe if concurrent? send() uses c.WriteJSON which is NOT concurrent safe usually.
								// But here we are in the read loop. We should probably use a channel or lock for writing.
								// For this simple test, let's assume low contention or risk it,
								// OR better: set a flag/queue for the main loop to handle.
								// Actually, let's just log it for now and let the main loop handle logic?
								// No, let's try to send. But `send` is used by main loop too.
								// We need a mutex for the websocket write.
							}
						}
					}

					// Check if full
					count := 0
					for _, it := range inv {
						if it.ID != "" {
							count++
						}
					}
					if count >= 20 {
						isSelling = true
					} else if count == 0 {
						isSelling = false
					}
					stateMu.Unlock()
				}
			}
		}
	}() // Wait a bit for login to succeed
	time.Sleep(500 * time.Millisecond)

	// 3. Join Game
	archetypes := []string{"Fighter", "Rogue", "Wizard", "Cleric"}
	randomArchetype := archetypes[rand.Intn(len(archetypes))]

	joinPayload := map[string]string{
		"type": randomArchetype,
	}
	if err := send(c, "join", joinPayload); err != nil {
		log.Printf("Bot %d join error: %v", id, err)
		return
	}

	log.Printf("Bot %s joined as %s.", username, randomArchetype)

	// 4. AI Loop
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			stateMu.RLock()
			me, ok := worldState[myID]
			// Copy state to avoid holding lock during logic
			currentState := make(map[string]Entity)
			for k, v := range worldState {
				currentState[k] = v
			}
			currentInv := make([]Item, len(inventory))
			copy(currentInv, inventory)
			selling := isSelling
			stateMu.RUnlock()

			if !ok {
				continue // Wait until we exist
			}

			// 0. Equip Upgrades (Simple check every tick)
			for _, item := range currentInv {
				if item.ID == "" || item.Slot == "" {
					continue
				}

				current, hasEquip := me.Equipment[item.Slot]

				getScore := func(i Item) int {
					r := 0
					switch i.Rarity {
					case "Legendary":
						r = 4
					case "Epic":
						r = 3
					case "Rare":
						r = 2
					case "Uncommon":
						r = 1
					}
					return r*1000 + i.Level
				}

				newScore := getScore(item)
				curScore := -1
				if hasEquip {
					curScore = getScore(current)
				}

				if newScore > curScore {
					send(c, "equip", map[string]string{"itemId": item.ID, "slot": item.Slot})
					// Break to avoid spamming equips in one tick, wait for next inventory update
					break
				}
			}

			// 1. Selling Logic
			if selling {
				distFromTown := math.Sqrt(me.X*me.X + me.Z*me.Z)
				if distFromTown < 5.0 {
					// Sell everything in inventory
					for _, item := range currentInv {
						if item.ID != "" {
							send(c, "sell", map[string]string{"itemId": item.ID})
						}
					}
					// Reset selling flag locally (will be confirmed by empty inventory update)
					stateMu.Lock()
					isSelling = false
					stateMu.Unlock()
				} else {
					// Move to town
					sendMove(c, 0, 0)
				}
				continue
			}

			var target *Entity
			var loot *Entity
			minDist := 1000.0
			minLootDist := 1000.0

			for _, e := range currentState {
				if e.ID == myID {
					continue
				}
				dx := e.X - me.X
				dz := e.Z - me.Z
				dist := math.Sqrt(dx*dx + dz*dz)

				if e.Type == "Enemy" && e.Health > 0 {
					if dist < minDist {
						minDist = dist
						t := e
						target = &t
					}
				} else if e.Type == "Loot" {
					if dist < minLootDist {
						minLootDist = dist
						l := e
						loot = &l
					}
				}
			}

			// Decision
			if loot != nil && minLootDist < 20.0 {
				// Go for loot
				if minLootDist < 2.0 {
					send(c, "pickup", map[string]string{"lootId": loot.ID})
				} else {
					// Move to loot
					sendMove(c, loot.X, loot.Z)
				}
			} else if target != nil && minDist < 30.0 {
				// Fight
				// 10% chance to use ability if in range
				if minDist < 15.0 && rand.Float64() < 0.1 {
					abilityPayload := map[string]interface{}{
						"targetX":  target.X,
						"targetZ":  target.Z,
						"targetId": target.ID,
					}
					send(c, "ability", abilityPayload)
				} else if minDist < 4.0 {
					send(c, "attack", map[string]string{"targetId": target.ID})
				} else {
					// Chase
					sendMove(c, target.X, target.Z)
				}
			} else {
				// Roam
				// Check if we are in town (radius 50)
				distFromCenter := math.Sqrt(me.X*me.X + me.Z*me.Z)
				if distFromCenter < 60.0 {
					// Move out
					angle := rand.Float64() * 2 * math.Pi
					r := 70.0 + rand.Float64()*30.0
					tx := math.Cos(angle) * r
					tz := math.Sin(angle) * r
					sendMove(c, tx, tz)
				} else {
					// Random walk nearby
					tx := me.X + (rand.Float64()*20 - 10)
					tz := me.Z + (rand.Float64()*20 - 10)
					sendMove(c, tx, tz)
				}
			}
		}
	}
}

var writeMu sync.Mutex

func sendMove(c *websocket.Conn, x, z float64) {
	payload := map[string]interface{}{
		"x":        x,
		"y":        0,
		"z":        z,
		"rotation": 0,
		"state":    "MOVING",
	}
	send(c, "move", payload)
}

func send(c *websocket.Conn, msgType string, payload interface{}) error {
	pBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	msg := Message{
		Type:    msgType,
		Payload: pBytes,
	}

	writeMu.Lock()
	defer writeMu.Unlock()
	return c.WriteJSON(msg)
}

func generateRandomName() string {
	names := []string{
		"HughJanis",
		"BenDover",
		"PhilMcCracken",
		"MikeRotch",
		"SeymourButts",
		"AnitaBath",
		"IvanaTinkle",
		"OliverClothesoff",
		"JacquesStrap",
		"AlCoholic",
		"AmandaHuggenkiss",
		"HaywoodJablome",
		"TessTickles",
		"BarryMader",
		"JustinCase",
		"BarbDwyer",
		"StanStill",
		"TerryCloth",
		"DixieNormous",
		"YuriNator",
		"JohnnyBGoode",
		"MarkMyWords",
		"WillieStroker",
		"ChrisP.Bend",
		"PatMyBack",
		"OpheliaCrotch",
		"LotusBlossom",
		"FannyPack",
		"BeaO'Problem",
		"MoLester",
		"PhilAtio",
		"AnitaHardcock",
		"MikeHunt",
		"OliverKlozoff",
		"BenDurr",
		"SaulT.Balls",
		"WoodyJohnson",
		"RichardHead",
	}

	name := names[rand.Intn(len(names))]
	return fmt.Sprintf("%s%d", name, rand.Intn(100000))
}
