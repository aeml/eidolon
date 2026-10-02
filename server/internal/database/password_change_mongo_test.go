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

	"go.mongodb.org/mongo-driver/bson"
)

func TestPasswordChangeActualMongoPreservesAccountAndConcurrentOwnership(t *testing.T) {
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
	db.users = db.users.Database().Collection(uniqueID("password-fixtures"))
	t.Cleanup(func() { _ = db.users.Drop(context.Background()) })
	const owner = "password-owner"
	const old = "oldpass"
	if err := db.CreateUser(owner, "fixture@example.invalid", old); err != nil {
		t.Fatal(err)
	}
	if err := db.CreateUser("independent-owner", "other@example.invalid", old); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	_, err = db.users.UpdateOne(ctx, bson.M{"username": owner}, bson.M{"$set": bson.M{
		"roles": bson.M{"admin": bson.M{"source": "fixture"}}, "vip_periods": bson.A{bson.M{"id": "preserved-vip"}},
		"characters":         bson.A{bson.M{"name": "Saved hero", "gold": 12345, "ep": 100, "inventory": bson.A{Item{ID: "preserved-gear", Name: "Fixture Sword", Type: "WEAPON", Stack: 1}}}},
		"extra_legacy_field": "preserved"}})
	if err != nil {
		t.Fatal(err)
	}
	read := func() bson.M {
		var value bson.M
		if err := db.users.FindOne(ctx, bson.M{"username": owner}).Decode(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	before := read()
	for _, attempt := range []struct{ user, current, next string }{
		{owner, "wrong-password", "A unique replacement phrase"}, {"unknown-account", old, "A unique replacement phrase"},
		{owner, old, old}, {owner, old, strings.Repeat("x", 73)},
	} {
		changed, err := db.ChangePassword(attempt.user, attempt.current, attempt.next)
		if err != nil || changed {
			t.Fatal("invalid proof changed a credential", err)
		}
	}
	if !reflect.DeepEqual(before, read()) {
		t.Fatal("rejected attempts changed stored account")
	}
	var wg sync.WaitGroup
	winners := make(chan string, 4)
	for i := 0; i < 4; i++ {
		next := fmt.Sprintf("  Concurrent unique phrase %d  ", i)
		wg.Add(1)
		go func() {
			defer wg.Done()
			changed, err := db.ChangePassword(owner, old, next)
			if err != nil {
				t.Error(err)
			}
			if changed {
				winners <- next
			}
		}()
	}
	wg.Wait()
	close(winners)
	var winner string
	count := 0
	for next := range winners {
		winner = next
		count++
	}
	if count != 1 {
		t.Fatal("concurrent old-password proofs overwrote ownership", count)
	}
	after := read()
	if before["password_hash"] == after["password_hash"] || after["password_hash"] == winner {
		t.Fatal("credential was unchanged or plaintext")
	}
	delete(before, "password_hash")
	delete(after, "password_hash")
	if !reflect.DeepEqual(before, after) {
		t.Fatal("password change touched account, role, character or wallet data")
	}
	if ok, err := db.Authenticate(owner, old); err != nil || ok {
		t.Fatal("former password still authenticated", err)
	}
	if ok, err := db.Authenticate(owner, winner); err != nil || !ok {
		t.Fatal("exact new password failed", err)
	}
	if ok, err := db.Authenticate(owner, strings.TrimSpace(winner)); err != nil || ok {
		t.Fatal("password normalization changed credentials", err)
	}
	if ok, err := db.Authenticate("independent-owner", old); err != nil || !ok {
		t.Fatal("another account's password was changed", err)
	}
}
