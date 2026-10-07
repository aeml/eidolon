package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

func TestCommonStateWindowRequiresEveryReaderAndActualOverlap(t *testing.T) {
	start := time.Unix(100, 0)
	observations := []loadObservation{
		{frames: 100, ownUpdates: 50, firstStateAt: start, lastStateAt: start.Add(120 * time.Second)},
		{frames: 90, ownUpdates: 40, firstStateAt: start.Add(8 * time.Second), lastStateAt: start.Add(115 * time.Second)},
	}
	first, last := commonStateWindow(observations)
	if !first.Equal(start.Add(8*time.Second)) || !last.Equal(start.Add(115*time.Second)) {
		t.Fatal("common interval is not the intersection of all readers")
	}
	for _, invalid := range []loadObservation{{}, {frames: 1, ownUpdates: 0, firstStateAt: start, lastStateAt: start.Add(time.Second)},
		{frames: 1, ownUpdates: 1, firstStateAt: start.Add(130 * time.Second), lastStateAt: start.Add(140 * time.Second)}} {
		copy := append(append([]loadObservation{}, observations...), invalid)
		first, last := commonStateWindow(copy)
		if !first.IsZero() || !last.IsZero() {
			t.Fatal("missing, stale-own or non-overlapping reader established concurrency")
		}
	}
	if first, last := commonStateWindow(nil); !first.IsZero() || !last.IsZero() {
		t.Fatal("empty readers established concurrency")
	}
}

func TestStateCoverageRequiresOwnSnapshotsAndIncludesEveryClient(t *testing.T) {
	start := time.Unix(100, 0)
	observations := make([]loadObservation, 2)
	observations[0].state(map[string]Entity{"other": {Type: "Player"}, "self": {Type: "Enemy"}}, "self", start, true)
	if observations[0].frames != 0 {
		t.Fatal("another actor established coverage")
	}
	state := map[string]Entity{"self": {Type: "Player"}}
	for _, offset := range []time.Duration{0, 100 * time.Millisecond, 400 * time.Millisecond} {
		observations[0].state(state, "self", start.Add(offset), true)
	}
	observations[0].wireBytes = 500
	coverage := summarizeStateCoverage(observations)
	if coverage.clients != 1 || coverage.minFrames != 0 || coverage.minActive != 0 || coverage.maxGap != 300*time.Millisecond || coverage.wireBytes != 500 {
		t.Fatal("starved client hidden by aggregate coverage", coverage)
	}
	for _, offset := range []time.Duration{0, 200 * time.Millisecond} {
		observations[1].state(state, "self", start.Add(offset), true)
	}
	observations[1].wireBytes = 250
	coverage = summarizeStateCoverage(observations)
	if coverage.clients != 2 || coverage.minFrames != 2 || coverage.minActive != 200*time.Millisecond || coverage.maxGap != 300*time.Millisecond || coverage.wireBytes != 750 {
		t.Fatal("incorrect per-client minimum/window/gap or payload accounting", coverage)
	}
	if empty := summarizeStateCoverage(nil); empty != (stateCoverage{}) {
		t.Fatal("missing clients became measured coverage")
	}
}

func TestStateCoverageSeparatesCachedOwnEntityFromFreshUpdates(t *testing.T) {
	start := time.Unix(100, 0)
	state := map[string]Entity{}
	var observation loadObservation
	observe := func(update stateUpdate, offset time.Duration) {
		applyStateUpdate(state, update)
		observation.state(state, "self", start.Add(offset), update.entities["self"].Type == "Player")
	}
	observe(stateUpdate{full: true, entities: map[string]Entity{"self": {Type: "Player"}}}, 0)
	observe(stateUpdate{entities: map[string]Entity{"peer": {Type: "Player"}}}, time.Second)
	observe(stateUpdate{}, 2*time.Second) // Idle delta: view delivery, not fresh self.
	if observation.frames != 3 || observation.ownUpdates != 1 {
		t.Fatal("cached self inflated fresh own updates", observation.frames, observation.ownUpdates)
	}
	observe(stateUpdate{removedID: []string{"self"}}, 3*time.Second)
	observe(stateUpdate{full: true, entities: map[string]Entity{"peer": {Type: "Player"}}}, 4*time.Second)
	if observation.frames != 3 || observation.ownUpdates != 1 {
		t.Fatal("removed self established coverage")
	}
	observe(stateUpdate{entities: map[string]Entity{"self": {Type: "Player"}}}, 5*time.Second)
	coverage := summarizeStateCoverage([]loadObservation{observation, {}})
	if observation.frames != 4 || observation.ownUpdates != 2 || coverage.ownClients != 1 || coverage.minOwnUpdates != 0 {
		t.Fatal("fresh updates or unobserved clients counted incorrectly", coverage)
	}
}

func TestLoadCoverageActualSocketFramesAndReaderShutdown(t *testing.T) {
	for _, scenario := range []string{"valid", "bad-gzip", "oversized-gzip", "bad-state", "bad-inventory", "bad-json", "bad-protobuf"} {
		t.Run(scenario, func(t *testing.T) {
			for _, counter := range []*loadMetrics{&metrics} {
				counter.connected.Store(0)
				counter.joined.Store(0)
				counter.stateFrames.Store(0)
				counter.readErrors.Store(0)
				counter.writeErrors.Store(0)
				counter.decodeErrors.Store(0)
				counter.admissionErrors.Store(0)
				counter.authenticated.Store(0)
			}
			upgrader := websocket.Upgrader{}
			sent := make(chan struct{})
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				connection, err := upgrader.Upgrade(w, r, nil)
				if err != nil {
					t.Error("fixture upgrade failed")
					return
				}
				defer connection.Close()
				_ = connection.SetReadDeadline(time.Now().Add(5 * time.Second))
				for {
					var message Message
					if connection.ReadJSON(&message) != nil {
						return
					}
					if message.Type == "register" {
						_ = connection.WriteJSON(Message{Type: "error", Payload: json.RawMessage(`"Registration successful! Please login."`)})
						continue
					}
					if message.Type == "login" {
						_ = connection.WriteJSON(Message{Type: "login_success", Payload: json.RawMessage(`{"hasCharacter":true,"characterType":"Wizard"}`)})
						continue
					}
					if message.Type != "join" {
						continue
					}
					var selection struct{ Type string }
					if json.Unmarshal(message.Payload, &selection) != nil || selection.Type != "Wizard" {
						t.Error("driver ignored the existing character class")
					}
					encode := func(entityID string) []byte {
						payload, err := proto.Marshal(&statepb.StateEnvelope{Version: uint32(stateFrameVersion),
							Payload: &statepb.StateEnvelope_Full{Full: &statepb.StateFull{Entities: []*statepb.Entity{{Id: entityID, Type: "Player", Health: 100}}}}})
						if err != nil {
							t.Error("fixture protobuf encoding failed")
						}
						return append(append(append([]byte{}, stateFrameMagic...), stateFrameVersion), payload...)
					}
					own := encode("player-synthetic-coverage")
					var compressed bytes.Buffer
					compressor := gzip.NewWriter(&compressed)
					_, _ = compressor.Write(own)
					_ = compressor.Close()
					legacy, _ := json.Marshal(Message{Type: "state", Payload: json.RawMessage(`{"player-synthetic-coverage":{"type":"Player","health":100}}`)})
					delta := func(entities []*statepb.Entity) []byte {
						payload, err := proto.Marshal(&statepb.StateEnvelope{Version: uint32(stateFrameVersion),
							Payload: &statepb.StateEnvelope_Delta{Delta: &statepb.StateDelta{Entities: entities}}})
						if err != nil {
							t.Error("fixture delta encoding failed")
						}
						return append(append(append([]byte{}, stateFrameMagic...), stateFrameVersion), payload...)
					}
					frames := [][]byte{encode("other-player"), own,
						delta([]*statepb.Entity{{Id: "other-player", Type: "Player"}}), delta(nil), compressed.Bytes(), legacy}
					switch scenario {
					case "bad-gzip":
						frames = append(frames, []byte{0x1f, 0x8b, 0})
					case "oversized-gzip":
						var expanded bytes.Buffer
						writer := gzip.NewWriter(&expanded)
						_, _ = writer.Write(bytes.Repeat([]byte{'x'}, (8<<20)+1))
						_ = writer.Close()
						frames = append(frames, expanded.Bytes())
					case "bad-state":
						frames = append(frames, []byte(`{"type":"state","payload":"private-invalid"}`))
					case "bad-inventory":
						frames = append(frames, []byte(`{"type":"inventory","payload":"private-invalid"}`))
					case "bad-json":
						frames = append(frames, []byte(`private-invalid`))
					case "bad-protobuf":
						frames = append(frames, []byte("EDPB"))
					}
					for _, frame := range frames {
						if connection.WriteMessage(websocket.BinaryMessage, frame) != nil {
							t.Error("fixture write failed")
							return
						}
					}
					close(sent)
					for connection.ReadJSON(&message) == nil {
					}
					return
				}
			}))
			defer server.Close()
			stop, ended := make(chan struct{}), make(chan struct{})
			var observation loadObservation
			go func() {
				runBot(0, "ws"+strings.TrimPrefix(server.URL, "http"), BotCredentials{Username: "synthetic-coverage", Password: "synthetic-private-password"}, "town", stop, &observation)
				close(ended)
			}()
			select {
			case <-sent:
			case <-time.After(3 * time.Second):
				close(stop)
				t.Fatal("fixture did not send state frames")
			}
			// Wait for the reader to process the fixture frames, not just the sender.
			deadline := time.Now().Add(3 * time.Second)
			for metrics.stateFrames.Load() != 6 || scenario != "valid" && metrics.decodeErrors.Load() != 1 {
				if time.Now().After(deadline) {
					close(stop)
					t.Fatal("fixture frames were not processed")
				}
				time.Sleep(time.Millisecond)
			}
			close(stop)
			select {
			case <-ended:
			case <-time.After(time.Second):
				t.Fatal("reader outlived stopped bot")
			}
			if observation.frames != 5 || observation.ownUpdates != 3 || observation.wireBytes == 0 || metrics.joined.Load() != 1 || metrics.readErrors.Load() != 0 || metrics.writeErrors.Load() != 0 ||
				metrics.authenticated.Load() != 1 || metrics.admissionErrors.Load() != 0 || observation.registrationTime <= 0 || observation.loginTime <= 0 || observation.joinTime < 0 {
				t.Fatal("own coverage, compressed payload accounting or final shutdown metrics incorrect")
			}
		})
	}
}
