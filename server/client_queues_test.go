package main

import (
	"sync"
	"testing"
)

func TestClientQueuesSerializeDisconnectAndBroadcast(t *testing.T) {
	for repeat := 0; repeat < 20; repeat++ {
		c := &Client{send: make(chan []byte, 64), prioritySend: make(chan []byte, 64)}
		var wg sync.WaitGroup
		for worker := 0; worker < 8; worker++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for i := 0; i < 1000; i++ {
					c.sendState([]byte("state"))
					c.sendSafe([]byte("critical"))
				}
			}()
		}
		c.closeSendQueues()
		c.closeSendQueues()
		wg.Wait()
		if c.sendState(nil) || c.sendSafe(nil) {
			t.Fatal("closed connection accepted a broadcast")
		}
	}
}

func TestClientPlayerBindingIsPublishedOnce(t *testing.T) {
	c := &Client{}
	var group sync.WaitGroup
	for i := 0; i < 50; i++ {
		group.Add(1)
		go func() { defer group.Done(); c.bindPlayerID("player-test"); _ = c.boundPlayerID() }()
	}
	group.Wait()
	c.bindPlayerID("player-other")
	if c.boundPlayerID() != "player-test" {
		t.Fatal("published character identity changed")
	}
}

func TestClientSnapshotResetSerializesWithBroadcast(t *testing.T) {
	c := &Client{}
	c.resetSnapshotHistory()
	var group sync.WaitGroup
	for worker := 0; worker < 4; worker++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for i := 0; i < 1000; i++ {
				c.resetSnapshotHistory()
				c.stateMu.Lock()
				c.seenIDs["player-test"] = true
				c.lastState["player-test"] = &EntitySnapshot{}
				c.stateMu.Unlock()
			}
		}()
	}
	group.Wait()
	c.resetSnapshotHistory()
	if len(c.seenIDs) != 0 || len(c.lastState) != 0 {
		t.Fatal("rejoin did not reset snapshot history")
	}
}
