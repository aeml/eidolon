package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type WeeklyRaidLockout struct {
	PlayerID        string    `bson:"player_id" json:"playerId"`
	Week            string    `bson:"week" json:"week"`
	CompletedAt     time.Time `bson:"completed_at" json:"completedAt"`
	DeliveryPending bool      `bson:"delivery_pending,omitempty" json:"deliveryPending,omitempty"`
	RetryAfter      time.Time `bson:"retry_after,omitempty" json:"-"`
}

func applyWeeklyRaidDeliveryIndexes(ctx context.Context, db *DB) error {
	if _, err := db.users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "characters.weekly_raid_completions", Value: 1}},
		Options: options.Index().SetName("weekly_completion_outbox").SetSparse(true),
	}); err != nil {
		return err
	}
	_, err := db.raidLockouts.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "delivery_pending", Value: 1}, {Key: "retry_after", Value: 1}, {Key: "completed_at", Value: 1}},
		Options: options.Index().SetName("weekly_delivery_pending"),
	})
	return err
}

// PrepareWeeklyRaidReward preserves earned entitlement before touching the
// character. Old lockouts without delivery_pending remain fulfilled.
func (db *DB) PrepareWeeklyRaidReward(playerID string, at time.Time) (*WeeklyRaidLockout, error) {
	if db == nil || db.raidLockouts == nil || playerID == "" {
		return nil, fmt.Errorf("raid reward service unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	entry := WeeklyRaidLockout{PlayerID: playerID, Week: CurrentRaidWeek(at), CompletedAt: at.UTC(), DeliveryPending: true}
	_, err := db.raidLockouts.InsertOne(ctx, entry)
	if err == nil {
		return &entry, nil
	}
	if !mongo.IsDuplicateKeyError(err) {
		return nil, err
	}
	// BSON omits false fields in legacy lockouts. Decode into a zero value,
	// not the attempted pending insert, or an absent flag stays true.
	week := entry.Week
	entry = WeeklyRaidLockout{}
	err = db.raidLockouts.FindOne(ctx, bson.M{"player_id": playerID, "week": week}).Decode(&entry)
	if err != nil {
		return nil, err
	}
	if !entry.DeliveryPending {
		return nil, nil
	}
	return &entry, nil
}

func (db *DB) PendingWeeklyRaidRewards() ([]WeeklyRaidLockout, error) {
	if db == nil || db.raidLockouts == nil {
		return nil, fmt.Errorf("raid reward service unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.raidLockouts.Find(ctx, bson.M{"delivery_pending": true,
		"$or": bson.A{bson.M{"retry_after": bson.M{"$exists": false}}, bson.M{"retry_after": bson.M{"$lte": time.Now().UTC()}}}},
		options.Find().SetLimit(50).SetSort(bson.D{{Key: "completed_at", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var entries []WeeklyRaidLockout
	err = cursor.All(ctx, &entries)
	return entries, err
}

// Keep the entitlement intact, but move a failed recipient out of the next
// bounded batch so it cannot permanently starve unrelated weekly rewards.
func (db *DB) DeferWeeklyRaidReward(playerID, week string, until time.Time) error {
	if db == nil || db.raidLockouts == nil {
		return fmt.Errorf("raid reward service unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.raidLockouts.UpdateOne(ctx, bson.M{"player_id": playerID, "week": week, "delivery_pending": true},
		bson.M{"$set": bson.M{"retry_after": until.UTC()}})
	return err
}

func (db *DB) FinishWeeklyRaidReward(playerID, week string) error {
	if db == nil || db.raidLockouts == nil || playerID == "" || week == "" {
		return fmt.Errorf("raid reward service unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := db.raidLockouts.UpdateOne(ctx, bson.M{"player_id": playerID, "week": week}, bson.M{"$set": bson.M{"delivery_pending": false}})
	if err != nil {
		return err
	}
	if result.MatchedCount != 1 {
		return fmt.Errorf("weekly entitlement not found")
	}
	return nil
}

func CurrentRaidWeek(at time.Time) string {
	year, week := at.UTC().ISOWeek()
	return fmt.Sprintf("%d-W%02d", year, week)
}

// Character snapshots are the durable outbox before an entitlement can reach
// the lockout collection. Only return minimal completion data, not full saves.
func (db *DB) UnpreparedWeeklyRaidRewards() ([]WeeklyRaidLockout, error) {
	if db == nil || db.users == nil {
		return nil, fmt.Errorf("weekly completion store unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.users.Find(ctx, bson.M{"characters.weekly_raid_completions": bson.M{"$exists": true, "$ne": bson.M{}}},
		options.Find().SetLimit(50).SetProjection(bson.M{"username": 1, "characters.name": 1, "characters.weekly_raid_completions": 1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var result []WeeklyRaidLockout
	for cursor.Next(ctx) {
		var user User
		if err := cursor.Decode(&user); err != nil {
			return nil, err
		}
		for _, character := range user.Characters {
			if character.Name != user.Username {
				continue
			}
			for week, at := range character.WeeklyRaidCompletions {
				if at.IsZero() || CurrentRaidWeek(at) != week {
					return nil, fmt.Errorf("invalid saved weekly completion")
				}
				result = append(result, WeeklyRaidLockout{PlayerID: "player-" + user.Username, Week: week, CompletedAt: at, DeliveryPending: true})
			}
		}
	}
	return result, cursor.Err()
}

// ClaimWeeklyRaidReward retains the legacy already-delivered lockout format.
// New runtime completions use PrepareWeeklyRaidReward and durable delivery.
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
	if db == nil || db.raidLockouts == nil || playerID == "" {
		return false, fmt.Errorf("raid lockout service unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err := db.raidLockouts.FindOne(ctx, bson.M{"player_id": playerID, "week": CurrentRaidWeek(at)}).Err()
	if err == mongo.ErrNoDocuments {
		return false, nil
	}
	return err == nil, err
}

func NextRaidWeekReset(at time.Time) time.Time {
	utc := at.UTC()
	days := (int(time.Monday) - int(utc.Weekday()) + 7) % 7
	if days == 0 {
		days = 7
	}
	return time.Date(utc.Year(), utc.Month(), utc.Day()+days, 0, 0, 0, 0, time.UTC)
}
