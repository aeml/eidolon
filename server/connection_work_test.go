package main

import (
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/lifecycle"
)

func TestConnectionWorkLeaseIncludesActualWriterExit(t *testing.T) {
	peer, barrier, unblock := replacementSocketFixture(t)
	gate := &websocketConnectionGate{limit: 1}
	release, _ := gate.begin()
	client := &Client{conn: peer, prioritySend: make(chan []byte)}
	client.initializeConnectionWork(release)
	close(client.prioritySend)
	done := make(chan struct{})
	go func() { defer close(done); client.writePump() }()
	// The actual writer exits its queue loop and is held only in socket Close.
	select {
	case <-barrier.entered:
	case <-time.After(time.Second):
		t.Fatal("writer did not enter its transport cleanup")
	}
	client.finishConnectionWork() // reader
	client.finishConnectionWork() // retirement
	if free, admitted := gate.begin(); admitted {
		free()
		t.Fatal("reader/retirement released capacity while the actual writer remained")
	}
	unblock()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("writer did not finish after close completed")
	}
	if free, admitted := gate.begin(); !admitted {
		t.Fatal("completed writer retained its reservation")
	} else {
		free()
	}
}

func TestConnectionWorkLeaseWaitsForReaderCleanupAndConcurrentWorkers(t *testing.T) {
	gate := &websocketConnectionGate{limit: 1}
	release, ok := gate.begin()
	if !ok {
		t.Fatal("fixture admission failed")
	}
	client := &Client{}
	client.initializeConnectionWork(release)
	var producers sync.WaitGroup
	for range 64 {
		producers.Add(1)
		go func() {
			defer producers.Done()
			if !client.beginConnectionWork() {
				t.Error("live reservation rejected background work")
			}
		}()
	}
	producers.Wait()
	client.finishConnectionWork() // reader
	client.finishConnectionWork() // writer (not launched by this fixture)
	client.finishConnectionWork() // retirement
	if free, admitted := gate.begin(); admitted {
		free()
		t.Fatal("base retirement released still-owned workers")
	}
	for range 64 {
		producers.Add(1)
		go func() { defer producers.Done(); client.finishConnectionWork() }()
	}
	producers.Wait()
	if client.beginConnectionWork() {
		t.Fatal("released connection revived its reservation")
	}
	client.finishConnectionWork() // Defensive duplicate completion cannot free a new owner.
	free, admitted := gate.begin()
	if !admitted {
		t.Fatal("completed work did not restore admission")
	}
	defer free()
	if extra, admitted := gate.begin(); admitted {
		extra()
		t.Fatal("completion double-freed the new owner's slot")
	}
}

func TestConnectionWorkNestedTasksExtendCleanupLease(t *testing.T) {
	oldWork := backgroundCharacterWork
	backgroundCharacterWork = &lifecycle.Group{}
	blocked, entered := make(chan struct{}), make(chan struct{}, 1)
	var unblock sync.Once
	t.Cleanup(func() {
		unblock.Do(func() { close(blocked) })
		backgroundCharacterWork.SealWhenIdle()
		backgroundCharacterWork = oldWork
	})
	gate := &websocketConnectionGate{limit: 1}
	release, _ := gate.begin()
	client := &Client{}
	client.initializeConnectionWork(release)
	if !scheduleClientCharacterWork(client, func() {
		if !scheduleClientCharacterWork(client, func() { entered <- struct{}{}; <-blocked }) {
			t.Error("nested owned work was rejected")
		}
	}) {
		t.Fatal("owned work was rejected")
	}
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("nested work did not start")
	}
	client.finishConnectionWork() // reader
	client.finishConnectionWork() // writer (not launched by this fixture)
	// The blank in-process account exits cleanup without database/world work.
	scheduleClientCleanup(client)
	scheduleClientCleanup(client) // Must not finish the retirement lease twice.
	if extra, admitted := gate.begin(); admitted {
		extra()
		t.Fatal("cleanup freed its nested background work")
	}
	unblock.Do(func() { close(blocked) })
	backgroundCharacterWork.SealWhenIdle()
	if free, admitted := gate.begin(); !admitted {
		t.Fatal("drained child work did not restore admission")
	} else {
		free()
	}
}

func TestConnectionWorkRejectedAdmissionDoesNotLeakOwnedReference(t *testing.T) {
	oldWork := backgroundCharacterWork
	backgroundCharacterWork = &lifecycle.Group{}
	backgroundCharacterWork.CloseAndWait()
	defer func() { backgroundCharacterWork = oldWork }()
	gate := &websocketConnectionGate{limit: 1}
	release, _ := gate.begin()
	client := &Client{}
	client.initializeConnectionWork(release)
	if scheduleClientCharacterWork(client, func() { t.Error("rejected work ran") }) {
		t.Fatal("sealed admission accepted work")
	}
	client.connectionWorkMu.Lock()
	users := client.connectionWorkUsers
	client.connectionWorkMu.Unlock()
	if users != 3 {
		t.Fatal("rejected work retained an owned reference")
	}
	client.finishConnectionWork()
	client.finishConnectionWork()
	client.finishConnectionWork()
	if free, admitted := gate.begin(); !admitted {
		t.Fatal("rejected admission leaked the reservation")
	} else {
		free()
	}
}
