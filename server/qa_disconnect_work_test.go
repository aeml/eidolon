package main

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"eidolon-server/internal/lifecycle"
)

func TestQADisconnectWorkIsOwnedAndScheduledOnce(t *testing.T) {
	previous := backgroundCharacterWork
	group := &lifecycle.Group{}
	backgroundCharacterWork = group
	t.Cleanup(func() { group.SealWhenIdle(); backgroundCharacterWork = previous })
	peer, barrier, unblock := replacementSocketFixture(t)
	gate := &websocketConnectionGate{limit: 1}
	release, _ := gate.begin()
	client := &Client{conn: peer}
	client.initializeConnectionWork(release)
	var triggers sync.WaitGroup
	for range 64 {
		triggers.Add(1)
		go func() { defer triggers.Done(); client.triggerQADisconnect() }()
	}
	triggers.Wait()
	select {
	case <-barrier.entered:
	case <-time.After(2 * time.Second):
		t.Fatal("tracked reconnect fault did not reach socket Close")
	}
	client.connectionWorkMu.Lock()
	owners := client.connectionWorkUsers
	client.connectionWorkMu.Unlock()
	if owners != 4 {
		t.Fatal("repeated reconnect triggers multiplied workers", owners)
	}
	for range 3 { // reader, writer and retirement are not launched by this fixture
		client.finishConnectionWork()
	}
	if free, admitted := gate.begin(); admitted {
		free()
		t.Fatal("delayed socket close outlived its connection reservation")
	}
	unblock()
	group.SealWhenIdle()
	client.triggerQADisconnect() // must not revive work after release
	if free, admitted := gate.begin(); !admitted {
		t.Fatal("completed reconnect fault leaked its reservation")
	} else {
		free()
	}
}

func TestQADisconnectWorkSealedSchedulingClosesWithoutLeaseLeak(t *testing.T) {
	previous := backgroundCharacterWork
	group := &lifecycle.Group{}
	group.CloseAndWait()
	backgroundCharacterWork = group
	defer func() { backgroundCharacterWork = previous }()
	peer, barrier, unblock := replacementSocketFixture(t)
	unblock()
	gate := &websocketConnectionGate{limit: 1}
	release, _ := gate.begin()
	client := &Client{conn: peer}
	client.initializeConnectionWork(release)
	client.triggerQADisconnect()
	select {
	case <-barrier.entered:
	default:
		t.Fatal("refused work did not synchronously close stale socket")
	}
	client.connectionWorkMu.Lock()
	owners := client.connectionWorkUsers
	client.connectionWorkMu.Unlock()
	if owners != 3 {
		t.Fatal("rejected scheduling retained a connection reference", owners)
	}
	for range 3 {
		client.finishConnectionWork()
	}
	if free, admitted := gate.begin(); !admitted {
		t.Fatal("rejected work leaked its reservation")
	} else {
		free()
	}
}

func TestQADisconnectWorkHookIsOncePerConnectionAndMissingSocketIsSafe(t *testing.T) {
	var calls atomic.Int32
	client := &Client{qaDisconnect: func() { calls.Add(1) }}
	var triggers sync.WaitGroup
	for range 64 {
		triggers.Add(1)
		go func() { defer triggers.Done(); client.triggerQADisconnect() }()
	}
	triggers.Wait()
	if calls.Load() != 1 {
		t.Fatal("test hook does not represent once-per-connection fault", calls.Load())
	}
	var absent *Client
	absent.triggerQADisconnect()
	(&Client{}).triggerQADisconnect()
}
