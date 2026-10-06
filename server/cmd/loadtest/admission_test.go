package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestAdmissionRepliesUseOnlyFixedAcknowledgementsAndKnownClasses(t *testing.T) {
	for _, test := range []struct {
		messageType, payload, kind, class string
		recognized                        bool
	}{
		{"error", `"Registration successful! Please login."`, "registered", "", true},
		{"error", `"Registration failed: username already exists"`, "registered", "", true},
		{"error", `"Account service is busy. Please retry shortly."`, "admission_busy", "", true},
		{"error", `"synthetic-private-diagnostic"`, "admission_rejected", "", true},
		{"error", `{}`, "invalid_admission_response", "", true},
		{"login_success", `{"hasCharacter":false,"resumeToken":"synthetic-private-token"}`, "authenticated", "", true},
		{"login_success", `{"hasCharacter":true,"characterType":"Cleric","resumeToken":"synthetic-private-token"}`, "authenticated", "Cleric", true},
		{"login_success", `{"hasCharacter":true,"characterType":"synthetic-private-diagnostic"}`, "invalid_admission_response", "", true},
		{"login_success", `{"hasCharacter":true}`, "invalid_admission_response", "", true},
		{"login_success", `{}`, "invalid_admission_response", "", true},
		{"inventory", `[]`, "", "", false},
	} {
		reply, recognized := decodeAdmissionReply(Message{Type: test.messageType, Payload: json.RawMessage(test.payload)})
		if reply.kind != test.kind || reply.characterType != test.class || recognized != test.recognized || strings.Contains(reply.kind+reply.characterType, "synthetic-private") {
			t.Fatal("incorrect or private acknowledgement", reply)
		}
	}
}

func TestPreparedLoadAdmissionLogsInWithoutRegistrationOrCharacterCreation(t *testing.T) {
	for _, existing := range []bool{true, false} {
		t.Run(fmt.Sprint(existing), func(t *testing.T) {
			metrics.connected.Store(0)
			metrics.joined.Store(0)
			metrics.authenticated.Store(0)
			metrics.admissionErrors.Store(0)
			upgrader := websocket.Upgrader{}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				connection, err := upgrader.Upgrade(w, r, nil)
				if err != nil {
					t.Error("fixture upgrade failed")
					return
				}
				defer connection.Close()
				_ = connection.SetReadDeadline(time.Now().Add(2 * time.Second))
				var request Message
				if connection.ReadJSON(&request) != nil || request.Type != "login" {
					t.Error("prepared account attempted registration instead of login")
					return
				}
				_ = connection.WriteJSON(partyMessage("login_success", map[string]interface{}{"hasCharacter": existing, "characterType": "Fighter"}))
				if !existing {
					if connection.ReadJSON(&request) == nil {
						t.Error("missing prepared character was created or another request retried")
					}
					return
				}
				if connection.ReadJSON(&request) != nil || request.Type != "join" {
					t.Error("prepared account did not join through normal protocol")
					return
				}
				_ = connection.WriteJSON(partyMessage("state", map[string]Entity{
					"player-synthetic-prepared": {ID: "player-synthetic-prepared", Type: "Player", SubType: "Fighter", Health: 100, Mana: 100, Z: 200},
				}))
				for connection.ReadJSON(&request) == nil {
					if request.Type == "register" || request.Type == "join" || request.Type == "equip" || request.Type == "sell" {
						t.Error("prepared account recreated or mutated preserved equipment")
					}
				}
			}))
			defer server.Close()
			stop, ended := make(chan struct{}), make(chan struct{})
			var observation loadObservation
			go func() {
				runAssignedBot(0, "ws"+strings.TrimPrefix(server.URL, "http"), BotCredentials{Username: "synthetic-prepared", Password: "synthetic-private-password"}, botAssignment{scenario: "town", preserveGear: true}, stop, &observation)
				close(ended)
			}()
			deadline := time.Now().Add(time.Second)
			for existing && metrics.joined.Load() == 0 && time.Now().Before(deadline) {
				time.Sleep(time.Millisecond)
			}
			if existing {
				close(stop)
			}
			select {
			case <-ended:
			case <-time.After(2 * time.Second):
				if !existing {
					close(stop)
				}
				t.Fatal("prepared admission did not terminate")
			}
			if observation.registrationTime != 0 || metrics.authenticated.Load() != 1 || existing && (metrics.joined.Load() != 1 || metrics.admissionErrors.Load() != 0) || !existing && (metrics.joined.Load() != 0 || metrics.admissionErrors.Load() != 1) {
				t.Fatal("prepared admission invented registration, join or character evidence")
			}
		})
	}
}

func TestLoadAdmissionActualSocketFailuresAndCancellation(t *testing.T) {
	previousTimeout := *admissionTimeout
	*admissionTimeout = 100 * time.Millisecond
	t.Cleanup(func() { *admissionTimeout = previousTimeout })
	for _, scenario := range []string{"busy", "timeout", "cancelled", "remote-close"} {
		t.Run(scenario, func(t *testing.T) {
			metrics.connected.Store(0)
			metrics.joined.Store(0)
			metrics.stateFrames.Store(0)
			metrics.readErrors.Store(0)
			metrics.writeErrors.Store(0)
			metrics.decodeErrors.Store(0)
			metrics.admissionErrors.Store(0)
			metrics.authenticated.Store(0)
			registered := make(chan struct{})
			upgrader := websocket.Upgrader{}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				connection, err := upgrader.Upgrade(w, r, nil)
				if err != nil {
					t.Error("fixture upgrade failed")
					return
				}
				defer connection.Close()
				_ = connection.SetReadDeadline(time.Now().Add(2 * time.Second))
				var request Message
				if connection.ReadJSON(&request) != nil || request.Type != "register" {
					t.Error("driver did not request registration first")
					return
				}
				close(registered)
				if scenario == "remote-close" {
					return
				}
				if scenario == "busy" {
					_ = connection.WriteJSON(Message{Type: "error", Payload: json.RawMessage(`"Account service is busy. Please retry shortly."`)})
				}
				if connection.ReadJSON(&request) == nil {
					t.Error("driver sent another command without registration acknowledgement")
				}
			}))
			defer server.Close()
			stop, ended := make(chan struct{}), make(chan struct{})
			var observation loadObservation
			go func() {
				runBot(0, "ws"+strings.TrimPrefix(server.URL, "http"), BotCredentials{Username: "synthetic-admission", Password: "synthetic-private-password"}, "town", stop, &observation)
				close(ended)
			}()
			select {
			case <-registered:
			case <-time.After(time.Second):
				close(stop)
				t.Fatal("registration was not requested")
			}
			if scenario == "cancelled" {
				close(stop)
			}
			select {
			case <-ended:
			case <-time.After(time.Second):
				if scenario != "cancelled" {
					close(stop)
				}
				t.Fatal("admission failure/cancellation did not stop reader")
			}
			wantedFailures, wantedReads := int64(1), int64(0)
			if scenario == "cancelled" {
				wantedFailures = 0
			}
			if scenario == "remote-close" {
				wantedReads = 1
			}
			if metrics.admissionErrors.Load() != wantedFailures || metrics.readErrors.Load() != wantedReads || metrics.writeErrors.Load() != 0 || metrics.authenticated.Load() != 0 || metrics.joined.Load() != 0 || observation.frames != 0 {
				t.Fatal("failed/cancelled startup admitted a character or misclassified intentional reader shutdown")
			}
		})
	}
}

func TestAdmissionWaitOrdersRepliesAndBoundsShutdownFailure(t *testing.T) {
	stop, done := make(chan struct{}), make(chan struct{})
	for _, kind := range []string{"registered", "authenticated", "admission_busy", "admission_rejected", "invalid_admission_response", "synthetic-private-unexpected"} {
		replies := make(chan admissionReply, 1)
		replies <- admissionReply{kind: kind}
		_, err := waitAdmissionReply("registered", replies, stop, done, time.Second)
		if (err == nil) != (kind == "registered") || err != nil && strings.Contains(err.Error(), "synthetic-private") {
			t.Fatal("out-of-order/rejected response passed or leaked", err)
		}
	}
	start := time.Now()
	if _, err := waitAdmissionReply("registered", make(chan admissionReply), stop, done, 20*time.Millisecond); err == nil || err.Error() != "admission_timeout" || time.Since(start) > time.Second {
		t.Fatal("missing acknowledgement did not time out")
	}
	close(stop)
	if _, err := waitAdmissionReply("registered", make(chan admissionReply), stop, done, time.Second); err != errLoadStopped {
		t.Fatal("operator shutdown became an admission rejection")
	}
	close(done)
	if _, err := waitAdmissionReply("registered", make(chan admissionReply), make(chan struct{}), done, time.Second); err == nil || err.Error() != "admission_connection_closed" {
		t.Fatal("closed transport was treated as acknowledged")
	}
	observations := []loadObservation{{registrationTime: time.Millisecond, loginTime: 2 * time.Millisecond, joinTime: time.Millisecond},
		{registrationTime: 3 * time.Millisecond, loginTime: time.Millisecond, joinTime: 4 * time.Millisecond}}
	coverage := summarizeStateCoverage(observations)
	if coverage.maxRegistration != 3*time.Millisecond || coverage.maxLogin != 2*time.Millisecond || coverage.maxJoin != 4*time.Millisecond {
		t.Fatal("admission phase timing aggregation incorrect")
	}
}
