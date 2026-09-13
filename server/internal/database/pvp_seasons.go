package database

import (
	"context"
	"errors"
	"fmt"
	"time"

	"eidolon-server/internal/arena"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// Settle lazily when a player next opens/joins the arena. History, the Honor
// award, and the new ladder are one atomic profile write. Concurrent readers
// compute the same revision and reread the winner; they never add Honor twice.
func (db *DB) getPvPProfileAt(playerID string, now time.Time) (*PvPProfile, error) {
	if db == nil || db.pvpProfiles == nil || playerID == "" {
		return nil, fmt.Errorf("arena profile service unavailable")
	}
	season := CurrentArenaSeason(now)
	for attempt := 0; attempt < 5; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		var profile PvPProfile
		err := db.pvpProfiles.FindOne(ctx, bson.M{"player_id": playerID}).Decode(&profile)
		cancel()
		if err == mongo.ErrNoDocuments {
			return &PvPProfile{PlayerID: playerID, Rating: 1000, Season: season, UpdatedAt: now.UTC()}, nil
		}
		if err != nil {
			return nil, err
		}
		if profile.Season == season {
			return &profile, nil
		}
		if profile.Season > season {
			return nil, fmt.Errorf("arena season is ahead of server time")
		}
		if profile.Season != "" {
			medal, honor := arena.SeasonPrize(profile.Rating, profile.SeasonVictories)
			archived := false
			for _, record := range profile.SeasonHistory {
				if record.Season == profile.Season {
					archived = true
				}
			}
			if !archived {
				profile.SeasonHistory = append(profile.SeasonHistory, arena.SeasonRecord{Season: profile.Season,
					Rating: profile.Rating, Wins: profile.Wins, Losses: profile.Losses, EligibleWins: profile.SeasonVictories,
					Medal: medal, HonorAwarded: honor, SettledAt: now.UTC().Unix()})
				profile.Honor += honor
			}
		}
		profile.Season, profile.Rating = season, 1000
		profile.Wins, profile.Losses, profile.SeasonPoints, profile.SeasonVictories = 0, 0, 0, 0
		profile.Revision++
		profile.LastMatchID = "season-rollover:" + season + ":" + playerID
		profile.UpdatedAt = now.UTC()
		if err := db.SavePvPProfile(profile); err != nil {
			if errors.Is(err, ErrPvPRevisionConflict) {
				continue // Another settlement's timestamp or newer result won.
			}
			return nil, err
		}
		// Save may have safely ignored this snapshot because a newer revision
		// already won. Return the current persisted profile, never our proposal.
	}
	return nil, fmt.Errorf("arena profile changed repeatedly; retry shortly")
}
