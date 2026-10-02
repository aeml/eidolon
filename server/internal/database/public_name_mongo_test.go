package database

import (
	"context"
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

func TestReportReviewMongoPublicNameCorrectionPreservesAccountAndIndependentRestrictions(t *testing.T) {
	uri := os.Getenv("EIDOLON_REPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Scheme != "mongodb" || parsed.Hostname() != "127.0.0.1" || parsed.Port() == "" || parsed.User != nil || os.Getenv("EIDOLON_REPORT_DISPOSABLE_DATABASE") != "1" {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	db.users = db.users.Database().Collection(uniqueID("name-correction-users"))
	db.reports = db.reports.Database().Collection(uniqueID("name-correction-cases"))
	t.Cleanup(func() { _ = db.users.Drop(context.Background()); _ = db.reports.Drop(context.Background()) })
	ctx := context.Background()
	if err := applyPublicNameIndex(ctx, db); err != nil {
		t.Fatal(err)
	}
	owner := "name-owner"
	if err := db.CreateUser(owner, "private@example.invalid", "isolated-name-password"); err != nil {
		t.Fatal(err)
	}
	_, err = db.users.InsertMany(ctx, []interface{}{
		bson.M{"username": "operator", "roles": bson.M{"admin": AccountRoleAssignment{GrantedAt: time.Now(), GrantedBy: "isolated-fixture", Source: "test"}}},
		bson.M{"username": "LegacyOwner"}, bson.M{"username": "another-owner"}})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.CreateCharacter(owner, &Character{Name: owner, Class: "Wizard", Level: 45, Gold: 1000, EP: 17}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.users.UpdateOne(ctx, bson.M{"username": owner}, bson.M{"$set": bson.M{"friends": bson.A{"player-known-friend"}}}); err != nil {
		t.Fatal(err)
	}
	preview, err := db.ReadChatModerationTarget("operator", owner)
	if err != nil {
		t.Fatal(err)
	}
	account := preview.AccountID
	_, base, _ := chatModerationFixture()
	caseID, _ := primitive.ObjectIDFromHex(base.ReportID)
	if _, err := db.reports.InsertOne(ctx, bson.M{"_id": caseID, "report_type": "Player Report", "status": "open"}); err != nil {
		t.Fatal(err)
	}
	for i, kind := range []string{ChatModerationMute, ModerationSuspend, ModerationRequireNameChange} {
		change := base
		change.Action, change.ID, change.ExpectedRevision = kind, "mongo-name-"+kind+"-0001", int64(i)
		if kind == ModerationRequireNameChange {
			change.DurationSeconds = 0
		}
		if _, err := db.ApplyChatModeration("operator", account, change); err != nil {
			t.Fatal(err)
		}
	}
	state, err := db.ReadAccountChatModeration(account)
	if err != nil {
		t.Fatal(err)
	}
	request := PublicNameCorrectionRequest{ID: "mongo-correction-0001", NoticeID: state.NameChange.ID, PublicName: "Arcanis Dawn", Confirmed: true}
	var before bson.M
	if err := db.users.FindOne(ctx, bson.M{"_id": account}).Decode(&before); err != nil {
		t.Fatal(err)
	}
	if _, err := db.CorrectPublicName("another-owner", request); err == nil {
		t.Fatal("other owner corrected target")
	}
	for _, name := range []string{"NAME-OWNER", "legacyowner"} {
		bad := request
		bad.PublicName = name
		if _, err := db.CorrectPublicName(owner, bad); !errors.Is(err, ErrPublicNameUnavailable) {
			t.Fatal("unchanged or legacy reserved name accepted", name, err)
		}
	}
	var wg sync.WaitGroup
	receipts := make(chan ChatModerationReceipt, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			receipt, err := db.CorrectPublicName(owner, request)
			if err != nil {
				t.Error(err)
				return
			}
			receipts <- receipt
		}()
	}
	wg.Wait()
	close(receipts)
	var original ChatModerationReceipt
	count := 0
	for receipt := range receipts {
		if count == 0 {
			original = receipt
		} else if !reflect.DeepEqual(original, receipt) {
			t.Fatal("nonidentical correction retries")
		}
		count++
	}
	if count != 8 {
		t.Fatal("lost retry acknowledgements", count)
	}
	if name, err := db.OwnPublicName(owner); err != nil || name != request.PublicName {
		t.Fatal(name, err)
	}
	if name, err := db.OwnPublicName("LegacyOwner"); err != nil || name != "LegacyOwner" {
		t.Fatal("legacy label not preserved", name, err)
	}
	labels, err := db.PublicPlayerNames([]string{owner, "LegacyOwner", "missing-owner", owner})
	if err != nil || len(labels) != 3 || labels[owner] != "Arcanis Dawn" || labels["LegacyOwner"] != "LegacyOwner" || labels["missing-owner"] != "Adventurer" {
		t.Fatal("bounded public projection changed identities or lost labels", labels, err)
	}
	if labels, err := db.PublicPlayerNames(nil); err != nil || len(labels) != 0 {
		t.Fatal("empty label projection failed", labels, err)
	}
	if _, err := db.PublicPlayerNames(make([]string, 257)); err == nil {
		t.Fatal("unbounded public projection accepted")
	}
	state, err = db.ReadAccountChatModeration(account)
	if err != nil || state.NameChange != nil || state.Mute == nil || state.Suspension == nil || state.Revision != 4 || len(state.Receipts) != 4 {
		t.Fatal("correction erased restriction or duplicated receipt", state, err)
	}
	var after bson.M
	if err := db.users.FindOne(ctx, bson.M{"_id": account}).Decode(&after); err != nil {
		t.Fatal(err)
	}
	for _, document := range []bson.M{before, after} {
		delete(document, "public_name")
		delete(document, "public_name_key")
		delete(document, "chat_moderation")
	}
	if !reflect.DeepEqual(before, after) {
		t.Fatal("correction rewrote credentials, saves, currency or friends", before, after)
	}
	if valid, err := db.Authenticate(owner, "isolated-name-password"); err != nil || !valid {
		t.Fatal("login broken", err)
	}
	if valid, err := db.Authenticate(request.PublicName, "isolated-name-password"); err != nil || valid {
		t.Fatal("public label became an authentication key", err)
	}
	if err := db.CreateUser(strings.ToUpper(request.PublicName), "collision@example.invalid", "isolated-password"); err == nil {
		t.Fatal("registration stole reserved alias")
	}
	// A separate connection reads the committed account and original receipt.
	other, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = other.Close(context.Background()) })
	other.users = other.users.Database().Collection(db.users.Name())
	if receipt, err := other.CorrectPublicName(owner, request); err != nil || !reflect.DeepEqual(receipt, original) {
		t.Fatal("new connection lost correction receipt", err)
	}
	// Two different accounts compete for the same new alias: exactly one clears
	// its own requirement. The loser retains the notice and its original name.
	start := make(chan struct{})
	for _, member := range []string{"name-contender-a", "name-contender-b"} {
		if err := db.CreateUser(member, member+"@example.invalid", "isolated-password"); err != nil {
			t.Fatal(err)
		}
		p, err := db.ReadChatModerationTarget("operator", member)
		if err != nil {
			t.Fatal(err)
		}
		change := base
		change.Action, change.ID, change.DurationSeconds = ModerationRequireNameChange, "competing-name-"+member, 0
		receipt, err := db.ApplyChatModeration("operator", p.AccountID, change)
		if err != nil {
			t.Fatal(err)
		}
		r := PublicNameCorrectionRequest{ID: "competition-correction-001", NoticeID: receipt.Notice.ID, PublicName: "Shared Dawn", Confirmed: true}
		wg.Add(1)
		go func(member string, r PublicNameCorrectionRequest) {
			defer wg.Done()
			<-start
			_, err := db.CorrectPublicName(member, r)
			if err != nil && !errors.Is(err, ErrPublicNameUnavailable) {
				t.Error(err)
			}
		}(member, r)
	}
	close(start)
	wg.Wait()
	winners, restricted := 0, 0
	for _, member := range []string{"name-contender-a", "name-contender-b"} {
		name, err := db.OwnPublicName(member)
		if err != nil {
			t.Fatal(err)
		}
		notices, err := db.OwnModerationNotices(member)
		if err != nil {
			t.Fatal(err)
		}
		if name == "Shared Dawn" && len(notices) == 0 {
			winners++
		} else if name == member && len(notices) == 1 {
			restricted++
		}
	}
	if winners != 1 || restricted != 1 {
		t.Fatal("alias race lost restriction or duplicated label", winners, restricted)
	}
}
