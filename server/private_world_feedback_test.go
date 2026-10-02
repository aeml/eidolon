package main

import (
	"bytes"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

func TestPrivateWorldFeedbackUsesCurrentRecipientPriorityLane(t *testing.T) {
	previous := activeSessions
	defer func() { activeSessions = previous }()
	old := newAutoStatusClient("player-recipient")
	current := newAutoStatusClient("player-recipient")
	other := newAutoStatusClient("player-other")
	current.prioritySend = make(chan []byte, 4)
	activeSessions = map[string]*Client{"recipient": current, "other": other}
	for _, kind := range []string{MsgCombo, MsgRewardSummary, MsgRoomClearReward} {
		message := createMessage(kind, []byte(`{"earned":true}`))
		if !sendPrivateWorldFeedback(current.playerID, message) {
			t.Fatalf("%s was not queued", kind)
		}
		if got := <-current.prioritySend; !bytes.Equal(got, message) {
			t.Fatalf("%s payload changed", kind)
		}
	}
	if len(old.send) != 0 || len(other.send) != 0 || len(current.send) != 0 {
		t.Fatal("private feedback leaked or entered the lossy state lane")
	}
}

func TestPrivateWorldFeedbackDoesNotReenterWorldOrSnapshotLocks(t *testing.T) {
	previousWorld, previousSessions := world, activeSessions
	world = &game.World{}
	client := newAutoStatusClient("player-locked")
	activeSessions = map[string]*Client{"locked": client}
	defer func() { world, activeSessions = previousWorld, previousSessions }()
	world.Mu.Lock()
	client.stateMu.Lock()
	done := make(chan bool, 1)
	go func() { done <- sendPrivateWorldFeedback(client.playerID, []byte("private feedback")) }()
	select {
	case queued := <-done:
		client.stateMu.Unlock()
		world.Mu.Unlock()
		if !queued {
			t.Fatal("feedback was not queued while snapshot/world locks were held")
		}
	case <-time.After(time.Second):
		client.stateMu.Unlock()
		world.Mu.Unlock()
		<-done
		t.Fatal("callback re-entered a world/snapshot lock")
	}
}

func TestPrivateWorldFeedbackRejectsUnboundRetiredAndClosedRecipients(t *testing.T) {
	previous := activeSessions
	defer func() { activeSessions = previous }()
	for _, condition := range []string{"missing", "unbound", "retired", "transport-closed", "queue-closed"} {
		t.Run(condition, func(t *testing.T) {
			client := newAutoStatusClient("player-recipient")
			activeSessions = map[string]*Client{"recipient": client}
			switch condition {
			case "missing":
				delete(activeSessions, "recipient")
			case "unbound":
				client.playerID = ""
			case "retired":
				client.retired.Store(true)
			case "transport-closed":
				client.markTransportClosed()
			case "queue-closed":
				client.closeSendQueues()
			}
			if sendPrivateWorldFeedback("player-recipient", []byte("private")) {
				t.Fatal("invalid recipient accepted feedback")
			}
		})
	}
	if sendPrivateWorldFeedback("", []byte("private")) || sendPrivateWorldFeedback("player-recipient", nil) {
		t.Fatal("empty recipient/message accepted")
	}
}

func TestPrivateWorldFeedbackPressureIsBoundedAndPreservesPendingMessages(t *testing.T) {
	previous := activeSessions
	defer func() { activeSessions = previous }()
	client := newAutoStatusClient("player-recipient")
	client.prioritySend = make(chan []byte, 2)
	activeSessions = map[string]*Client{"recipient": client}
	first, second := []byte("earned-first"), []byte("earned-second")
	if !sendPrivateWorldFeedback(client.playerID, first) || !sendPrivateWorldFeedback(client.playerID, second) {
		t.Fatal("available priority slots rejected")
	}
	for range 1000 {
		if sendPrivateWorldFeedback(client.playerID, []byte("overflow")) {
			t.Fatal("saturated priority lane accepted extra work")
		}
	}
	if len(client.prioritySend) != 2 || len(client.send) != 0 {
		t.Fatal("pressure grew the lane or overflowed into state traffic")
	}
	if !bytes.Equal(<-client.prioritySend, first) || !bytes.Equal(<-client.prioritySend, second) {
		t.Fatal("pending private messages were replaced/reordered")
	}
}

func TestPrivateWorldFeedbackPressureClosesActualSlowTransport(t *testing.T) {
	accepted := make(chan *websocket.Conn, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err == nil {
			accepted <- conn
		}
	}))
	defer server.Close()
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	var conn *websocket.Conn
	select {
	case conn = <-accepted:
	case <-time.After(time.Second):
		t.Fatal("fixture transport did not upgrade")
	}
	defer conn.Close()
	previous := activeSessions
	defer func() { activeSessions = previous }()
	client := newAutoStatusClient("player-slow")
	client.conn, client.prioritySend = conn, make(chan []byte, 1)
	activeSessions = map[string]*Client{"slow": client}
	if !sendPrivateWorldFeedback(client.playerID, []byte("already queued")) ||
		sendPrivateWorldFeedback(client.playerID, []byte("overflow")) {
		t.Fatal("priority pressure did not preserve bounded admission")
	}
	peer.SetReadDeadline(time.Now().Add(time.Second))
	_, _, err = peer.ReadMessage()
	if err == nil {
		t.Fatal("slow transport remained open after overflow")
	}
	if timeout, ok := err.(net.Error); ok && timeout.Timeout() {
		t.Fatal("transport closed only because the fixture read timed out")
	}
	if len(client.prioritySend) != 1 || len(client.send) != 0 {
		t.Fatal("pressure lost the admitted message or spilled into the state lane")
	}
}
