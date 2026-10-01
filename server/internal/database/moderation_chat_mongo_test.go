package database

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Shares the existing isolated report-review CI step, never production MONGO_URI.
func TestReportReviewMongoChatModerationAtomicRetryReversalAndRole(t *testing.T) {
	uri := os.Getenv("EIDOLON_REPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Scheme != "mongodb" || parsed.Hostname() != "127.0.0.1" || parsed.Port() == "" ||
		os.Getenv("EIDOLON_REPORT_DISPOSABLE_DATABASE") != "1" {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	db.users = db.users.Database().Collection(uniqueID("chat-moderation-users"))
	db.reports = db.reports.Database().Collection(uniqueID("chat-moderation-cases"))
	t.Cleanup(func() { _ = db.users.Drop(context.Background()); _ = db.reports.Drop(context.Background()) })
	account, request, _ := chatModerationFixture()
	ctx := context.Background()
	_, err = db.users.InsertMany(ctx, []interface{}{
		bson.M{"_id": account, "username": "disposable-target", "email": "private-fixture@example.invalid", "password_hash": "private-fixture-hash", "characters": bson.A{bson.M{"name": "Saved hero", "level": 45}}},
		bson.M{"_id": primitive.NewObjectID(), "username": "operator", "roles": bson.M{"admin": AccountRoleAssignment{GrantedAt: time.Now(), GrantedBy: "isolated-fixture", Source: "test"}}},
		bson.M{"_id": primitive.NewObjectID(), "username": "ordinary-account"},
	})
	if err != nil {
		t.Fatal(err)
	}
	caseID, _ := primitive.ObjectIDFromHex(request.ReportID)
	if _, err := db.reports.InsertOne(ctx, bson.M{"_id": caseID, "report_type": "Player Report", "status": "open"}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ApplyChatModeration("ordinary-account", account, request); err == nil {
		t.Fatal("ordinary account admitted")
	}
	missingCase := request
	missingCase.ReportID = primitive.NewObjectID().Hex()
	if _, err := db.ApplyChatModeration("operator", account, missingCase); err == nil {
		t.Fatal("missing case admitted")
	}
	state, err := db.ReadAccountChatModeration(account)
	if err != nil || state.Revision != 0 || state.Mute != nil {
		t.Fatal("rejected requests changed account", state, err)
	}
	if _, err := db.ApplyChatModeration("operator", primitive.NewObjectID(), request); err == nil {
		t.Fatal("missing target account was upserted")
	}
	// Concurrent identical requests must retain one timer and one receipt.
	var group sync.WaitGroup
	receipts := make(chan ChatModerationReceipt, 8)
	for range 8 {
		group.Add(1)
		go func() {
			defer group.Done()
			receipt, err := db.ApplyChatModeration("operator", account, request)
			if err != nil {
				t.Error(err)
				return
			}
			receipts <- receipt
		}()
	}
	group.Wait()
	close(receipts)
	var issued ChatModerationReceipt
	count := 0
	for receipt := range receipts {
		if count == 0 {
			issued = receipt
		} else if !reflect.DeepEqual(issued, receipt) {
			t.Fatal("retry extended expiry or duplicated receipt", issued, receipt)
		}
		count++
	}
	state, err = db.ReadAccountChatModeration(account)
	if err != nil || count != 8 || state.Revision != 1 || len(state.Receipts) != 1 || state.ActiveNotice(time.Now()) == nil {
		t.Fatal(count, state, err)
	}
	owned, err := db.OwnChatMuteNotice("disposable-target")
	if err != nil || owned == nil || owned.ID != issued.Notice.ID || owned.Reason != request.PublicReason {
		t.Fatal("owner lost public notice", owned, err)
	}
	other, err := db.OwnChatMuteNotice("ordinary-account")
	if err != nil || other != nil {
		t.Fatal("another account received the target notice", other, err)
	}
	if _, err := db.OwnChatMuteNotice("missing-account"); err == nil {
		t.Fatal("unknown owner reported as a clean account")
	}
	preview, err := db.ReadChatModerationTarget("operator", "disposable-target")
	if err != nil || preview.AccountID != account || preview.Revision != 1 || preview.Notice == nil || preview.Notice.ID != issued.Notice.ID {
		t.Fatal("projected target read lost authoritative state", preview, err)
	}
	encoded, _ := json.Marshal(preview)
	for _, private := range []string{"private-fixture@example.invalid", "private-fixture-hash", "Saved hero", request.PrivateReason, request.ReportID} {
		if strings.Contains(string(encoded), private) {
			t.Fatal("projected database read leaked private data", string(encoded))
		}
	}
	if _, err := db.ReadChatModerationTarget("ordinary-account", "disposable-target"); err == nil {
		t.Fatal("ordinary account read target state")
	}
	if _, err := db.ReadChatModerationTarget("operator", "missing-account"); err == nil {
		t.Fatal("missing account invented a target")
	}
	revoke := request
	revoke.ID, revoke.ExpectedRevision, revoke.Action = "chat-revoke-request-001", 1, ChatModerationRevoke
	revoke.NoticeID, revoke.DurationSeconds, revoke.PublicReason = issued.Notice.ID, 0, ""
	revoke.PrivateReason = "Appeal accepted after staff review."
	if _, err := db.ApplyChatModeration("operator", account, revoke); err != nil {
		t.Fatal(err)
	}
	state, err = db.ReadAccountChatModeration(account)
	if err != nil || state.Mute != nil || state.Revision != 2 || len(state.Receipts) != 2 {
		t.Fatal(state, err)
	}
	if own, err := db.OwnChatMuteNotice("disposable-target"); err != nil || own != nil {
		t.Fatal("reversal still visible as active", own, err)
	}
	if preview, err := db.ReadChatModerationTarget("operator", "disposable-target"); err != nil || preview.Revision != 2 || preview.Notice != nil {
		t.Fatal("target preview missed reversal", preview, err)
	}
	retry, err := db.ApplyChatModeration("operator", account, request)
	if err != nil || !reflect.DeepEqual(retry, issued) {
		t.Fatal("historical retry lost its original receipt", retry, err)
	}
	changed := request
	changed.DurationSeconds++
	if _, err := db.ApplyChatModeration("operator", account, changed); !errors.Is(err, ErrChatModerationConflict) {
		t.Fatal("request identity reused with different duration", err)
	}
	// Two new decisions quote the same account state. Exactly one can apply.
	outcomes := make(chan error, 2)
	for _, id := range []string{"chat-mute-request-000002", "chat-mute-request-000003"} {
		candidate := request
		candidate.ID, candidate.ExpectedRevision = id, 2
		group.Add(1)
		go func(candidate ChatModerationRequest) {
			defer group.Done()
			_, err := db.ApplyChatModeration("operator", account, candidate)
			outcomes <- err
		}(candidate)
	}
	group.Wait()
	close(outcomes)
	won, conflict := 0, 0
	for err := range outcomes {
		if err == nil {
			won++
		} else if errors.Is(err, ErrChatModerationConflict) {
			conflict++
		} else {
			t.Fatal(err)
		}
	}
	state, err = db.ReadAccountChatModeration(account)
	if err != nil || won != 1 || conflict != 1 || state.Revision != 3 || len(state.Receipts) != 3 {
		t.Fatal("competing staff decisions lost CAS", won, conflict, state, err)
	}
	// Renaming a displayed username cannot bypass an immutable account key.
	if _, err := db.users.UpdateOne(ctx, bson.M{"_id": account}, bson.M{"$set": bson.M{"username": "changed-display-name"}}); err != nil {
		t.Fatal(err)
	}
	renamed, err := db.ReadAccountChatModeration(account)
	if err != nil || !reflect.DeepEqual(renamed, state) {
		t.Fatal("account rename bypassed moderation", renamed, err)
	}
	if preview, err := db.ReadChatModerationTarget("operator", "changed-display-name"); err != nil || preview.AccountID != account || preview.Revision != 3 {
		t.Fatal("renamed target changed account identity", preview, err)
	}
	if _, err := db.ReadChatModerationTarget("operator", "disposable-target"); err == nil {
		t.Fatal("old display name still selected renamed account")
	}
	var target struct {
		Characters []struct {
			Name  string `bson:"name"`
			Level int    `bson:"level"`
		} `bson:"characters"`
	}
	if err := db.users.FindOne(ctx, bson.M{"_id": account}).Decode(&target); err != nil || len(target.Characters) != 1 || target.Characters[0].Level != 45 {
		t.Fatal("moderation overwrote character data", target, err)
	}
	// Durable role revocation also denies exact retries, rather than consulting a
	// previously admitted connection or returning a private historical receipt.
	if _, err := db.users.UpdateOne(ctx, bson.M{"username": "operator"}, bson.M{"$unset": bson.M{"roles.admin": ""}}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ApplyChatModeration("operator", account, request); err == nil {
		t.Fatal("revoked staff replayed private receipt")
	}
	if _, err := db.ReadChatModerationTarget("operator", "changed-display-name"); err == nil {
		t.Fatal("revoked staff read moderation target")
	}
	// A broken saved state is an explicit store error, not an invented clean
	// account response that a future enforcement handler could fail open on.
	if _, err := db.users.UpdateOne(ctx, bson.M{"_id": account}, bson.M{"$set": bson.M{"chat_moderation.revision": -1}}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ReadAccountChatModeration(account); err == nil {
		t.Fatal("broken saved state returned as a clean account")
	}
}
