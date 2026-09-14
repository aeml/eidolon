package database

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestVIPMongoConcurrentProvisioningCannotDuplicateOrOverlapMonths(t *testing.T) {
	uri := os.Getenv("EIDOLON_VIP_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	if !strings.HasPrefix(uri, "mongodb://127.0.0.1:") {
		t.Fatal("requires disposable loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	username := fmt.Sprintf("vip-provision-qa-%d", time.Now().UnixNano())
	ctx := context.Background()
	if _, err := db.users.InsertOne(ctx, User{Username: username}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.users.DeleteOne(context.Background(), bson.M{"username": username}) })
	period := vipTestPeriod(t, "2026-09-14T00:00:00Z")
	var group sync.WaitGroup
	var created atomic.Int32
	for range 8 {
		group.Add(1)
		go func() {
			defer group.Done()
			added, err := db.ProvisionVIPPeriod(username, period)
			if err != nil {
				t.Error(err)
			}
			if added {
				created.Add(1)
			}
		}()
	}
	group.Wait()
	periods, err := db.GetVIPPeriods(username)
	if err != nil || created.Load() != 1 || len(periods) != 1 {
		t.Fatal("duplicate membership months", created.Load(), periods, err)
	}
	overlap, _ := NewVIPPeriod(period.StartsAt.Add(time.Hour), period.EndsAt.Add(time.Hour))
	if _, err := db.ProvisionVIPPeriod(username, overlap); err == nil {
		t.Fatal("overlapping month accepted")
	}
	next := vipTestPeriod(t, "2026-10-14T00:00:00Z")
	if created, err := db.ProvisionVIPPeriod(username, next); err != nil || !created {
		t.Fatal("adjacent renewal rejected", err)
	}
	if err := db.RevokeVIPPeriod(username, period.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ProvisionVIPPeriod(username, period); err == nil {
		t.Fatal("replayed provisioning undid revocation")
	}
	periods, err = db.GetVIPPeriods(username)
	if err != nil || len(periods) != 2 || !periods[0].Revoked || periods[1].Revoked {
		t.Fatal("revocation modified wrong period", err)
	}
}
