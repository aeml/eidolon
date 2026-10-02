package database

import (
	"context"
	"encoding/json"
	"net/url"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Uses the existing short disposable report-review CI step, not production.
func TestReportReviewMongoAllThreeModerationNoticesAndIndependentReversals(t *testing.T) {
	uri := os.Getenv("EIDOLON_REPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Scheme != "mongodb" || parsed.Hostname() != "127.0.0.1" || parsed.Port() == "" || parsed.User != nil ||
		os.Getenv("EIDOLON_REPORT_DISPOSABLE_DATABASE") != "1" {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	db.users = db.users.Database().Collection(uniqueID("account-moderation-users"))
	db.reports = db.reports.Database().Collection(uniqueID("account-moderation-cases"))
	t.Cleanup(func() { _ = db.users.Drop(context.Background()); _ = db.reports.Drop(context.Background()) })
	account, base, _ := chatModerationFixture()
	ctx := context.Background()
	protected := bson.M{"_id": account, "username": "moderation-member", "email": "private@example.invalid", "password_hash": "private-hash",
		"characters": bson.A{bson.M{"name": "Immutable saved hero", "level": 45, "gold": 1000, "ep": 17}}, "friends": bson.A{"friend-account"}}
	if _, err := db.users.InsertMany(ctx, []interface{}{protected,
		bson.M{"username": "operator", "roles": bson.M{"admin": AccountRoleAssignment{GrantedAt: time.Now(), GrantedBy: "isolated-fixture", Source: "test"}}},
		bson.M{"username": "ordinary-account"}}); err != nil {
		t.Fatal(err)
	}
	caseID, _ := primitive.ObjectIDFromHex(base.ReportID)
	if _, err := db.reports.InsertOne(ctx, bson.M{"_id": caseID, "report_type": "Moderation Appeal", "status": "open"}); err != nil {
		t.Fatal(err)
	}
	var before bson.M
	if err := db.users.FindOne(ctx, bson.M{"_id": account}).Decode(&before); err != nil {
		t.Fatal(err)
	}
	requests := []ChatModerationRequest{}
	issued := []ChatModerationReceipt{}
	for i, kind := range []string{ChatModerationMute, ModerationSuspend, ModerationRequireNameChange} {
		request := base
		request.ID, request.Action, request.ExpectedRevision = "database-moderation-"+kind, kind, int64(i)
		if kind == ModerationRequireNameChange {
			request.DurationSeconds = 0
		}
		if _, err := db.ApplyChatModeration("ordinary-account", account, request); err == nil {
			t.Fatal("ordinary account applied restriction", kind)
		}
		receipt, err := db.ApplyChatModeration("operator", account, request)
		if err != nil {
			t.Fatal(kind, err)
		}
		retry, err := db.ApplyChatModeration("operator", account, request)
		if err != nil || !reflect.DeepEqual(retry, receipt) {
			t.Fatal("exact retry changed original decision", kind, err)
		}
		requests, issued = append(requests, request), append(issued, receipt)
	}
	notices, err := db.OwnModerationNotices("moderation-member")
	if err != nil || len(notices) != 3 {
		t.Fatal(notices, err)
	}
	if other, err := db.OwnModerationNotices("ordinary-account"); err != nil || len(other) != 0 {
		t.Fatal("other owner received notices", other, err)
	}
	preview, err := db.ReadChatModerationTarget("operator", "moderation-member")
	if err != nil || len(preview.Notices) != 3 || preview.Revision != 3 {
		t.Fatal(preview, err)
	}
	encoded, _ := json.Marshal(preview)
	for _, private := range []string{base.PrivateReason, base.ReportID, "private@example.invalid", "private-hash", "Immutable saved hero", "friend-account"} {
		if strings.Contains(string(encoded), private) {
			t.Fatal("staff preview leaked unrelated or private data", string(encoded))
		}
	}
	// A new database connection must read the same durable notices and receipts.
	restarted, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = restarted.Close(context.Background()) })
	restarted.users = restarted.users.Database().Collection(db.users.Name())
	restarted.reports = restarted.reports.Database().Collection(db.reports.Name())
	state, err := restarted.ReadAccountChatModeration(account)
	if err != nil || len(state.ActiveNotices(time.Now())) != 3 || len(state.Receipts) != 3 {
		t.Fatal(state, err)
	}
	for i, original := range issued {
		revoke := base
		revoke.ID, revoke.Action, revoke.ExpectedRevision = "database-reversal-"+requests[i].Action, ChatModerationRevoke, int64(3+i)
		revoke.NoticeID, revoke.DurationSeconds, revoke.PublicReason = original.Notice.ID, 0, ""
		if _, err := restarted.ApplyChatModeration("operator", account, revoke); err != nil {
			t.Fatal(err)
		}
		retry, err := restarted.ApplyChatModeration("operator", account, requests[i])
		if err != nil || !reflect.DeepEqual(retry, original) {
			t.Fatal("old replay lost original receipt", err)
		}
		owned, err := restarted.OwnModerationNotices("moderation-member")
		if err != nil || len(owned) != 2-i {
			t.Fatal("reversal erased another restriction or old retry reinstated one", owned, err)
		}
	}
	state, err = db.ReadAccountChatModeration(account)
	if err != nil || state.Revision != 6 || len(state.Receipts) != 6 {
		t.Fatal(state, err)
	}
	var after bson.M
	if err := db.users.FindOne(ctx, bson.M{"_id": account}).Decode(&after); err != nil {
		t.Fatal(err)
	}
	delete(after, "chat_moderation")
	if !reflect.DeepEqual(before, after) {
		t.Fatal("moderation altered login, saves, currency or social references", before, after)
	}
	var savedCase bson.M
	if err := db.reports.FindOne(ctx, bson.M{"_id": caseID}).Decode(&savedCase); err != nil || savedCase["status"] != "open" {
		t.Fatal("sanctions auto-resolved appeal", savedCase, err)
	}
}
