package game

import "time"

// InvulnerabilityRemaining exposes the existing combat deadline for display.
// The caller holds the entity read lock or owns an immutable snapshot. This
// never grants protection or restarts the deadline for a new observer.
func (e *Entity) InvulnerabilityRemaining(now time.Time) float64 {
	if e == nil || e.State == "DEAD" || e.InvulnerableEndTime.IsZero() {
		return 0
	}
	return max(0, e.InvulnerableEndTime.Sub(now).Seconds())
}
