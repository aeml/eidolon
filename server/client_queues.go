package main

// Closing a queue and every producer share a lock. Recovering from a send panic
// alone does not make a concurrent send/close safe.
func (c *Client) closeSendQueues() {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	if c.sendClosed {
		return
	}
	c.sendClosed = true
	if c.send != nil {
		close(c.send)
	}
	if c.prioritySend != nil {
		close(c.prioritySend)
	}
}

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

// Publish once under the same lock used to select joined snapshot recipients.
// Once observed by a reader, the character binding must remain immutable.
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
