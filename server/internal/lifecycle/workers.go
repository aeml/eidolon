package lifecycle

import (
	"context"
	"sync"
	"time"
)

// Workers owns the application's long-lived workers and periodic loops.
// Construct it with NewWorkers and register work only during startup, before
// Stop begins. Unlike Group, it is not an admission gate for incoming requests.
// Do not copy it after first use.
type Workers struct {
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewWorkers creates an independent application lifetime.
func NewWorkers() *Workers {
	ctx, cancel := context.WithCancel(context.Background())
	return &Workers{ctx: ctx, cancel: cancel}
}

// Context is canceled when Stop begins. Workers should observe it to exit;
// Stop still joins work already in progress rather than abandoning it.
func (workers *Workers) Context() context.Context { return workers.ctx }

// Go starts one owned worker. Call only during startup, before Stop begins.
func (workers *Workers) Go(work func()) {
	workers.wg.Add(1)
	go func() {
		defer workers.wg.Done()
		work()
	}()
}

// Every starts one periodic worker. Its ticks run serially, beginning after the
// first interval, and an active tick is joined during Stop. Call only during
// startup, before Stop begins. The interval must be positive.
func (workers *Workers) Every(interval time.Duration, tick func()) {
	workers.Go(func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-workers.ctx.Done():
				return
			case <-ticker.C:
				if workers.ctx.Err() != nil {
					return
				}
				tick()
			}
		}
	})
}

// Stop cancels all owned workers and waits for them to finish. It is safe to
// call again after work registration has finished. Do not call it from an owned
// worker, which would wait for itself.
func (workers *Workers) Stop() { workers.cancel(); workers.wg.Wait() }
