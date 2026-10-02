package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"github.com/gorilla/websocket"
)

func inboundSizedPayload(size int) json.RawMessage {
	return json.RawMessage(`"` + strings.Repeat("x", size-2) + `"`)
}

func TestInboundEnvelopeFitsEveryDeclaredPolicy(t *testing.T) {
	for kind, policy := range inboundMessagePolicies {
		t.Run(kind, func(t *testing.T) {
			if policy.maxPayloadBytes > maxInboundPayloadSize {
				t.Fatal("policy exceeds the bounded transport payload allowance")
			}
			frame, err := json.Marshal(Message{Type: kind, Payload: inboundSizedPayload(policy.maxPayloadBytes)})
			if err != nil || len(frame) > maxMessageSize {
				t.Fatalf("maximum legal payload cannot fit its envelope: bytes=%d err=%v", len(frame), err)
			}
			decoded, err := decodeInboundMessage(frame)
			if err != nil || len(decoded.Payload) != policy.maxPayloadBytes {
				t.Fatal("maximum legal payload cannot be decoded", err)
			}
			client := &Client{username: "envelope-fixture", playerID: "fixture-character"}
			if err := client.acceptInboundMessage(decoded, time.Now()); err != nil {
				t.Fatal("declared payload boundary rejected", err)
			}
			decoded.Payload = inboundSizedPayload(policy.maxPayloadBytes + 1)
			if err := client.acceptInboundMessage(decoded, time.Now()); err == nil || err.Error() != "message payload too large" {
				t.Fatal("per-message boundary was relaxed", err)
			}
		})
	}
}

// Exercise the actual bounded reader, byte guard, envelope decoder and policy
// on one socket. This is transport/validation evidence, not Mongo persistence
// or casino wager execution. A rejected payload must not kill the next request.
func TestInboundEnvelopeActualSocketReportsAndPolicyRejection(t *testing.T) {
	frames := []struct {
		message Message
		reject  bool
	}{
		{message: Message{Type: MsgReport}},
		{message: Message{Type: MsgReport}},
		{message: Message{Type: MsgCasino, Payload: inboundSizedPayload(inboundMessagePolicies[MsgCasino].maxPayloadBytes)}},
		{message: Message{Type: MsgAdminChatModeration, Payload: inboundSizedPayload(inboundMessagePolicies[MsgAdminChatModeration].maxPayloadBytes)}},
		{message: Message{Type: MsgCasino, Payload: inboundSizedPayload(inboundMessagePolicies[MsgCasino].maxPayloadBytes + 1)}, reject: true},
		{message: Message{Type: MsgReport}},
	}
	for index, text := range map[int]string{0: strings.Repeat("🔮", 4000), 1: strings.Repeat("\x01", 4000), 5: "Socket still accepts the next report."} {
		payload, err := json.Marshal(ReportPayload{RequestID: fmt.Sprintf("unicode-fixture-%d", index), ReportType: "Bug Report", Text: text})
		if err != nil {
			t.Fatal(err)
		}
		frames[index].message.Payload = payload
	}
	done := make(chan error, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, request, nil)
		if err != nil {
			done <- err
			return
		}
		defer conn.Close()
		reader := newInboundMessageReader(conn, time.Now, 3*time.Second, time.Second)
		guard := newInboundFrameGuard(time.Now())
		guard.installControlHandlers(conn, time.Now)
		client := &Client{username: "envelope-fixture", playerID: "fixture-character"}
		policyNow := time.Now()
		for index, expected := range frames {
			kind, frame, err := reader.readMessage()
			if err != nil || kind != websocket.TextMessage || !guard.acceptPayload(len(frame), time.Now()) {
				done <- fmt.Errorf("bounded transport rejected a fixture: %v", err)
				return
			}
			message, err := decodeInboundMessage(frame)
			if err != nil {
				done <- err
				return
			}
			// Advance only the policy clock for the third report. Byte admission
			// and read deadlines continue to use actual elapsed socket time.
			if index == len(frames)-1 {
				policyNow = policyNow.Add(time.Minute)
			}
			err = client.acceptInboundMessage(message, policyNow)
			if expected.reject {
				if err == nil || err.Error() != "message payload too large" {
					done <- errors.New("oversized casino payload bypassed its policy")
					return
				}
			} else if err != nil {
				done <- err
				return
			}
			if !expected.reject && message.Type == MsgReport {
				var payload ReportPayload
				if err := json.Unmarshal(message.Payload, &payload); err != nil {
					done <- err
					return
				}
				if _, err := database.NewReport(client.username, payload.ReportType, payload.Text, time.Now()); err != nil {
					done <- err
					return
				}
			}
			if err := conn.WriteMessage(websocket.TextMessage, []byte("checked")); err != nil {
				done <- err
				return
			}
		}
		done <- nil
	}))
	defer server.Close()
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	peer.SetReadDeadline(time.Now().Add(5 * time.Second))
	peer.SetWriteDeadline(time.Now().Add(5 * time.Second))
	for index, fixture := range frames {
		frame, err := json.Marshal(fixture.message)
		if err != nil {
			t.Fatal(err)
		}
		if index < 2 && len(frame) <= 8192 {
			t.Fatal("report fixture no longer reproduces the old transport failure")
		}
		if err := peer.WriteMessage(websocket.TextMessage, frame); err != nil {
			t.Fatal(err)
		}
		if _, reply, err := peer.ReadMessage(); err != nil || string(reply) != "checked" {
			select {
			case handlerErr := <-done:
				t.Fatal("socket validation failed", handlerErr, err)
			default:
				t.Fatal("socket response failed", err)
			}
		}
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}
