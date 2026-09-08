package lifecycle

import (
	"sync"
	"testing"
	"time"
)

func TestCloseWaitsForAdmittedWorkAndRejectsNewWork(t *testing.T) {
	var g Group
	done, ok := g.Begin()
	if !ok {
		t.Fatal("initial work rejected")
	}
	finished := make(chan struct{})
	go func() { g.CloseAndWait(); close(finished) }()
	deadline := time.Now().Add(time.Second)
	for {
		g.mu.Lock()
		closed := g.closed
		g.mu.Unlock()
		if closed {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("admission did not close")
		}
		time.Sleep(time.Millisecond)
	}
	if _, ok := g.Begin(); ok {
		t.Fatal("closed admission accepted work")
	}
	select {
	case <-finished:
		t.Fatal("returned before admitted work completed")
	default:
	}
	done()
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("drain stuck")
	}
}

func TestSealDrainsNestedCompletionAndRejectsLateWork(t *testing.T) {
	var g Group
	parent, _ := g.Begin()
	finished := make(chan struct{})
	go func() { g.SealWhenIdle(); close(finished) }()
	child, ok := g.Begin()
	if !ok {
		t.Fatal("already admitted parent's child rejected")
	}
	parent()
	select {
	case <-finished:
		t.Fatal("lost nested completion")
	default:
	}
	child()
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("drain stuck")
	}
	if g.Go(func() { t.Error("late work ran") }) {
		t.Fatal("sealed group accepted work")
	}
}

func TestConcurrentCloseAndAdmission(t *testing.T) {
	for i := 0; i < 100; i++ {
		var g Group
		var callers sync.WaitGroup
		callers.Add(20)
		for j := 0; j < 20; j++ {
			go func() { defer callers.Done(); g.Go(func() {}) }()
		}
		g.CloseAndWait()
		callers.Wait()
		g.mu.Lock()
		active := g.active
		g.mu.Unlock()
		if active != 0 {
			t.Fatal("work escaped completed drain")
		}
	}
}
