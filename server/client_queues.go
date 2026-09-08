package main

// Queue closure and every producer use the same lock. Recovering from a send
// panic is not synchronization: a concurrent close/send is still a data race.
func (c *Client) closeSendQueues() {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	if c.sendClosed {
		return
	}
	c.sendClosed = true
	c.transportClosed.Store(true)
	if c.send != nil {
		close(c.send)
	}
	if c.prioritySend != nil {
		close(c.prioritySend)
	}
}

// State and time traffic can be dropped under pressure; critical traffic uses
// sendSafe's independent priority lane. Neither path blocks the shared hub.
func (c *Client) sendState(data []byte) bool {
	c.sendMu.RLock()
	defer c.sendMu.RUnlock()
	if c.sendClosed {
		return false
	}
	select {
	case c.send <- data:
		return true
	default:
		return false
	}
}

// Character identity is assigned once, before publishing a joined connection
// to snapshot readers under sessionsMu. Subsequent Join requests cannot rewrite
// the string while a reader uses this already-published immutable binding.
func (c *Client) bindPlayerID(id string) {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	if c.playerID == "" {
		c.playerID = id
	}
}

func (c *Client) boundPlayerID() string {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	return c.playerID
}

func (c *Client) resetSnapshotHistory() {
	c.stateMu.Lock()
	defer c.stateMu.Unlock()
	c.seenIDs = make(map[string]bool)
	c.lastState = make(map[string]*EntitySnapshot)
}
