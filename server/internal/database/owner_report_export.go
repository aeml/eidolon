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

const ownerReportPageSize = 10
const ownerReportSourceBytes = 16 << 10

func validOwnerExportQuery(query OwnerExportQuery) bool {
	switch query.Section {
	case "profile":
		return query.CharacterName == "" && query.Before == ""
	case "progress":
		return query.CharacterName != "" && len(query.CharacterName) <= 128 && query.Before == ""
	case "reports", "sessions":
		if query.CharacterName != "" {
			return false
		}
		if query.Before == "" {
			return true
		}
		id, err := primitive.ObjectIDFromHex(query.Before)
		return err == nil && !id.IsZero() && id.Hex() == query.Before
	default:
		return false
	}
}

// Explicit owner-authored fields only. A report's private staff review,
// permission reasons and receipt maps are never decoded or exported.
type ownerReportEntry struct {
	ID         primitive.ObjectID `bson:"_id" json:"id"`
	Username   string             `bson:"username" json:"-"`
	ReportType string             `bson:"report_type" json:"report_type"`
	Text       string             `bson:"text" json:"submitted_text"`
	Status     string             `bson:"status" json:"status"`
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
	ResolvedAt *time.Time         `bson:"resolved_at,omitempty" json:"resolved_at,omitempty"`
}

type ownerReportSnapshot struct {
	Format      string              `json:"format"`
	Version     int                 `json:"version"`
	GeneratedAt time.Time           `json:"generated_at"`
	Coverage    ownerExportCoverage `json:"coverage"`
	Reports     []ownerReportEntry  `json:"reports"`
	Next        string              `json:"next,omitempty"`
}

func ownerReportPagePipeline(owner, before string) mongo.Pipeline {
	filter := bson.M{"username": owner}
	if before != "" {
		id, _ := primitive.ObjectIDFromHex(before)
		filter["_id"] = bson.M{"$lt": id}
	}
	within := bson.M{"$lte": bson.A{bson.M{"$bsonSize": "$$ROOT"}, ownerReportSourceBytes}}
	return mongo.Pipeline{
		bson.D{{Key: "$match", Value: filter}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "_id", Value: -1}}}},
		bson.D{{Key: "$limit", Value: ownerReportPageSize + 1}},
		bson.D{{Key: "$project", Value: bson.M{"_id": 1, "username": 1, "report_type": 1, "text": 1, "status": 1, "created_at": 1, "resolved_at": 1}}},
		// Do not filter out oversized rows: that would silently omit an owner's
		// submission. Emit a bounded sentinel and fail the entire page instead.
		bson.D{{Key: "$project", Value: bson.M{"_id": 0, "within_bound": within, "entry": bson.M{"$cond": bson.A{within, "$$ROOT", nil}}}}},
	}
}

func (db *DB) readOwnerReportPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	if db.reports == nil {
		return nil, errOwnerExportSection
	}
	cursor, err := db.reports.Aggregate(ctx, ownerReportPagePipeline(owner, before), options.Aggregate().SetMaxTime(3*time.Second).SetBatchSize(ownerReportPageSize+1))
	if err != nil {
		return nil, errOwnerExportSection
	}
	defer cursor.Close(ctx)
	entries := make([]ownerReportEntry, 0, ownerReportPageSize+1)
	for cursor.Next(ctx) {
		var source struct {
			Within bool              `bson:"within_bound"`
			Entry  *ownerReportEntry `bson:"entry"`
		}
		if len(entries) >= ownerReportPageSize+1 || cursor.Decode(&source) != nil || !source.Within || source.Entry == nil {
			return nil, errOwnerExportSection
		}
		entry := *source.Entry
		if entry.Username != owner || entry.ID.IsZero() || entry.CreatedAt.IsZero() || !SupportedReportType(entry.ReportType) || (entry.Status != ReportStatusOpen && entry.Status != ReportStatusResolved) || len(entry.Text) > ownerReportSourceBytes {
			return nil, errOwnerExportSection
		}
		if (before != "" && entry.ID.Hex() >= before) || (len(entries) > 0 && entry.ID.Hex() >= entries[len(entries)-1].ID.Hex()) {
			return nil, errOwnerExportSection
		}
		entries = append(entries, entry)
	}
	if cursor.Err() != nil || ctx.Err() != nil {
		return nil, errOwnerExportSection
	}
	page := ownerReportSnapshot{Format: "eidolon-owner-report-submissions", Version: 1, GeneratedAt: at.UTC(), Coverage: ownerSectionCoverage("reports"), Reports: entries}
	if len(entries) > ownerReportPageSize {
		page.Reports = entries[:ownerReportPageSize]
		page.Next = page.Reports[len(page.Reports)-1].ID.Hex()
	}
	encoded, err := json.Marshal(page)
	if err != nil || len(encoded) > maxBytes {
		return nil, errOwnerExportSection
	}
	return encoded, nil
}
