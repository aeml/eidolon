package main

import "sync"

const defaultWebsocketConnections = 512
const maxWebsocketConnections = 4096

// Count upgrades, readers, retirement and connection-owned background work,
// not only the HTTP handler/TCP lifetime. No IP/forwarding claim or account
// role bypasses this process bound.
type websocketConnectionGate struct {
	mu     sync.Mutex
	limit  int
	active int
}

var websocketAdmission = &websocketConnectionGate{limit: defaultWebsocketConnections}

func (g *websocketConnectionGate) begin() (func(), bool) {
	g.mu.Lock()
	if g.limit < 1 || g.active >= g.limit {
		g.mu.Unlock()
		return nil, false
	}
	g.active++
	g.mu.Unlock()
	var once sync.Once
	return func() {
		once.Do(func() {
			g.mu.Lock()
			g.active--
			g.mu.Unlock()
		})
	}, true
}
