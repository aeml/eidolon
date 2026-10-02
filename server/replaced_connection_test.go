package main

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/lifecycle"
	"github.com/gorilla/websocket"
)

// Block only socket Close, not its notification timer, so reservation checks
// cannot race a fast close or depend on the scheduler meeting a 100ms window.
type replacementCloseBarrier struct {
	net.Conn
	entered chan struct{}
	allow   chan struct{}
	once    sync.Once
}

func (c *replacementCloseBarrier) Close() error {
	c.once.Do(func() { close(c.entered) })
	<-c.allow
	return c.Conn.Close()
}

func replacementSocketFixture(t *testing.T) (*websocket.Conn, *replacementCloseBarrier, func()) {
	t.Helper()
	done := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(done)
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer conn.Close()
		conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		_, _, _ = conn.ReadMessage()
	}))
	var barrier *replacementCloseBarrier
	dialer := websocket.Dialer{NetDialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
		conn, err := (&net.Dialer{}).DialContext(ctx, network, address)
		if err != nil {
			return nil, err
		}
		barrier = &replacementCloseBarrier{Conn: conn, entered: make(chan struct{}), allow: make(chan struct{})}
		return barrier, nil
	}}
	peer, _, err := dialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		server.Close()
		t.Fatal(err)
	}
	var once sync.Once
	unblock := func() { once.Do(func() { close(barrier.allow) }) }
	t.Cleanup(func() {
		unblock()
		peer.Close()
		server.Close()
		select {
		case <-done:
		case <-time.After(time.Second):
			t.Error("replacement socket fixture did not retire")
		}
	})
	return peer, barrier, unblock
}

func TestReplacedConnectionCloseIsOwnedAndScheduledOnce(t *testing.T) {
	previous := backgroundCharacterWork
	backgroundCharacterWork = &lifecycle.Group{}
	t.Cleanup(func() { backgroundCharacterWork.SealWhenIdle(); backgroundCharacterWork = previous })
	peer, barrier, unblock := replacementSocketFixture(t)
	gate := &websocketConnectionGate{limit: 1}
	release, _ := gate.begin()
	client := &Client{conn: peer, prioritySend: make(chan []byte, 128)}
	client.initializeConnectionWork(release)
	var observers sync.WaitGroup
	for range 64 {
		observers.Add(1)
		go func() { defer observers.Done(); closeReplacedClient(client) }()
	}
	observers.Wait()
	select {
	case <-barrier.entered:
	case <-time.After(2 * time.Second):
		t.Fatal("tracked replacement did not attempt socket close")
	}
	if len(client.prioritySend) != 1 {
		t.Fatal("duplicate observations multiplied replacement notifications")
	}
	client.finishConnectionWork() // reader
	client.finishConnectionWork() // writer (not launched by this fixture)
	client.finishConnectionWork() // retirement
	if free, admitted := gate.begin(); admitted {
		free()
		t.Fatal("replacement close outlived its transport reservation")
	}
	unblock()
	backgroundCharacterWork.SealWhenIdle()
	closeReplacedClient(client) // Cannot revive work or duplicate notification.
	if free, admitted := gate.begin(); !admitted {
		t.Fatal("finished close retained the reservation")
	} else {
		free()
	}
	if len(client.prioritySend) != 1 {
		t.Fatal("completed replacement notification repeated")
	}
}

func TestReplacedConnectionSealedWorkStillClosesWithoutLeaseLeak(t *testing.T) {
	previous := backgroundCharacterWork
	backgroundCharacterWork = &lifecycle.Group{}
	backgroundCharacterWork.CloseAndWait()
	defer func() { backgroundCharacterWork = previous }()
	peer, barrier, unblock := replacementSocketFixture(t)
	unblock()
	gate := &websocketConnectionGate{limit: 1}
	release, _ := gate.begin()
	client := &Client{conn: peer, prioritySend: make(chan []byte, 1)}
	client.initializeConnectionWork(release)
	closeReplacedClient(client)
	select {
	case <-barrier.entered:
	default:
		t.Fatal("rejected background admission left stale transport open")
	}
	client.connectionWorkMu.Lock()
	users := client.connectionWorkUsers
	client.connectionWorkMu.Unlock()
	if users != 3 || len(client.prioritySend) != 0 {
		t.Fatal("sealed work retained a lease or executed notification")
	}
	client.finishConnectionWork()
	client.finishConnectionWork()
	client.finishConnectionWork()
	if free, admitted := gate.begin(); !admitted {
		t.Fatal("rejected close admission leaked transport slot")
	} else {
		free()
	}
	closeReplacedClient(nil)
	inProcess := &Client{prioritySend: make(chan []byte, 2)}
	closeReplacedClient(inProcess)
	closeReplacedClient(inProcess)
	if len(inProcess.prioritySend) != 1 {
		t.Fatal("connection-less fixture lost or repeated its notification")
	}
}
