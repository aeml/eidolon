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
