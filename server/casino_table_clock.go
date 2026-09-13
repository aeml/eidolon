package main

import "time"

const casinoBettingWindow = 30 * time.Second
const casinoResultPause = 12 * time.Second

// A window exists independently of funded players. Catch up to one future
// boundary after downtime without replaying empty rounds or charging anyone.
func nextCasinoBettingDeadline(deadline, now time.Time) time.Time {
	if deadline.IsZero() {
		return now.Add(casinoBettingWindow)
	}
	if now.Before(deadline) {
		return deadline
	}
	return deadline.Add((now.Sub(deadline)/casinoBettingWindow + 1) * casinoBettingWindow)
}
