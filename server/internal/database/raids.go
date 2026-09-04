package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type WeeklyRaidLockout struct {
	PlayerID    string    `bson:"player_id" json:"playerId"`
	Week        string    `bson:"week" json:"week"`
	CompletedAt time.Time `bson:"completed_at" json:"completedAt"`
}

func CurrentRaidWeek(at time.Time) string {
	year, week := at.UTC().ISOWeek()
	return fmt.Sprintf("%d-W%02d", year, week)
}

// ClaimWeeklyRaidReward is the single idempotency gate for weekly rewards.
func (db *DB) ClaimWeeklyRaidReward(playerID string, at time.Time) (bool, error) {
	if db == nil || db.raidLockouts == nil || playerID == "" {
		return false, fmt.Errorf("raid lockout service unavailable")
	}
	lockout := WeeklyRaidLockout{PlayerID: playerID, Week: CurrentRaidWeek(at), CompletedAt: at.UTC()}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.raidLockouts.InsertOne(ctx, lockout)
	if mongo.IsDuplicateKeyError(err) {
		return false, nil
	}
	return err == nil, err
}

func (db *DB) HasWeeklyRaidReward(playerID string, at time.Time) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err := db.raidLockouts.FindOne(ctx, bson.M{"player_id": playerID, "week": CurrentRaidWeek(at)}).Err()
	if err == mongo.ErrNoDocuments {
		return false, nil
	}
	return err == nil, err
}
