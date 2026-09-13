package database

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"time"

	"eidolon-server/internal/arena"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var ErrPvPRevisionConflict = errors.New("conflicting arena revision")

type PvPProfile struct {
	SeasonVictories int                  `bson:"season_victories" json:"seasonVictories"`
	SeasonHistory   []arena.SeasonRecord `bson:"season_history,omitempty" json:"seasonHistory,omitempty"`
	LastResult      arena.ResultSummary  `bson:"last_result" json:"lastResult"`
	RewardState     arena.RewardState    `bson:"reward_state" json:"rewardState"`
	Revision        int64                `bson:"revision" json:"revision"`
	LastMatchID     string               `bson:"last_match_id" json:"lastMatchId"`
	PlayerID        string               `bson:"player_id" json:"playerId"`
	Rating          int                  `bson:"rating" json:"rating"`
	Wins            int                  `bson:"wins" json:"wins"`
	Losses          int                  `bson:"losses" json:"losses"`
	Honor           int                  `bson:"honor" json:"honor"`
	SeasonPoints    int                  `bson:"season_points" json:"seasonPoints"`
	Season          string               `bson:"season" json:"season"`
	UpdatedAt       time.Time            `bson:"updated_at" json:"updatedAt"`
}

func CurrentArenaSeason(at time.Time) string {
	return arena.CurrentSeason(at)
}

func (db *DB) GetPvPProfile(playerID string) (*PvPProfile, error) {
	return db.getPvPProfileAt(playerID, time.Now())
}

func (db *DB) SavePvPProfile(profile PvPProfile) error {
	if db == nil || db.pvpProfiles == nil {
		return fmt.Errorf("arena profile service unavailable")
	}
	if profile.PlayerID == "" || profile.Revision <= 0 || profile.LastMatchID == "" || profile.UpdatedAt.IsZero() {
		return fmt.Errorf("player ID, match ID and positive arena revision are required")
	}
	if profile.Rating < 0 {
		profile.Rating = 1000
	}
	if profile.Season == "" {
		profile.Season = CurrentArenaSeason(profile.UpdatedAt)
	}
	profile.UpdatedAt = profile.UpdatedAt.UTC().Truncate(time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// The unique player_id index turns a stale conditional upsert into a
	// duplicate-key result. Never fall back to an unconditional replacement.
	filter := bson.M{"player_id": profile.PlayerID, "$or": bson.A{
		bson.M{"revision": bson.M{"$lt": profile.Revision}}, bson.M{"revision": bson.M{"$exists": false}},
	}}
	_, err := db.pvpProfiles.UpdateOne(ctx, filter, bson.M{"$set": profile}, options.Update().SetUpsert(true))
	if err == nil {
		return nil
	}
	if !mongo.IsDuplicateKeyError(err) {
		return err
	}
	var current PvPProfile
	if err := db.pvpProfiles.FindOne(ctx, bson.M{"player_id": profile.PlayerID}).Decode(&current); err != nil {
		return err
	}
	if current.Revision > profile.Revision {
		return nil
	}
	if current.Revision == profile.Revision && current.LastMatchID == profile.LastMatchID &&
		current.Rating == profile.Rating && current.Wins == profile.Wins && current.Losses == profile.Losses &&
		current.Honor == profile.Honor && current.SeasonPoints == profile.SeasonPoints && current.Season == profile.Season &&
		current.LastResult == profile.LastResult && reflect.DeepEqual(current.RewardState, profile.RewardState) {
		if current.SeasonVictories != profile.SeasonVictories || !reflect.DeepEqual(current.SeasonHistory, profile.SeasonHistory) {
			return fmt.Errorf("%w: season at %d", ErrPvPRevisionConflict, profile.Revision)
		}
		return nil
	}
	return fmt.Errorf("%w: result at %d", ErrPvPRevisionConflict, profile.Revision)
}

func (db *DB) PvPLeaderboard(limit int) ([]PvPProfile, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.pvpProfiles.Find(ctx, bson.M{"season": CurrentArenaSeason(time.Now())}, options.Find().SetProjection(bson.M{"reward_state": 0}).SetSort(bson.D{{Key: "rating", Value: -1}, {Key: "wins", Value: -1}}).SetLimit(int64(limit)))
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
