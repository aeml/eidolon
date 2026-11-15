package lifecycle

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func awaitWorkerSignal(t *testing.T, signal <-chan struct{}, message string) {
	t.Helper()
	select {
	case <-signal:
	case <-time.After(time.Second):
		t.Fatal(message)
	}
}

func TestWorkersStopCancelsAndJoinsEveryWorker(t *testing.T) {
	workers := NewWorkers()
	entered := make(chan struct{}, 2)
	firstRelease, secondRelease := make(chan struct{}), make(chan struct{})
	firstFinished, stopped := make(chan struct{}), make(chan struct{})
	var releaseFirst, releaseSecond sync.Once
	t.Cleanup(func() {
		releaseFirst.Do(func() { close(firstRelease) })
		releaseSecond.Do(func() { close(secondRelease) })
		workers.Stop()
	})
	workers.Go(func() {
		entered <- struct{}{}
		<-workers.Context().Done()
		<-firstRelease
		close(firstFinished)
	})
	workers.Go(func() {
		entered <- struct{}{}
		<-workers.Context().Done()
		<-secondRelease
	})
	awaitWorkerSignal(t, entered, "first worker did not start")
	awaitWorkerSignal(t, entered, "second worker did not start")
	go func() { workers.Stop(); close(stopped) }()
	awaitWorkerSignal(t, workers.Context().Done(), "stop did not cancel the shared context")
	select {
	case <-stopped:
		t.Fatal("stop returned before its workers finished")
	default:
	}
	releaseFirst.Do(func() { close(firstRelease) })
	awaitWorkerSignal(t, firstFinished, "first worker did not finish")
	select {
	case <-stopped:
		t.Fatal("stop joined only one worker")
	default:
	}
	releaseSecond.Do(func() { close(secondRelease) })
	awaitWorkerSignal(t, stopped, "stop did not finish after both workers returned")
	workers.Stop() // Repeated shutdown joins the same completed lifetime.
}

func TestWorkersEveryJoinsActiveTickAndDoesNotRunCanceledTicks(t *testing.T) {
	workers := NewWorkers()
	entered, release, stopped := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var releaseTick sync.Once
	var count atomic.Int32
	t.Cleanup(func() {
		releaseTick.Do(func() { close(release) })
		workers.Stop()
	})
	workers.Every(time.Millisecond, func() {
		if count.Add(1) == 1 {
			close(entered)
			<-release
		}
	})
	awaitWorkerSignal(t, entered, "periodic worker did not start")
	go func() { workers.Stop(); close(stopped) }()
	awaitWorkerSignal(t, workers.Context().Done(), "stop did not cancel the ticker")
	select {
	case <-stopped:
		t.Fatal("stop returned during an active tick")
	default:
	}
	releaseTick.Do(func() { close(release) })
	awaitWorkerSignal(t, stopped, "active tick was not joined")
	if count.Load() != 1 {
		t.Fatal("a canceled or overlapping tick ran")
	}
}

func TestWorkersOwnIndependentLifetimes(t *testing.T) {
	first, second := NewWorkers(), NewWorkers()
	t.Cleanup(first.Stop)
	t.Cleanup(second.Stop)
	firstFinished, secondFinished := make(chan struct{}), make(chan struct{})
	first.Go(func() { <-first.Context().Done(); close(firstFinished) })
	second.Go(func() { <-second.Context().Done(); close(secondFinished) })
	first.Stop()
	awaitWorkerSignal(t, firstFinished, "first lifetime did not stop")
	select {
	case <-second.Context().Done():
		t.Fatal("stopping one owner canceled another")
	case <-secondFinished:
		t.Fatal("another owner's worker stopped")
	default:
	}
	second.Stop()
	awaitWorkerSignal(t, secondFinished, "second lifetime did not stop")
}

func TestWorkersStopWithoutWork(t *testing.T) {
	workers := NewWorkers()
	workers.Stop()
	workers.Stop()
	if workers.Context().Err() == nil {
		t.Fatal("empty lifetime was not canceled")
	}
}
