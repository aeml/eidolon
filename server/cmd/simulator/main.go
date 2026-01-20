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
	"time"

	"github.com/gorilla/websocket"
)

// Message types matching server
const (
	MsgJoin     = "join"
	MsgLogin    = "login"
	MsgRegister = "register"
	MsgMove     = "move"
	MsgAttack   = "attack"
	MsgDamage   = "damage"
	MsgChat     = "chat"
	MsgState    = "state"
	MsgError    = "error"
)

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type AuthPayload struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type JoinPayload struct {
	Type string `json:"type"`
}

type MovePayload struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type AttackPayload struct {
	TargetID string `json:"targetId"`
}

type Entity struct {
	ID      string  `json:"id"`
	Type    string  `json:"type"`
	SubType string  `json:"subType"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	Z       float64 `json:"z"`
	State   string  `json:"state"`
}

func main() {
	rand.Seed(time.Now().UnixNano())
	serverAddr := flag.String("addr", "eserver.mendola.tech:8080", "Server address")
	insecure := flag.Bool("insecure", false, "Skip SSL verification")
	flag.Parse()

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	u := url.URL{Scheme: "wss", Host: *serverAddr, Path: "/ws"}
	log.Printf("Connecting to %s", u.String())

	// TLS Config
	tlsConfig := &tls.Config{
		InsecureSkipVerify: *insecure,
	}
	dialer := websocket.Dialer{
		TLSClientConfig: tlsConfig,
	}

	c, _, err := dialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer c.Close()

	done := make(chan struct{})

	// State tracking
	var myPlayerID string
	var enemies []string
	var otherPlayers []Entity
	var stateMutex = make(chan struct{}, 1) // Simple mutex using channel

	// Read Loop
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("read:", err)
				return
			}

			var msg Message
			if err := json.Unmarshal(message, &msg); err != nil {
				log.Printf("Received raw: %s", message)
				continue
			}

			switch msg.Type {
			case MsgError:
				log.Printf("SERVER ERROR: %s", msg.Payload)
			case MsgState:
				var state map[string]Entity
				json.Unmarshal(msg.Payload, &state)

				// Update local state
				currentEnemies := []string{}
				currentPlayers := []Entity{}
				var me *Entity

				for id, e := range state {
					if e.Type == "Enemy" && e.State != "DEAD" {
						currentEnemies = append(currentEnemies, id)
					}
					if e.Type == "Player" && id != myPlayerID {
						currentPlayers = append(currentPlayers, e)
					}
					if id == myPlayerID {
						me = &e
					}
				}

				// Update shared state
				select {
				case stateMutex <- struct{}{}:
					enemies = currentEnemies
					otherPlayers = currentPlayers
					<-stateMutex
				default:
				}

				// Check for Death
				if me != nil && me.State == "DEAD" {
					log.Printf("I am DEAD! Respawning...")
					sendJSON(c, "respawn", map[string]interface{}{})
				}

			case MsgChat:
				log.Printf("Chat: %s", msg.Payload)
			case MsgDamage:
				// log.Printf("COMBAT: %s", msg.Payload)
			default:
				// log.Printf("Recv: %s", msg.Type)
			}
		}
	}()

	// Simulation Logic
	go func() {
		// 1. Register
		username := fmt.Sprintf("sim_user_%d", rand.Intn(10000))
		myPlayerID = "player-" + username
		password := "password123"
		log.Printf("Attempting to Register as %s...", username)

		sendJSON(c, MsgRegister, AuthPayload{Username: username, Password: password})
		time.Sleep(1 * time.Second)

		// 2. Login
		log.Printf("Attempting to Login...")
		sendJSON(c, MsgLogin, AuthPayload{Username: username, Password: password})
		time.Sleep(1 * time.Second)

		// 3. Join Game
		log.Printf("Joining Game as Fighter...")
		sendJSON(c, MsgJoin, JoinPayload{Type: "Fighter"})
		time.Sleep(1 * time.Second)

		// 4. Move Loop
		ticker := time.NewTicker(50 * time.Millisecond) // 20 updates per second
		defer ticker.Stop()

		// Randomize start position to avoid stacking
		x := (rand.Float64() - 0.5) * 40.0
		z := (rand.Float64() - 0.5) * 40.0
		targetX, targetZ := x, z
		speed := 6.0 // Slightly faster than base speed

		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				// Movement Logic
				// Calculate Repulsion from other players
				repX, repZ := 0.0, 0.0
				separationDist := 2.0

				stateMutex <- struct{}{}
				localOthers := make([]Entity, len(otherPlayers))
				copy(localOthers, otherPlayers)
				<-stateMutex

				for _, p := range localOthers {
					dx := x - p.X
					dz := z - p.Z
					dist := math.Sqrt(dx*dx + dz*dz)
					if dist < separationDist && dist > 0.001 {
						// Push away
						force := (separationDist - dist) / separationDist
						repX += (dx / dist) * force * 2.0
						repZ += (dz / dist) * force * 2.0
					}
				}

				dx := targetX - x
				dz := targetZ - z
				dist := math.Sqrt(dx*dx + dz*dz)

				if dist < 1.0 {
					// Pick new target
					angle := rand.Float64() * 2 * math.Pi
					radius := 50.0 + rand.Float64()*200.0 // Move 50-250 units away
					targetX = x + math.Cos(angle)*radius
					targetZ = z + math.Sin(angle)*radius

					// Clamp to World Bounds (Earth + Water Realms)
					// X: -1000 to 1000
					// Z: -2200 to 1000
					if targetX < -950 {
						targetX = -950
					}
					if targetX > 950 {
						targetX = 950
					}
					if targetZ < -2150 {
						targetZ = -2150
					}
					if targetZ > 950 {
						targetZ = 950
					}
				} else {
					// Move towards target
					step := speed * 0.05 // speed * dt
					dirX, dirZ := 0.0, 0.0
					if dist > 0 {
						dirX = dx / dist
						dirZ = dz / dist
					}

					// Combine target direction with repulsion
					finalDx := dirX + repX
					finalDz := dirZ + repZ

					// Normalize final direction
					finalLen := math.Sqrt(finalDx*finalDx + finalDz*finalDz)
					if finalLen > 0 {
						x += (finalDx / finalLen) * step
						z += (finalDz / finalLen) * step
					}
				}

				sendJSON(c, MsgMove, MovePayload{X: x, Y: 0, Z: z})

				// Combat logic: Attack random enemy
				stateMutex <- struct{}{}
				enemyCount := len(enemies)
				var targetID string
				if enemyCount > 0 {
					targetID = enemies[rand.Intn(enemyCount)]
				}
				<-stateMutex

				if targetID != "" && rand.Intn(20) == 0 { // Reduced chance per tick since tick rate is higher (50ms vs 200ms)
					sendJSON(c, MsgAttack, AttackPayload{TargetID: targetID})
				}
			}
		}
	}()

	for {
		select {
		case <-done:
			return
		case <-interrupt:
			log.Println("interrupt")
			err := c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			if err != nil {
				log.Println("write close:", err)
				return
			}
			select {
			case <-done:
			case <-time.After(time.Second):
			}
			return
		}
	}
}

func sendJSON(c *websocket.Conn, msgType string, payload interface{}) {
	pBytes, _ := json.Marshal(payload)
	msg := Message{
		Type:    msgType,
		Payload: pBytes,
	}
	if err := c.WriteJSON(msg); err != nil {
		log.Println("write:", err)
	}
}
