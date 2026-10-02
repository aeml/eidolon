package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/lifecycle"

	"github.com/gorilla/websocket"
)

func TestWebsocketAdmissionConcurrentBoundAndIdempotentRelease(t *testing.T) {
	gate := &websocketConnectionGate{limit: 16}
	releases := make(chan func(), 128)
	var wg sync.WaitGroup
	for i := 0; i < 128; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if release, ok := gate.begin(); ok {
				releases <- release
			}
		}()
	}
	wg.Wait()
	close(releases)
	if len(releases) != 16 {
		t.Fatal("concurrent transport bound was bypassed")
	}
	for release := range releases {
		release()
		release()
	}
	gate.mu.Lock()
	active := gate.active
	gate.mu.Unlock()
	if active != 0 {
		t.Fatal("release leaked or double-freed transport slots")
	}
	if release, ok := gate.begin(); !ok {
		t.Fatal("closed transport did not restore admission")
	} else {
		release()
	}
	if release, ok := (&websocketConnectionGate{}).begin(); ok || release != nil {
		t.Fatal("invalid zero limit admitted traffic")
	}
}

func TestWebsocketAdmissionActualUpgradeAndDisconnect(t *testing.T) {
	oldGate, oldLifecycle, oldRegister, oldUnregister := websocketAdmission, serverAdmission, register, unregister
	oldWork := backgroundCharacterWork
	websocketAdmission = &websocketConnectionGate{limit: 1}
	serverAdmission = &lifecycle.Group{}
	backgroundCharacterWork = &lifecycle.Group{}
	register, unregister = make(chan *Client, 4), make(chan *Client)
	server := httptest.NewServer(http.HandlerFunc(serveWs))
	t.Cleanup(func() {
		server.Close()
		backgroundCharacterWork.SealWhenIdle()
		backgroundCharacterWork = oldWork
		websocketAdmission, serverAdmission, register, unregister = oldGate, oldLifecycle, oldRegister, oldUnregister
	})
	address := "ws" + strings.TrimPrefix(server.URL, "http")
	dial := func(origin string) (*websocket.Conn, *http.Response, error) {
		return (&websocket.Dialer{HandshakeTimeout: 3 * time.Second}).Dial(address, http.Header{"Origin": {origin}})
	}
	// A failed origin check must release the upgrade reservation.
	bad, response, err := dial("https://attacker.example")
	if bad != nil {
		bad.Close()
	}
	if err == nil || response == nil || response.StatusCode != http.StatusForbidden {
		t.Fatal("origin policy changed", err)
	}
	response.Body.Close()
	for cycle := 0; cycle < 2; cycle++ {
		// Admission is restored only after the previous reader/writer, retirement and
		// connection-owned background work have all finished.
		deadline := time.Now().Add(3 * time.Second)
		var conn *websocket.Conn
		for {
			conn, response, err = dial("https://play.eidolonrealms.com")
			if err == nil || response == nil || response.StatusCode != http.StatusServiceUnavailable || time.Now().After(deadline) {
				break
			}
			response.Body.Close()
			time.Sleep(time.Millisecond)
		}
		if err != nil || response == nil || response.StatusCode != http.StatusSwitchingProtocols {
			t.Fatal("ordinary upgrade or restored admission failed", err)
		}
		var client *Client
		select {
		case client = <-register:
		case <-time.After(3 * time.Second):
			conn.Close()
			t.Fatal("transport was not registered")
		}
		// Keep resources recoverable even if a later assertion fails.
		retired := false
		t.Cleanup(func() {
			conn.Close()
			client.closeSendQueues()
			if !retired {
				select {
				case closed := <-unregister:
					scheduleClientCleanup(closed)
				case <-time.After(3 * time.Second):
					t.Error("failed assertion left a transport reader running")
				}
			}
		})
		extra, denial, err := dial("https://play.eidolonrealms.com")
		if extra != nil {
			extra.Close()
		}
		if err == nil || denial == nil || denial.StatusCode != http.StatusServiceUnavailable || denial.Header.Get("Retry-After") != "1" {
			t.Fatal("active transport did not hold its slot after the HTTP handler returned", err)
		}
		denial.Body.Close()
		blocked, entered := make(chan struct{}), make(chan struct{}, 1)
		var unblock sync.Once
		t.Cleanup(func() { unblock.Do(func() { close(blocked) }) })
		if !scheduleClientCharacterWork(client, func() {
			entered <- struct{}{}
			<-blocked
		}) {
			t.Fatal("fixture background work was not admitted")
		}
		<-entered
		conn.Close()
		deadline = time.Now().Add(3 * time.Second)
		for !client.transportClosed.Load() && time.Now().Before(deadline) {
			time.Sleep(time.Millisecond)
		}
		if !client.transportClosed.Load() {
			t.Fatal("reader did not observe closure")
		}
		// The reader is now waiting on the unbuffered hub handoff. It must
		// still hold the slot even though its actual TCP connection is closed.
		extra, denial, err = dial("https://play.eidolonrealms.com")
		if extra != nil {
			extra.Close()
		}
		if err == nil || denial == nil || denial.StatusCode != http.StatusServiceUnavailable {
			t.Fatal("queued retirement released its slot early", err)
		}
		denial.Body.Close()
		select {
		case closed := <-unregister:
			retired = true
			if closed != client {
				t.Fatal("wrong transport retired")
			}
			closed.closeSendQueues()
			scheduleClientCleanup(closed)
		case <-time.After(3 * time.Second):
			t.Fatal("closed reader did not hand off retirement")
		}
		extra, denial, err = dial("https://play.eidolonrealms.com")
		if extra != nil {
			extra.Close()
		}
		if err == nil || denial == nil || denial.StatusCode != http.StatusServiceUnavailable {
			t.Fatal("closed reader freed admission while owned work remained")
		}
		denial.Body.Close()
		unblock.Do(func() { close(blocked) })
	}
}
