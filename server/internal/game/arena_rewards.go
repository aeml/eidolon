package game

import (
	"math"
	"time"

	"eidolon-server/internal/arena"
)

// K=32 Elo, using the opposing teams' mean entry ratings. Preserve the rating
// floor; do not create negative ratings or use victory itself as a flat bonus.
func arenaRatingChange(own, opponent int, won bool) int {
	expected := 1 / (1 + math.Pow(10, float64(opponent-own)/400))
	actual := 0.0
	if won {
		actual = 1
	}
	return int(math.Round(32 * (actual - expected)))
}

func clonePvPProfile(profile PvPProfile) PvPProfile {
	profile.RewardState = arena.CloneRewardState(profile.RewardState)
	return profile
}

// Daily counters are included in the same durable result as rating and Honor.
// Changing teams, reconnecting or restarting cannot reset an opponent's count.
// At the bounded history limit, withhold gains until UTC rollover rather than
// evicting entries and making reward farming possible again.
func (system *PvPSystem) arenaRewardRestrictionLocked(match *PvPMatch, day string) string {
	for _, team := range [][]string{match.TeamA, match.TeamB} {
		opponents := match.TeamA
		if containsPlayer(match.TeamA, team[0]) {
			opponents = match.TeamB
		}
		for _, id := range team {
			state := system.Profiles[id].RewardState
			if state.Day != day {
				continue
			}
			newOpponents := 0
			for _, opponent := range opponents {
				if state.Opponents[opponent] >= 3 {
					return "Repeated opponent: only the first three meetings per opponent each UTC day change rating or award rewards."
				}
				if state.Opponents[opponent] == 0 {
					newOpponents++
				}
			}
			if len(state.Opponents)+newOpponents > 256 {
				return "Daily opponent history limit reached; rating and rewards resume at 00:00 UTC."
			}
		}
	}
	return ""
}

// Caller holds PvP.mu. Construct detached profiles; nothing is awarded until
// completePvPMatch has recorded this entire result durably.
func (system *PvPSystem) rankedArenaProfilesLocked(match *PvPMatch, forfeit bool, now time.Time) []PvPProfile {
	if len(match.WinnerIDs) == 0 || match.Practice || (match.Mode != PvPModeArena1v1 && match.Mode != PvPModeArena2v2) {
		return nil
	}
	day := now.UTC().Format("2006-01-02")
	restriction := system.arenaRewardRestrictionLocked(match, day)
	ratingA, ratingB := system.arenaTeamRatingLocked(match.TeamA), system.arenaTeamRatingLocked(match.TeamB)
	profiles := make([]PvPProfile, 0, len(match.TeamA)+len(match.TeamB))
	for _, id := range append(append([]string(nil), match.TeamA...), match.TeamB...) {
		profile, exists := system.Profiles[id]
		if !exists {
			profile = PvPProfile{PlayerID: id, Rating: 1000}
		}
		profile = clonePvPProfile(profile)
		own, opponent, opponents := ratingA, ratingB, match.TeamB
		selfScore, otherScore := match.ScoreA, match.ScoreB
		if containsPlayer(match.TeamB, id) {
			own, opponent, opponents = ratingB, ratingA, match.TeamA
			selfScore, otherScore = match.ScoreB, match.ScoreA
		}
		won := containsPlayer(match.WinnerIDs, id)
		summary := arena.ResultSummary{MatchID: match.ID, Won: won, Forfeit: forfeit, TeamScore: selfScore, OpponentScore: otherScore, RatingBefore: profile.Rating}
		if won {
			profile.Wins++
		} else {
			profile.Losses++
		}
		if restriction != "" {
			summary.Reason = restriction
		} else {
			profile.Rating = max(0, profile.Rating+arenaRatingChange(own, opponent, won))
			summary.RatingChange = profile.Rating - summary.RatingBefore
			switch {
			case forfeit:
				summary.Reason = "Forfeit: rating reflects the result; neither team receives Honor or season points. Only the player who left receives a queue penalty."
			case won:
				summary.HonorAwarded, summary.SeasonAwarded = 50, 3
				summary.Reason = "Ranked victory: rating reflects opposing team strength."
			default:
				summary.Reason = "Ranked defeat: rating reflects opposing team strength. Honor and season points require a victory."
			}
		}
		if profile.RewardState.Day != day {
			profile.RewardState = arena.RewardState{Day: day, DeserterUntil: profile.RewardState.DeserterUntil}
		}
		if profile.RewardState.Opponents == nil {
			profile.RewardState.Opponents = make(map[string]int)
		}
		for _, opponentID := range opponents {
			if profile.RewardState.Opponents[opponentID] > 0 || len(profile.RewardState.Opponents) < 256 {
				profile.RewardState.Opponents[opponentID] = min(3, profile.RewardState.Opponents[opponentID]+1)
			}
		}
		profile.Honor += summary.HonorAwarded
		if penalty := system.DeserterUntil[id]; !penalty.IsZero() {
			profile.RewardState.DeserterUntil = max(profile.RewardState.DeserterUntil, penalty.Unix())
		}
		profile.SeasonPoints += summary.SeasonAwarded
		profile.LastResult = summary
		profile.UpdatedAt = now.UTC()
		profile.Revision++
		profile.LastMatchID = match.ID
		profiles = append(profiles, profile)
	}
	return profiles
}
