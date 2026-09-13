// Package arena contains the small competitive records shared by gameplay and
// persistence. It does not own matchmaking or database access.
package arena

type ResultSummary struct {
	MatchID       string `json:"matchId" bson:"match_id"`
	Won           bool   `json:"won" bson:"won"`
	Forfeit       bool   `json:"forfeit" bson:"forfeit"`
	TeamScore     int    `json:"teamScore" bson:"team_score"`
	OpponentScore int    `json:"opponentScore" bson:"opponent_score"`
	RatingBefore  int    `json:"ratingBefore" bson:"rating_before"`
	RatingChange  int    `json:"ratingChange" bson:"rating_change"`
	HonorAwarded  int    `json:"honorAwarded" bson:"honor_awarded"`
	SeasonAwarded int    `json:"seasonAwarded" bson:"season_awarded"`
	Reason        string `json:"reason" bson:"reason"`
}

type RewardState struct {
	DeserterUntil int64          `json:"deserterUntil,omitempty" bson:"deserter_until,omitempty"`
	Day           string         `json:"day" bson:"day"`
	Opponents     map[string]int `json:"opponents,omitempty" bson:"opponents,omitempty"`
}

func CloneRewardState(state RewardState) RewardState {
	copy := RewardState{Day: state.Day, DeserterUntil: state.DeserterUntil}
	if len(state.Opponents) > 0 {
		copy.Opponents = make(map[string]int, len(state.Opponents))
		for id, count := range state.Opponents {
			copy.Opponents[id] = count
		}
	}
	return copy
}
