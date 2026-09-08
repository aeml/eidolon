package game

import "time"

func (w *World) backgroundDone() <-chan struct{} {
	w.backgroundStopInit.Do(func() { w.backgroundStop = make(chan struct{}) })
	return w.backgroundStop
}

func (w *World) runBackground(work func()) bool { return w.backgroundWork.Go(work) }

func (w *World) waitBackground(delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-w.backgroundDone():
		return false
	case <-timer.C:
		select {
		case <-w.backgroundDone():
			return false
		default:
			return true
		}
	}
}

// StopBackground is called only after command admission and world ticks stop.
// Cancel incomplete timers/vigils, but drain earned rewards and their children.
// Nothing holding a world/entity lock may call this blocking operation.
func (w *World) StopBackground() {
	w.backgroundDone()
	w.backgroundStopOnce.Do(func() { close(w.backgroundStop) })
	if w.Trading != nil {
		w.Trading.StopRefundDelivery()
		w.Trading.backgroundWork.SealWhenIdle()
	}
	w.backgroundWork.SealWhenIdle()
}
