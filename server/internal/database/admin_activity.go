package database

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"
	"unicode"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const AdminActivityPageSize = 50

// Activity is structured and allowlisted; it never contains raw logs, sockets,
// authentication payloads, full character snapshots or database errors.
type AdminActivity struct {
	ID        primitive.ObjectID `bson:"_id" json:"id"`
	At        time.Time          `bson:"at" json:"at"`
	ExpiresAt time.Time          `bson:"expires_at" json:"-"`
	Actor     string             `bson:"actor" json:"actor"`
	Target    string             `bson:"target" json:"target"`
	Action    string             `bson:"action" json:"action"`
	RequestID string             `bson:"request_id" json:"requestId"`
	Result    string             `bson:"result" json:"result"`
	Summary   string             `bson:"summary" json:"summary"`
}

type AdminActivityQuery struct {
	Before string `json:"before"`
	Actor  string `json:"actor"`
	Action string `json:"action"`
}

type AdminActivityPage struct {
	Entries       []AdminActivity `json:"entries"`
	Next          string          `json:"next"`
	RetentionDays int             `json:"retentionDays"`
}

func ParseAdminActivityRetention(raw string) (int, error) {
	if raw == "" {
		return 90, nil
	}
	days, err := strconv.Atoi(raw)
	if err != nil || days < 7 || days > 365 {
		return 0, errors.New("EIDOLON_ADMIN_AUDIT_RETENTION_DAYS must be a whole number from 7 to 365")
	}
	return days, nil
}

func boundedActivityText(value string, max int, required bool) bool {
	if (required && value == "") || len(value) > max || !utf8.ValidString(value) {
		return false
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}

func validAdminActivityAction(action string) bool {
	switch action {
	case "login", "resume", "disconnect", "admin_status", "admin_players", "admin_history",
		"admin_grant_gold", "admin_grant_item", "admin_teleport":
		return true
	}
	return false
}

func ValidateAdminActivity(event AdminActivity) error {
	if event.ID.IsZero() || event.At.IsZero() || !event.ExpiresAt.After(event.At) ||
		!boundedActivityText(event.Actor, 64, true) || !boundedActivityText(event.Target, 64, false) ||
		!boundedActivityText(event.RequestID, 64, true) || !boundedActivityText(event.Summary, 256, true) ||
		!validAdminActivityAction(event.Action) {
		return errors.New("invalid administration activity")
	}
	switch event.Result {
	case "success", "denied", "error":
		return nil
	}
	return errors.New("invalid activity result")
}

func NewAdminActivity(actor, target, action, requestID, result, summary string, now time.Time, retentionDays int) (AdminActivity, error) {
	if retentionDays < 7 || retentionDays > 365 {
		return AdminActivity{}, errors.New("invalid activity retention")
	}
	// BSON dates have millisecond precision. Normalize before journal/replay
	// comparison and keyset cursor creation.
	now = now.UTC().Truncate(time.Millisecond)
	event := AdminActivity{ID: primitive.NewObjectID(), At: now,
		ExpiresAt: now.Add(time.Duration(retentionDays) * 24 * time.Hour), Actor: actor,
		Target: target, Action: action, RequestID: requestID, Result: result, Summary: summary}
	return event, ValidateAdminActivity(event)
}

// Insert-only. A recovered operation may replay the exact same event ID, but
// it may never replace an existing event with different content.
func (db *DB) AppendAdminActivity(event AdminActivity) error {
	if err := ValidateAdminActivity(event); err != nil {
		return err
	}
	if db == nil || db.adminActivity == nil {
		return errors.New("activity store unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.adminActivity.InsertOne(ctx, event)
	if !mongo.IsDuplicateKeyError(err) {
		return err
	}
	var existing AdminActivity
	if err := db.adminActivity.FindOne(ctx, bson.M{"_id": event.ID}).Decode(&existing); err != nil {
		return err
	}
	if existing.ID != event.ID || !existing.At.Equal(event.At) || !existing.ExpiresAt.Equal(event.ExpiresAt) ||
		existing.Actor != event.Actor || existing.Target != event.Target || existing.Action != event.Action ||
		existing.RequestID != event.RequestID || existing.Result != event.Result || existing.Summary != event.Summary {
		return errors.New("activity ID conflicts with immutable record")
	}
	return nil
}

type adminActivityCursor struct {
	Millis int64  `json:"at"`
	ID     string `json:"id"`
}

func activityCursor(event AdminActivity) string {
	data, _ := json.Marshal(adminActivityCursor{Millis: event.At.UnixMilli(), ID: event.ID.Hex()})
	return base64.RawURLEncoding.EncodeToString(data)
}

func adminActivityFilter(query AdminActivityQuery, now time.Time, retentionDays int) (bson.M, error) {
	if !boundedActivityText(query.Actor, 64, false) || (query.Action != "" && !validAdminActivityAction(query.Action)) || len(query.Before) > 160 {
		return nil, errors.New("invalid activity filter")
	}
	filter := bson.M{"expires_at": bson.M{"$gt": now}, "at": bson.M{"$gt": now.Add(-time.Duration(retentionDays) * 24 * time.Hour)}}
	if query.Actor != "" {
		filter["actor"] = query.Actor
	}
	if query.Action != "" {
		filter["action"] = query.Action
	}
	if query.Before != "" {
		data, err := base64.RawURLEncoding.DecodeString(query.Before)
		var cursor adminActivityCursor
		if err != nil || json.Unmarshal(data, &cursor) != nil || cursor.Millis <= 0 {
			return nil, errors.New("invalid activity cursor")
		}
		id, err := primitive.ObjectIDFromHex(cursor.ID)
		if err != nil {
			return nil, errors.New("invalid activity cursor")
		}
		at := time.UnixMilli(cursor.Millis)
		filter["$or"] = bson.A{bson.M{"at": bson.M{"$lt": at}}, bson.M{"at": at, "_id": bson.M{"$lt": id}}}
	}
	return filter, nil
}

func (db *DB) AdminActivityRetentionDays() int { return db.adminActivityRetentionDays }

func (db *DB) ReadAdminActivity(query AdminActivityQuery) (AdminActivityPage, error) {
	page := AdminActivityPage{Entries: []AdminActivity{}}
	if db == nil || db.adminActivity == nil {
		return page, errors.New("activity store unavailable")
	}
	page.RetentionDays = db.adminActivityRetentionDays
	filter, err := adminActivityFilter(query, time.Now().UTC(), page.RetentionDays)
	if err != nil {
		return page, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.adminActivity.Find(ctx, filter, options.Find().SetLimit(AdminActivityPageSize+1).
		SetSort(bson.D{{Key: "at", Value: -1}, {Key: "_id", Value: -1}}).SetMaxTime(3*time.Second))
	if err != nil {
		return page, err
	}
	defer cursor.Close(ctx)
	if err := cursor.All(ctx, &page.Entries); err != nil {
		return page, err
	}
	if len(page.Entries) > AdminActivityPageSize {
		page.Entries = page.Entries[:AdminActivityPageSize]
		page.Next = activityCursor(page.Entries[len(page.Entries)-1])
	}
	return page, nil
}

func applyAdminActivityIndexes(ctx context.Context, db *DB) error {
	models := []mongo.IndexModel{
		{Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetName("admin_activity_expiry").SetExpireAfterSeconds(0)},
	}
	for _, prefix := range []string{"", "actor", "action"} {
		keys := bson.D{}
		if prefix != "" {
			keys = append(keys, bson.E{Key: prefix, Value: 1})
		}
		keys = append(keys, bson.E{Key: "at", Value: -1}, bson.E{Key: "_id", Value: -1})
		models = append(models, mongo.IndexModel{Keys: keys, Options: options.Index().SetName(fmt.Sprintf("admin_activity_%s_time_id", prefix))})
	}
	_, err := db.adminActivity.Indexes().CreateMany(ctx, models)
	return err
}
