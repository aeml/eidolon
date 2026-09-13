package arena

import (
	"fmt"
	"time"
)

type SeasonRecord struct {
	Season       string `json:"season" bson:"season"`
	Rating       int    `json:"rating" bson:"rating"`
	Wins         int    `json:"wins" bson:"wins"`
	Losses       int    `json:"losses" bson:"losses"`
	EligibleWins int    `json:"eligibleWins" bson:"eligible_wins"`
	Medal        string `json:"medal" bson:"medal"`
	HonorAwarded int    `json:"honorAwarded" bson:"honor_awarded"`
	SettledAt    int64  `json:"settledAt" bson:"settled_at"`
}

func CurrentSeason(at time.Time) string {
	return fmt.Sprintf("%d-Q%d", at.UTC().Year(), (int(at.UTC().Month())-1)/3+1)
}

func SeasonEnd(at time.Time) time.Time {
	at = at.UTC()
	return time.Date(at.Year(), time.Month(((int(at.Month())-1)/3+1)*3+1), 1, 0, 0, 0, 0, time.UTC)
}

// These are cumulative qualification thresholds, not leaderboard percentiles.
// Earned victories exclude practice, forfeits and reward-restricted matches.
func SeasonPrize(rating, eligibleWins int) (medal string, honor int) {
	switch {
	case eligibleWins >= 50 && rating >= 1500:
		return "Gold", 1200
	case eligibleWins >= 25 && rating >= 1200:
		return "Silver", 600
	case eligibleWins >= 10:
		return "Bronze", 250
	default:
		return "Unqualified", 0
	}
}
