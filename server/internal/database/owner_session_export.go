package database

import (
	"context"
	"encoding/json"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const ownerSessionPageSize = 10
const ownerSessionSourceBytes = 2048

type ownerSessionEntry struct {
	ID               primitive.ObjectID `bson:"_id" json:"id"`
	Actor            string             `bson:"actor" json:"-"`
	At               time.Time          `bson:"at" json:"at"`
	ExpiresAt        time.Time          `bson:"expires_at" json:"-"`
	Action           string             `bson:"action" json:"action"`
	Result           string             `bson:"result" json:"result"`
	SessionStartedAt *time.Time         `bson:"session_started_at,omitempty" json:"session_started_at,omitempty"`
}

type ownerSessionSnapshot struct {
	Format        string              `json:"format"`
	Version       int                 `json:"version"`
	GeneratedAt   time.Time           `json:"generated_at"`
	Coverage      ownerExportCoverage `json:"coverage"`
	RetentionDays int                 `json:"retention_days"`
	Cutoff        time.Time           `json:"activity_cutoff_at_read"`
	Entries       []ownerSessionEntry `json:"entries"`
	Next          string              `json:"next,omitempty"`
}

func ownerSessionPagePipeline(owner, before string, at time.Time, retentionDays int) mongo.Pipeline {
	filter := bson.M{"actor": AdminActivityAccountKey(owner), "action": bson.M{"$in": bson.A{"login", "resume", "disconnect"}}, "target": bson.M{"$in": bson.A{"", nil}}, "expires_at": bson.M{"$gt": at}, "at": bson.M{"$gt": at.Add(-time.Duration(retentionDays) * 24 * time.Hour), "$lte": at}}
	if before != "" {
		id, _ := primitive.ObjectIDFromHex(before)
		filter["_id"] = bson.M{"$lt": id}
	}
	within := bson.M{"$lte": bson.A{bson.M{"$bsonSize": "$$ROOT"}, ownerSessionSourceBytes}}
	return mongo.Pipeline{
		bson.D{{Key: "$match", Value: filter}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "_id", Value: -1}}}},
		bson.D{{Key: "$limit", Value: ownerSessionPageSize + 1}},
		bson.D{{Key: "$project", Value: bson.M{"_id": 1, "actor": 1, "at": 1, "expires_at": 1, "action": 1, "result": 1, "session_started_at": 1}}},
		bson.D{{Key: "$project", Value: bson.M{"_id": 0, "within_bound": within, "entry": bson.M{"$cond": bson.A{within, "$$ROOT", nil}}}}},
	}
}

func (db *DB) readOwnerSessionPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	if db.adminActivity == nil || db.adminActivityRetentionDays < 7 || db.adminActivityRetentionDays > 365 {
		return nil, errOwnerExportSection
	}
	cutoff := at.Add(-time.Duration(db.adminActivityRetentionDays) * 24 * time.Hour)
	cursor, err := db.adminActivity.Aggregate(ctx, ownerSessionPagePipeline(owner, before, at, db.adminActivityRetentionDays), options.Aggregate().SetMaxTime(3*time.Second).SetBatchSize(ownerSessionPageSize+1))
	if err != nil {
		return nil, errOwnerExportSection
	}
	defer cursor.Close(ctx)
	entries := make([]ownerSessionEntry, 0, ownerSessionPageSize+1)
	for cursor.Next(ctx) {
		var source struct {
			Within bool               `bson:"within_bound"`
			Entry  *ownerSessionEntry `bson:"entry"`
		}
		if len(entries) >= ownerSessionPageSize+1 || cursor.Decode(&source) != nil || !source.Within || source.Entry == nil {
			return nil, errOwnerExportSection
		}
		entry := *source.Entry
		if entry.ID.IsZero() || entry.Actor != AdminActivityAccountKey(owner) || !entry.At.After(cutoff) || entry.At.After(at) || !entry.ExpiresAt.After(at) ||
			(entry.Action != "login" && entry.Action != "resume" && entry.Action != "disconnect") || (entry.Result != "success" && entry.Result != "denied" && entry.Result != "error") ||
			(entry.SessionStartedAt != nil && (entry.Action != "disconnect" || entry.SessionStartedAt.IsZero() || entry.SessionStartedAt.After(entry.At))) ||
			(before != "" && entry.ID.Hex() >= before) || (len(entries) > 0 && entry.ID.Hex() >= entries[len(entries)-1].ID.Hex()) {
			return nil, errOwnerExportSection
		}
		entry.At = entry.At.UTC()
		if entry.SessionStartedAt != nil {
			start := entry.SessionStartedAt.UTC()
			entry.SessionStartedAt = &start
		}
		entries = append(entries, entry)
	}
	if cursor.Err() != nil || ctx.Err() != nil {
		return nil, errOwnerExportSection
	}
	page := ownerSessionSnapshot{Format: "eidolon-owner-session-history", Version: 1, GeneratedAt: at.UTC(), Coverage: ownerSectionCoverage("sessions"), RetentionDays: db.adminActivityRetentionDays, Cutoff: cutoff.UTC(), Entries: entries}
	if len(entries) > ownerSessionPageSize {
		page.Entries = entries[:ownerSessionPageSize]
		page.Next = page.Entries[len(page.Entries)-1].ID.Hex()
	}
	data, err := json.Marshal(page)
	if err != nil || len(data) > maxBytes {
		return nil, errOwnerExportSection
	}
	return data, nil
}
