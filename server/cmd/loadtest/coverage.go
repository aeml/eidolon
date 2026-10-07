package main

import "time"

// Each observation is owned by one socket reader. Read it only after that
// reader has terminated; no identities, credentials or actor data are retained.
type loadObservation struct {
	frames, ownUpdates, wireBytes         uint64
	firstStateAt, lastStateAt             time.Time
	maxGap                                time.Duration
	registrationTime, loginTime, joinTime time.Duration
	casino                                casinoLoadCounts
	social                                socialLoadCounts
	readFailure                           readFailureStage
	recovery                              recoveryCounts
}

func (observation *loadObservation) state(state map[string]Entity, playerID string, now time.Time, freshOwn bool) {
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
	if freshOwn {
		observation.ownUpdates++
	}
}

type stateCoverage struct {
	clients, minFrames, wireBytes      uint64
	ownClients, minOwnUpdates          uint64
	minActive, maxGap                  time.Duration
	maxRegistration, maxLogin, maxJoin time.Duration
}

// A common interval requires an actual own-player view from every reader.
// Epoch times allow independently launched cohorts on this host to prove their
// overlap; sums of separate runs or scheduled process lifetimes cannot do so.
func commonStateWindow(observations []loadObservation) (latestFirst, earliestLast time.Time) {
	for index, observation := range observations {
		if observation.frames == 0 || observation.ownUpdates == 0 || observation.firstStateAt.IsZero() || observation.lastStateAt.Before(observation.firstStateAt) {
			return time.Time{}, time.Time{}
		}
		if index == 0 || observation.firstStateAt.After(latestFirst) {
			latestFirst = observation.firstStateAt
		}
		if index == 0 || observation.lastStateAt.Before(earliestLast) {
			earliestLast = observation.lastStateAt
		}
	}
	if !earliestLast.After(latestFirst) {
		return time.Time{}, time.Time{}
	}
	return latestFirst, earliestLast
}

func summarizeStateCoverage(observations []loadObservation) stateCoverage {
	var result stateCoverage
	for index, observation := range observations {
		if observation.frames > 0 {
			result.clients++
		}
		if observation.ownUpdates > 0 {
			result.ownClients++
		}
		if index == 0 || observation.ownUpdates < result.minOwnUpdates {
			result.minOwnUpdates = observation.ownUpdates
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
		if observation.registrationTime > result.maxRegistration {
			result.maxRegistration = observation.registrationTime
		}
		if observation.loginTime > result.maxLogin {
			result.maxLogin = observation.loginTime
		}
		if observation.joinTime > result.maxJoin {
			result.maxJoin = observation.joinTime
		}
	}
	return result
}
