// Package lifecycle tracks admitted work without the WaitGroup Add/Wait race.
package lifecycle

import "sync"

// Group is usable at its zero value. Do not copy it after first use.
type Group struct {
	mu      sync.Mutex
	changed *sync.Cond
	active  int
	closed  bool
}

func (g *Group) conditionLocked() *sync.Cond {
	if g.changed == nil {
		g.changed = sync.NewCond(&g.mu)
	}
	return g.changed
}

func (g *Group) Begin() (func(), bool) {
	g.mu.Lock()
	if g.closed {
		g.mu.Unlock()
		return nil, false
	}
	g.active++
	g.mu.Unlock()
	return func() {
		g.mu.Lock()
		g.active--
		g.conditionLocked().Broadcast()
		g.mu.Unlock()
	}, true
}

func (g *Group) Go(work func()) bool {
	done, ok := g.Begin()
	if !ok {
		return false
	}
	go func() { defer done(); work() }()
	return true
}

// CloseAndWait rejects new admission immediately, then waits for admitted work.
// Use for external commands, not tasks that must enqueue child completion work.
func (g *Group) CloseAndWait() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.closed = true
	for g.active != 0 {
		g.conditionLocked().Wait()
	}
}

// SealWhenIdle is for completion trees AFTER their external producers stop.
// Existing tasks may enqueue children; sealing and observing zero are atomic.
func (g *Group) SealWhenIdle() {
	g.mu.Lock()
	defer g.mu.Unlock()
	for g.active != 0 {
		g.conditionLocked().Wait()
	}
	g.closed = true
}
