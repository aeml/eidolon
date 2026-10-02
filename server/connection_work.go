package main

import "time"

// A transport reservation covers its reader, writer, retirement and connection-owned
// background work. TCP closure alone cannot admit another socket while these
// workers still retain the old connection/character. Initialize before publish.
func (c *Client) initializeConnectionWork(release func()) {
	c.releaseSocketSlot = release
	c.connectionWorkUsers = 3 // reader + writer + exactly-once retirement
}

func (c *Client) beginConnectionWork() bool {
	if c == nil {
		return false
	}
	if c.releaseSocketSlot == nil {
		return true // In-process clients have no transport admission reservation.
	}
	c.connectionWorkMu.Lock()
	defer c.connectionWorkMu.Unlock()
	if c.connectionWorkReleased {
		return false
	}
	c.connectionWorkUsers++
	return true
}

func (c *Client) finishConnectionWork() {
	if c == nil || c.releaseSocketSlot == nil {
		return
	}
	c.connectionWorkMu.Lock()
	if c.connectionWorkUsers == 0 {
		c.connectionWorkMu.Unlock()
		return
	}
	c.connectionWorkUsers--
	release := c.connectionWorkUsers == 0
	if release {
		c.connectionWorkReleased = true
	}
	c.connectionWorkMu.Unlock()
	if release {
		c.releaseSocketSlot()
	}
}

func scheduleClientCharacterWork(c *Client, work func()) bool {
	if !c.beginConnectionWork() {
		return false
	}
	if !scheduleCharacterWork(func() {
		defer c.finishConnectionWork()
		work()
	}) {
		c.finishConnectionWork()
		return false
	}
	return true
}

// Called outside sessionsMu after retiring or replacing the old owner. Keep the
// old transport's brief notification/close task within shutdown tracking and
// its connection reservation. Duplicate observations cannot enqueue more tasks.
func closeReplacedClient(c *Client) {
	if c == nil {
		return
	}
	c.replacementCloseOnce.Do(func() {
		if c.conn == nil {
			c.sendError("Logged in from another location")
			return
		}
		if !scheduleClientCharacterWork(c, func() {
			c.sendError("Logged in from another location")
			// Give the existing write pump a chance to flush the notification;
			// this is not a delivery acknowledgement or extra session lifetime.
			time.Sleep(100 * time.Millisecond)
			_ = c.conn.Close()
		}) {
			// Shutdown/released reservation must still close the stale transport,
			// without launching an untracked fallback worker.
			_ = c.conn.Close()
		}
	})
}

// The reader, slow-peer retirement and shutdown can all observe the same
// transport loss. Only one cleanup owns its reservation; nested connection
// work may extend it, but can never release it twice. Rejected shutdown work
// does not pretend to complete cleanup; the final journal-all pass is separate.
func scheduleClientCleanup(c *Client) {
	if c == nil {
		return
	}
	c.cleanupOnce.Do(func() {
		scheduleCharacterWork(func() {
			defer c.finishConnectionWork()
			cleanupClient(c)
		})
	})
}
