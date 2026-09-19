package database

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func adminOperationFixture(t *testing.T, actor, target, request string) AdminOperation {
	t.Helper()
	audit, err := NewAdminActivity(actor, target, "admin_grant_gold", request, "success", "Granted 100 Gold.", time.Now(), 90)
	if err != nil {
		t.Fatal(err)
	}
	return AdminOperation{Version: 1, ID: AdminOperationID(actor, request), Actor: actor, Target: target,
		RequestID: request, Action: "admin_grant_gold", Fingerprint: strings.Repeat("a", 64),
		Payload: []byte(`{"action":"admin_grant_gold","amount":100}`), State: AdminOperationPending, Audit: audit}
}

func TestAdminOperationValidationAndReceiptIdentity(t *testing.T) {
	op := adminOperationFixture(t, "operator", "recipient", "request-123456789")
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	for _, change := range []func(*AdminOperation){
		func(o *AdminOperation) { o.Version = 2 },
		func(o *AdminOperation) { o.ID = "admin:" + strings.Repeat("f", 64) },
		func(o *AdminOperation) { o.Fingerprint = "bad" },
		func(o *AdminOperation) { o.Target = "" },
		func(o *AdminOperation) { o.Actor = "other" },
		func(o *AdminOperation) { o.RequestID = "short" },
		func(o *AdminOperation) { o.Action = "admin_history" },
		func(o *AdminOperation) { o.Audit.Target = "different" },
		func(o *AdminOperation) { o.Audit.Result = "denied" },
		func(o *AdminOperation) { o.State = "unknown" },
		func(o *AdminOperation) { o.Payload = nil },
		func(o *AdminOperation) { o.Payload = []byte(`{"bad"`) },
		func(o *AdminOperation) { o.Payload = []byte(`"` + strings.Repeat("x", 64<<10) + `"`) },
	} {
		invalid := op
		change(&invalid)
		if invalid.Validate() == nil {
			t.Fatal("invalid durable operation accepted")
		}
	}
	data, _ := json.Marshal(op)
	if string(data) != "{}" {
		t.Fatal("private operation serializes into public JSON")
	}
	if applied, err := AdminOperationApplied(nil, op.ID, op.Fingerprint); err != nil || applied {
		t.Fatal(applied, err)
	}
	receipts := map[string]string{op.ID: op.Fingerprint}
	if applied, err := AdminOperationApplied(receipts, op.ID, op.Fingerprint); err != nil || !applied {
		t.Fatal(applied, err)
	}
	if _, err := AdminOperationApplied(receipts, op.ID, strings.Repeat("b", 64)); !errors.Is(err, ErrAdminOperationConflict) {
		t.Fatal("conflicting receipt accepted")
	}
}

func TestAdminOperationMongoIntentOutcomeAuditAndReplay(t *testing.T) {
	uri := os.Getenv("MONGO_URI")
	if os.Getenv("EIDOLON_ADMIN_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires isolated loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close(context.Background())
	actor := fmt.Sprintf("op-test-%d", time.Now().UnixNano())
	defer db.adminOperations.DeleteMany(context.Background(), bson.M{"actor": actor})
	defer db.adminActivity.DeleteMany(context.Background(), bson.M{"actor": actor})
	op := adminOperationFixture(t, actor, "recipient", "request-123456789")
	first, err := db.PrepareAdminOperation(op)
	if err != nil || first.State != AdminOperationPending {
		t.Fatal(first, err)
	}
	var group sync.WaitGroup
	for i := 0; i < 8; i++ {
		group.Add(1)
		go func(i int) {
			defer group.Done()
			retry := op
			retry.Payload = []byte(fmt.Sprintf(`{"action":"admin_grant_gold","amount":%d}`, i+1))
			// Server-generated rolls from a losing prepare must not overwrite the
			// first plan even when the inbound request fingerprint is identical.
			stored, err := db.PrepareAdminOperation(retry)
			if err != nil || stored == nil || string(stored.Payload) != string(op.Payload) {
				t.Error("concurrent retry replaced first durable plan", err)
			}
		}(i)
	}
	group.Wait()
	conflict := op
	conflict.Fingerprint = strings.Repeat("b", 64)
	if _, err := db.PrepareAdminOperation(conflict); !errors.Is(err, ErrAdminOperationConflict) {
		t.Fatal("payload reuse not rejected", err)
	}
	for _, target := range []string{"recipient", "unrelated"} {
		pending, err := db.PendingAdminOperations(target, 1)
		if err != nil || target == "recipient" && len(pending) != 1 || target == "unrelated" && len(pending) != 0 {
			t.Fatal(target, pending, err)
		}
	}
	// Failure after the immutable outcome but before audit insertion must leave
	// a recoverable auditing record, not a reported success or a repeated grant.
	activity := db.adminActivity
	db.adminActivity = nil
	_, finishErr := db.FinishAdminOperation(op.ID, op.Fingerprint, op.Audit)
	db.adminActivity = activity
	if finishErr == nil {
		t.Fatal("audit failure reported completion")
	}
	stored, err := db.GetAdminOperation(op.ID)
	if err != nil || stored.State != AdminOperationAuditing {
		t.Fatal(stored, err)
	}
	changedAudit := op.Audit
	changedAudit.Result, changedAudit.Summary = "denied", "A different decision."
	if _, err := db.FinishAdminOperation(op.ID, op.Fingerprint, changedAudit); err == nil {
		t.Fatal("frozen outcome was rewritten")
	}
	reopened, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close(context.Background())
	completed, err := reopened.FinishAdminOperation(op.ID, op.Fingerprint, op.Audit)
	if err != nil || completed.State != AdminOperationComplete || len(completed.Payload) != 0 {
		t.Fatal(completed, err)
	}
	if count, err := db.adminActivity.CountDocuments(context.Background(), bson.M{"_id": op.Audit.ID}); err != nil || count != 1 {
		t.Fatal("audit not inserted exactly once", count, err)
	}
	// Simulate this test-owned audit's TTL expiry. The permanent replay receipt
	// must neither pay again nor recreate an expired history entry.
	if _, err := db.adminActivity.DeleteOne(context.Background(), bson.M{"_id": op.Audit.ID}); err != nil {
		t.Fatal(err)
	}
	if _, err := reopened.FinishAdminOperation(op.ID, op.Fingerprint, op.Audit); err != nil {
		t.Fatal(err)
	}
	if count, err := db.adminActivity.CountDocuments(context.Background(), bson.M{"_id": op.Audit.ID}); err != nil || count != 0 {
		t.Fatal("completed retry recreated expired audit", count, err)
	}
	if pending, err := db.PendingAdminOperations("recipient", 50); err != nil || len(pending) != 0 {
		t.Fatal("completed operation stayed pending", pending, err)
	}
}
