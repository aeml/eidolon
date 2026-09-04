package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type PvPProfile struct {
	PlayerID     string    `bson:"player_id" json:"playerId"`
	Rating       int       `bson:"rating" json:"rating"`
	Wins         int       `bson:"wins" json:"wins"`
	Losses       int       `bson:"losses" json:"losses"`
	Honor        int       `bson:"honor" json:"honor"`
	SeasonPoints int       `bson:"season_points" json:"seasonPoints"`
	Season       string    `bson:"season" json:"season"`
	UpdatedAt    time.Time `bson:"updated_at" json:"updatedAt"`
}

func CurrentArenaSeason(at time.Time) string {
	quarter := (int(at.UTC().Month())-1)/3 + 1
	return fmt.Sprintf("%d-Q%d", at.UTC().Year(), quarter)
}

func (db *DB) GetPvPProfile(playerID string) (*PvPProfile, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var profile PvPProfile
	err := db.pvpProfiles.FindOne(ctx, bson.M{"player_id": playerID}).Decode(&profile)
	if err == mongo.ErrNoDocuments {
		return &PvPProfile{PlayerID: playerID, Rating: 1000, Season: CurrentArenaSeason(time.Now()), UpdatedAt: time.Now().UTC()}, nil
	}
	if err == nil && profile.Season != CurrentArenaSeason(time.Now()) {
		// Seasonal ladders reset competitive results when the quarter changes.
		return &PvPProfile{PlayerID: playerID, Rating: 1000, Season: CurrentArenaSeason(time.Now()), UpdatedAt: time.Now().UTC()}, nil
	}
	return &profile, err
}

func (db *DB) SavePvPProfile(profile PvPProfile) error {
	if profile.PlayerID == "" {
		return fmt.Errorf("player ID is required")
	}
	if profile.Rating < 0 {
		profile.Rating = 1000
	}
	profile.Season = CurrentArenaSeason(time.Now())
	profile.UpdatedAt = time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.pvpProfiles.ReplaceOne(ctx, bson.M{"player_id": profile.PlayerID}, profile, options.Replace().SetUpsert(true))
	return err
}

func (db *DB) PvPLeaderboard(limit int) ([]PvPProfile, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.pvpProfiles.Find(ctx, bson.M{"season": CurrentArenaSeason(time.Now())}, options.Find().SetSort(bson.D{{Key: "rating", Value: -1}, {Key: "wins", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var profiles []PvPProfile
	if err := cursor.All(ctx, &profiles); err != nil {
		return nil, err
	}
	return profiles, nil
}
