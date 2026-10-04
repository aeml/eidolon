package main

import "sync"

// Presentation invalidations need the latest state, not one queued job per
// trigger. Each owner retains one running worker and one dirty bit. Never use
// this for rewards, saves or individual messages that must all be delivered.
type coalescedSocialWork struct {
	mu      sync.Mutex
	running bool
	dirty   bool
}

func (w *coalescedSocialWork) request(schedule func(func()) bool, refresh func()) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.dirty = true
	if w.running {
		return true
	}
	w.running = true
	if !schedule(func() {
		for {
			w.mu.Lock()
			w.dirty = false
			w.mu.Unlock()
			refresh() // no scheduling mutex during world/character locks or database IO
			w.mu.Lock()
			if !w.dirty {
				w.running = false
				w.mu.Unlock()
				return
			}
			w.mu.Unlock()
		}
	}) {
		w.running, w.dirty = false, false
		return false
	}
	return true
}

var socialBroadcastWork coalescedSocialWork

func scheduleSocialBroadcast() bool {
	return socialBroadcastWork.request(scheduleCharacterWork, broadcastSocialToAll)
}

func scheduleFriendPresence(c *Client) bool {
	if c == nil || c.username == "" {
		return false
	}
	return c.friendPresenceWork.request(func(work func()) bool {
		return scheduleClientCharacterWork(c, work)
	}, func() { notifyFriendsPresence(c.username) })
}
