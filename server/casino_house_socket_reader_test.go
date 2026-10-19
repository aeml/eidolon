package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

// A short protocol check, not a capacity test. Real browser clients continually
// read state/control frames; a fixture must do so during its ordinary VIP walk.
func TestHouseVIPApproachConsumesAcknowledgementsAndPings(t *testing.T) {
	const name = "house-vip-reader-fixture"
	const movementContext = "vip-reader-context"
	pong := make(chan struct{}, 1)
	done := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(done)
		peer, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer peer.Close()
		peer.SetPongHandler(func(string) error {
			select {
			case pong <- struct{}{}:
			default:
			}
			return nil
		})
		var message Message
		if peer.ReadJSON(&message) != nil {
			return
		}
		if peer.WriteJSON(map[string]any{"type": "casino_floor", "payload": map[string]any{"upstairs": true}}) != nil {
			return
		}
		if peer.WriteJSON(map[string]any{"type": MsgMovementContext, "payload": map[string]string{"movementContext": movementContext}}) != nil {
			return
		}
		for {
			if peer.ReadJSON(&message) != nil {
				return
			}
			var movement MovePayload
			if message.Type != MsgMove || json.Unmarshal(message.Payload, &movement) != nil || movement.MovementContext != movementContext || movement.Sequence == 0 {
				return
			}
			// Stale state cannot acknowledge this move. Reading the subsequent
			// ping must send a pong before the fixture proceeds to the chair.
			for _, sequence := range []uint64{movement.Sequence - 1, movement.Sequence} {
				if sequence == movement.Sequence {
					if peer.WriteControl(websocket.PingMessage, []byte("vip-reader"), time.Now().Add(time.Second)) != nil {
						return
					}
				}
				frame, err := proto.Marshal(&statepb.StateEnvelope{Payload: &statepb.StateEnvelope_Full{Full: &statepb.StateFull{
					Entities: []*statepb.Entity{{Id: "player-" + name, MoveSequence: sequence}},
				}}})
				if err != nil || peer.WriteMessage(websocket.BinaryMessage, append([]byte{'E', 'D', 'P', 'B', 1}, frame...)) != nil {
					return
				}
			}
		}
	}))
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		server.Close()
		t.Fatal(err)
	}
	defer func() {
		conn.Close()
		server.Close()
		select {
		case <-done:
		case <-time.After(time.Second):
			t.Error("VIP fixture reader peer did not retire")
		}
	}()
	approachHouseVIPSeats(t, []*websocket.Conn{conn}, game.CasinoTable{Seats: []game.CasinoSeatPosition{{ExitZ: 104.1}}}, []string{name})
	select {
	case <-pong:
	case <-time.After(time.Second):
		t.Fatal("VIP walk did not consume control/state frames and answer the ping")
	}
}

// Only aggregate, fixed-name counters leave the disposable process. Never dump
// server logs or account/token data into public CI output.
func logHouseFixtureTransportCounters(t *testing.T, address string) {
	t.Helper()
	client := &http.Client{Timeout: time.Second}
	response, err := client.Get("http://" + address + "/healthz")
	if err != nil {
		t.Log("house transport counters unavailable")
		return
	}
	defer response.Body.Close()
	var health struct {
		WebsocketClosures map[string]uint64 `json:"websocketClosures"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 65536)).Decode(&health) != nil {
		t.Log("house transport counters unavailable")
		return
	}
	t.Logf("house fixture aggregate transport closures: %v", health.WebsocketClosures)
}
