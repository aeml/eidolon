package main

import (
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"log"
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
}

func main() {
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
				// Analyze state
				enemyCount := 0
				playerCount := 0
				for _, e := range state {
					switch e.Type {
					case "Enemy":
						enemyCount++
					case "Player":
						playerCount++
					}
				}
				// Only log occasionally or interesting events to avoid spam
				if rand.Intn(20) == 0 {
					log.Printf("World State: %d Players, %d Enemies", playerCount, enemyCount)
				}
			case MsgChat:
				log.Printf("Chat: %s", msg.Payload)
			case MsgDamage:
				log.Printf("COMBAT: %s", msg.Payload)
			default:
				// log.Printf("Recv: %s", msg.Type)
			}
		}
	}()

	// Simulation Logic
	go func() {
		// 1. Register
		username := fmt.Sprintf("sim_user_%d", rand.Intn(10000))
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
		ticker := time.NewTicker(200 * time.Millisecond)
		defer ticker.Stop()

		x, z := 0.0, 0.0
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				// Random walk
				x += (rand.Float64() - 0.5) * 1.0
				z += (rand.Float64() - 0.5) * 1.0

				sendJSON(c, MsgMove, MovePayload{X: x, Y: 0, Z: z})

				// Combat logic: Attack skeleton-1 if close
				if rand.Intn(5) == 0 { // 20% chance per tick
					sendJSON(c, MsgAttack, AttackPayload{TargetID: "skeleton-1"})
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
