package main

import (
	"sync"
	"testing"
)

func TestClientQueueCloseSerializesEveryProducer(t *testing.T) {
	for cycle := 0; cycle < 50; cycle++ {
		c := &Client{send: make(chan []byte, 8), prioritySend: make(chan []byte, 8)}
		var group sync.WaitGroup
		for writer := 0; writer < 4; writer++ {
			group.Add(1)
			go func() {
				defer group.Done()
				for i := 0; i < 100; i++ {
					c.sendSafe([]byte("critical"))
					c.sendState([]byte("state"))
				}
			}()
		}
		c.closeSendQueues()
		c.closeSendQueues()
		group.Wait()
		if !c.transportClosed.Load() || c.sendSafe(nil) || c.sendState(nil) {
			t.Fatal("closed client still accepts output")
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
