package main

import "time"

// Each observation is owned by one socket reader. Read it only after that
// reader has terminated; no identities, credentials or actor data are retained.
type loadObservation struct {
	frames, wireBytes         uint64
	firstStateAt, lastStateAt time.Time
	maxGap                    time.Duration
}

func (observation *loadObservation) state(state map[string]Entity, playerID string, now time.Time) {
	if state[playerID].Type != "Player" {
		return // Other actors or a sent join request do not establish own coverage.
	}
	if observation.frames == 0 {
		observation.firstStateAt = now
	} else if gap := now.Sub(observation.lastStateAt); gap > observation.maxGap {
		observation.maxGap = gap
	}
	observation.lastStateAt = now
	observation.frames++
}

type stateCoverage struct {
	clients, minFrames, wireBytes uint64
	minActive, maxGap             time.Duration
}

func summarizeStateCoverage(observations []loadObservation) stateCoverage {
	var result stateCoverage
	for index, observation := range observations {
		if observation.frames > 0 {
			result.clients++
		}
		active := observation.lastStateAt.Sub(observation.firstStateAt)
		if index == 0 || observation.frames < result.minFrames {
			result.minFrames = observation.frames
		}
		if index == 0 || active < result.minActive {
			result.minActive = active
		}
		if observation.maxGap > result.maxGap {
			result.maxGap = observation.maxGap
		}
		result.wireBytes += observation.wireBytes
	}
	return result
}
