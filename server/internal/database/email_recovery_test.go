package database

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestEmailRecoveryInputProofs(t *testing.T) {
	for _, value := range []string{"owner@example.invalid", "Case.Sensitive+tag@example.invalid"} {
		if !ValidRecoveryEmail(value) {
			t.Fatal("single mailbox rejected")
		}
	}
	for _, value := range []string{"", "Owner <owner@example.invalid>", "owner@example.invalid,other@example.invalid", " owner@example.invalid", "owner@example.invalid\r\nBcc: other@example.invalid", "not-an-address"} {
		if ValidRecoveryEmail(value) {
			t.Fatal("non-single/injected mailbox accepted")
		}
	}
	token := strings.Repeat("a", 64)
	digest, valid := recoveryDigest(token)
	if !valid || len(digest) != 64 || digest == token {
		t.Fatal("plaintext or invalid digest")
	}
	for _, value := range []string{"", strings.Repeat("a", 63), strings.Repeat("X", 64), strings.Repeat("A", 64)} {
		if _, valid := recoveryDigest(value); valid {
			t.Fatal("malformed token accepted")
		}
	}
}

func TestEmailRecoveryActualMongoProofReplayAndAccountPreservation(t *testing.T) {
	uri := os.Getenv("EIDOLON_PASSWORD_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("requires explicit disposable loopback Mongo")
	}
	u, err := url.Parse(uri)
	if err != nil || u.Scheme != "mongodb" || u.Hostname() != "127.0.0.1" || u.Port() == "" || u.User != nil || os.Getenv("EIDOLON_PASSWORD_DISPOSABLE_DATABASE") != "1" {
		t.Fatal("requires explicit disposable loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	db.users = db.users.Database().Collection(uniqueID("email-recovery-fixtures"))
	t.Cleanup(func() { _ = db.users.Drop(context.Background()) })
	const owner, old, address = "recovery-owner", "legacy-pass", "verified@example.invalid"
	if err := db.CreateUser(owner, "unverified@example.invalid", old); err != nil {
		t.Fatal(err)
	}
	if err := db.CreateUser("independent-owner", "other@example.invalid", old); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, err := db.users.UpdateOne(ctx, bson.M{"username": owner}, bson.M{"$set": bson.M{
		"roles": bson.M{"admin": bson.M{"source": "fixture"}}, "extra_legacy_field": "preserved",
		"characters": bson.A{bson.M{"name": "Saved hero", "gold": 12345, "ep": 100, "inventory": bson.A{Item{ID: "preserved-gear", Type: "WEAPON", Name: "Fixture sword", Stack: 1}}}},
	}}); err != nil {
		t.Fatal(err)
	}
	read := func() bson.M {
		var doc bson.M
		if err := db.users.FindOne(ctx, bson.M{"username": owner}).Decode(&doc); err != nil {
			t.Fatal(err)
		}
		return doc
	}
	before := read()
	now := time.Date(2026, 10, 4, 4, 0, 0, 0, time.UTC)
	a, b, c := strings.Repeat("a", 64), strings.Repeat("b", 64), strings.Repeat("c", 64)
	if recipient, err := db.BeginPasswordRecovery(owner, b, now); err != nil || recipient != "" {
		t.Fatal("registration email granted recovery", err)
	}
	if recipient, err := db.BeginPasswordRecovery("unknown-owner", b, now); err != nil || recipient != "" {
		t.Fatal("unknown account exposed", err)
	}
	if !reflect.DeepEqual(before, read()) {
		t.Fatal("request mutated unverified account")
	}
	if changed, err := db.BeginRecoveryEmail(owner, "wrong", address, a, now); err != nil || changed {
		t.Fatal("wrong password granted mail setup", err)
	}
	if changed, err := db.BeginRecoveryEmail(owner, old, address, a, now); err != nil || !changed {
		t.Fatal("valid mail setup failed", err)
	}
	encoded, _ := bson.Marshal(read())
	if strings.Contains(string(encoded), a) || strings.Contains(string(encoded), old) {
		t.Fatal("plaintext token/password persisted")
	}
	if changed, err := db.BeginRecoveryEmail(owner, old, "replacement@example.invalid", c, now.Add(30*time.Second)); err != nil || changed {
		t.Fatal("cooldown replaced live verification link", err)
	}
	for _, input := range []struct {
		user, token string
		at          time.Time
	}{{"independent-owner", a, now}, {owner, c, now}, {owner, a, now.Add(RecoveryVerificationLifetime)}} {
		if changed, err := db.ConfirmRecoveryEmail(input.user, input.token, input.at); err != nil || changed {
			t.Fatal("invalid/cross-account/expired verification admitted", err)
		}
	}
	if changed, err := db.ConfirmRecoveryEmail(owner, a, now.Add(time.Minute)); err != nil || !changed {
		t.Fatal("mail proof failed", err)
	}
	if changed, err := db.ConfirmRecoveryEmail(owner, a, now.Add(time.Minute)); err != nil || changed {
		t.Fatal("verification replay succeeded", err)
	}
	if recipient, err := db.BeginPasswordRecovery(owner, b, now.Add(2*time.Minute)); err != nil || recipient != address {
		t.Fatal("verified address not selected", err)
	}
	if recipient, err := db.BeginPasswordRecovery(owner, c, now.Add(150*time.Second)); err != nil || recipient != "" {
		t.Fatal("reset cooldown bypass", err)
	}
	for _, input := range []struct {
		user, token string
		at          time.Time
	}{{"independent-owner", b, now}, {owner, c, now}, {owner, b, now.Add(2*time.Minute + PasswordRecoveryLifetime)}} {
		if changed, attempted, err := db.CompletePasswordRecovery(input.user, input.token, "A unique replacement phrase", input.at); err != nil || changed || attempted {
			t.Fatal("invalid reset reached credential mutation", err)
		}
	}
	var wg sync.WaitGroup
	winners := make(chan string, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			next := fmt.Sprintf("A unique replacement phrase %d", i)
			changed, _, err := db.CompletePasswordRecovery(owner, b, next, now.Add(3*time.Minute))
			if err != nil {
				t.Error(err)
			}
			if changed {
				winners <- next
			}
		}(i)
	}
	wg.Wait()
	close(winners)
	count, winner := 0, ""
	for next := range winners {
		count++
		winner = next
	}
	if count != 1 {
		t.Fatal("single-use reset won more/less than once", count)
	}
	if ok, err := db.Authenticate(owner, winner); err != nil || !ok {
		t.Fatal("winning password not installed", err)
	}
	if ok, err := db.Authenticate(owner, old); err != nil || ok {
		t.Fatal("old password survived", err)
	}
	if changed, attempted, err := db.CompletePasswordRecovery(owner, b, "A unique replay phrase", now.Add(4*time.Minute)); err != nil || changed || attempted {
		t.Fatal("reset replay succeeded", err)
	}
	after := read()
	for key, value := range before {
		if key != "password_hash" && !reflect.DeepEqual(value, after[key]) {
			t.Fatal("unrelated account data changed", key)
		}
	}
	if _, ok := after["password_recovery"]; ok {
		t.Fatal("reset token not consumed")
	}
	if _, ok := after["recovery_email_pending"]; ok {
		t.Fatal("pending verification not consumed")
	}
	if changed, err := db.BeginRecoveryEmail(owner, winner, "replacement@example.invalid", c, now.Add(5*time.Minute)); err != nil || !changed {
		t.Fatal("new verification failed", err)
	}
	if recipient, err := db.BeginPasswordRecovery(owner, a, now.Add(6*time.Minute)); err != nil || recipient != address {
		t.Fatal("pending unverified address replaced verified address", err)
	}
	if changed, err := db.ChangePassword(owner, winner, "A different current owner phrase"); err != nil || !changed {
		t.Fatal("password change failed", err)
	}
	if changed, err := db.ConfirmRecoveryEmail(owner, c, now.Add(7*time.Minute)); err != nil || changed {
		t.Fatal("password change retained verification", err)
	}
	if changed, attempted, err := db.CompletePasswordRecovery(owner, a, "A stale recovery phrase", now.Add(7*time.Minute)); err != nil || changed || attempted {
		t.Fatal("password change retained reset link", err)
	}
}
