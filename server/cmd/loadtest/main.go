package main

import (
	"bytes"
	"compress/gzip"
	crand "crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
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
	addr            = flag.String("addr", "localhost:8080", "http service address")
	scheme          = flag.String("scheme", "wss", "websocket scheme (ws or wss)")
	count           = flag.Int("n", 10, "number of bots")
	townMode        = flag.Bool("town", false, "bots only roam in town")
	insecure        = flag.Bool("insecure-skip-verify", false, "skip TLS certificate verification for local/self-signed testing")
	credentialsFile = flag.String("credentials-file", "", "optional read-only JSON credential file; generated credentials otherwise remain in memory")
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
	Level     int             `json:"level"`
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

type BotCredentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func loadCredentials(path string) ([]BotCredentials, error) {
	if path == "" {
		return []BotCredentials{}, nil
	}
	file, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read credentials file: %w", err)
	}
	var creds []BotCredentials
	if err := json.Unmarshal(file, &creds); err != nil {
		return nil, fmt.Errorf("decode credentials file: %w", err)
	}
	return creds, nil
}

func randomHex(byteCount int) (string, error) {
	raw := make([]byte, byteCount)
	if _, err := io.ReadFull(crand.Reader, raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func generateDisposableCredentials() (BotCredentials, error) {
	usernameToken, err := randomHex(8)
	if err != nil {
		return BotCredentials{}, fmt.Errorf("generate username: %w", err)
	}
	password, err := randomHex(24)
	if err != nil {
		return BotCredentials{}, fmt.Errorf("generate password: %w", err)
	}
	return BotCredentials{
		Username: "loadtest-" + usernameToken,
		Password: password,
	}, nil
}

func main() {
	flag.Parse()
	if *count < 1 {
		log.Fatal("-n must be at least 1")
	}
	rand.Seed(time.Now().UnixNano())
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	u := url.URL{Scheme: *scheme, Host: *addr, Path: "/ws"}
	log.Printf("Connecting to %s with %d bots...", u.String(), *count)

	// Credential files are opt-in and read-only. Any missing accounts use
	// cryptographically random, process-local credentials that are never saved.
	creds, err := loadCredentials(*credentialsFile)
	if err != nil {
		log.Fatal(err)
	}
	if len(creds) < *count {
		log.Printf("Generating %d disposable in-memory bot accounts...", *count-len(creds))
		for len(creds) < *count {
			credential, err := generateDisposableCredentials()
			if err != nil {
				log.Fatal(err)
			}
			creds = append(creds, credential)
		}
	}

	var wg sync.WaitGroup

	for i := 0; i < *count; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			runBot(idx, u.String(), creds[idx])
		}(i)
		// Stagger connections slightly to avoid hammering the server all at once
		time.Sleep(100 * time.Millisecond)
	}

	// Wait for interrupt to stop
	<-interrupt
	log.Println("Stopping bots...")
}

func runBot(id int, urlStr string, cred BotCredentials) {
	dialer := *websocket.DefaultDialer
	if *insecure {
		dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

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

	// 1. Register (Try to register, ignore if exists)
	regPayload := map[string]string{
		"username": cred.Username,
		"email":    cred.Username + "@bot.com",
		"password": cred.Password,
	}
	// We don't check error here strictly because they might already exist
	send(c, "register", regPayload)

	// Small delay to ensure registration processes
	time.Sleep(200 * time.Millisecond)

	// 2. Login
	loginPayload := map[string]string{
		"username": cred.Username,
		"password": cred.Password,
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
	myID := "player-" + cred.Username

	// Movement State
	var roamTargetX, roamTargetZ float64
	var hasRoamTarget bool
	var lastRoamTime time.Time

	// Start reading messages to keep connection alive and handle server responses
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				return
			}

			// Check for GZIP
			if len(message) > 2 && message[0] == 0x1f && message[1] == 0x8b {
				r, err := gzip.NewReader(bytes.NewReader(message))
				if err != nil {
					continue
				}
				decompressed, err := io.ReadAll(r)
				r.Close()
				if err != nil {
					continue
				}
				message = decompressed
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
								send(c, "equip", map[string]string{"itemId": item.ID, "slot": item.Slot})
							}
						}
					}

					// Check if full (or nearly full) to trigger sell run
					count := 0
					for _, it := range inv {
						if it.ID != "" {
							count++
						}
					}
					if count >= 15 { // Start selling when mostly full
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

	log.Printf("Bot %s joined as %s.", cred.Username, randomArchetype)

	// Cooldowns
	var abilityCooldown time.Duration
	switch randomArchetype {
	case "Fighter":
		abilityCooldown = 5 * time.Second
	case "Wizard":
		abilityCooldown = 2 * time.Second
	case "Rogue":
		abilityCooldown = 1 * time.Second
	case "Cleric":
		abilityCooldown = 10 * time.Second
	}
	lastAbilityTime := time.Time{}

	// 4. AI Loop
	ticker := time.NewTicker(200 * time.Millisecond) // Faster tick for smoother movement
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

			// 1. Selling Logic
			if selling {
				// Town Center is (0, 200)
				dx := me.X - 0
				dz := me.Z - 200
				distFromTown := math.Sqrt(dx*dx + dz*dz)

				if distFromTown < 80.0 {
					// Sell everything in inventory (since we auto-equip upgrades, inventory is junk)
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
					// Move to random spot in town (0, 200) to avoid stacking
					// Town bounds approx -100 to 100 X, 100 to 300 Z
					targetX := (rand.Float64() * 160) - 80     // -80 to 80
					targetZ := 200 + (rand.Float64()*160 - 80) // 120 to 280
					sendMove(c, targetX, targetZ)
				}
				continue
			}

			// Town Mode Override
			if *townMode {
				// Announce presence occasionally
				if rand.Intn(100) == 0 {
					send(c, "chat", map[string]string{"message": fmt.Sprintf("I am roaming at %.1f, %.1f", me.X, me.Z)})
				}

				// Pick new target if needed
				if !hasRoamTarget || time.Since(lastRoamTime) > 10*time.Second {
					roamTargetX = (rand.Float64() * 160) - 80     // -80 to 80
					roamTargetZ = 200 + (rand.Float64()*160 - 80) // 120 to 280
					hasRoamTarget = true
					lastRoamTime = time.Now()
				}

				// Walk towards target
				speed := 6.0
				dt := 0.2 // 200ms
				step := speed * dt

				dx := roamTargetX - me.X
				dz := roamTargetZ - me.Z
				dist := math.Sqrt(dx*dx + dz*dz)

				if dist < step {
					sendMove(c, roamTargetX, roamTargetZ)
					hasRoamTarget = false
				} else {
					newX := me.X + (dx/dist)*step
					newZ := me.Z + (dz/dist)*step
					sendMove(c, newX, newZ)
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
				hasRoamTarget = false
			} else if target != nil && minDist < 30.0 {
				// Fight
				hasRoamTarget = false

				// Use ability on cooldown if in range
				if minDist < 15.0 && time.Since(lastAbilityTime) >= abilityCooldown {
					abilityPayload := map[string]interface{}{
						"targetX":  target.X,
						"targetZ":  target.Z,
						"targetId": target.ID,
					}
					send(c, "ability", abilityPayload)
					lastAbilityTime = time.Now()
				} else if minDist < 4.0 {
					send(c, "attack", map[string]string{"targetId": target.ID})
				} else {
					// Chase / Combat Movement
					// Add some "stutter" or strafing to look more human
					// Instead of moving directly to target, move slightly offset
					angle := math.Atan2(target.Z-me.Z, target.X-me.X)

					// If we are very close, maybe back up a bit if we are ranged?
					// For now, just simple chase with noise
					noise := (rand.Float64() - 0.5) * 0.5 // +/- 0.25 rad
					moveAngle := angle + noise

					// Move towards target but with noise
					tx := me.X + math.Cos(moveAngle)*5.0
					tz := me.Z + math.Sin(moveAngle)*5.0

					sendMove(c, tx, tz)
				}
			} else {
				// Roam based on Level
				// Sector 1: Z [200, 1000] (Lvl 1-10)
				// Sector 2: Z [-600, 200] (Lvl 10-30)
				// Sector 3: Z [-1000, -600] (Lvl 30-50) - Sirens
				// Sector 4: Z [-1400, -1000] (Lvl 50+) - Frost Guardians

				var minZ, maxZ float64
				if me.Level < 10 {
					minZ, maxZ = 200, 1000
				} else if me.Level < 30 {
					minZ, maxZ = -600, 200
				} else if me.Level < 50 {
					minZ, maxZ = -1000, -600
				} else {
					minZ, maxZ = -1400, -1000
				}

				// Check if we are in our sector
				if me.Z < minZ || me.Z > maxZ {
					if !hasRoamTarget {
						// Move to random spot in sector
						roamTargetZ = minZ + rand.Float64()*(maxZ-minZ)
						roamTargetX = (rand.Float64() * 1800) - 900
						hasRoamTarget = true
					}
				} else {
					// Roaming Logic with Waypoints
					if !hasRoamTarget || time.Since(lastRoamTime) > 5*time.Second {
						// Pick new waypoint
						roamTargetX = me.X + (rand.Float64()*100 - 50)
						roamTargetZ = me.Z + (rand.Float64()*100 - 50)

						// Clamp
						if roamTargetX < -950 {
							roamTargetX = -950
						}
						if roamTargetX > 950 {
							roamTargetX = 950
						}
						if roamTargetZ < minZ {
							roamTargetZ = minZ
						}
						if roamTargetZ > maxZ {
							roamTargetZ = maxZ
						}

						hasRoamTarget = true
						lastRoamTime = time.Now()
					}
				}

				// Walk towards target
				speed := 6.0
				dt := 0.2 // 200ms
				step := speed * dt

				dx := roamTargetX - me.X
				dz := roamTargetZ - me.Z
				dist := math.Sqrt(dx*dx + dz*dz)

				if dist < step {
					sendMove(c, roamTargetX, roamTargetZ)
					hasRoamTarget = false
				} else {
					newX := me.X + (dx/dist)*step
					newZ := me.Z + (dz/dist)*step
					sendMove(c, newX, newZ)
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
