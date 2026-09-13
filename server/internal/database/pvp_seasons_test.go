package database

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestArenaSeasonMongoSettlesHistoryAndHonorExactlyOnce(t *testing.T) {
	uri := os.Getenv("EIDOLON_ARENA_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable arena Mongo required")
	}
	if !strings.HasPrefix(uri, "mongodb://127.0.0.1:") {
		t.Fatal("season test requires isolated loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.client.Disconnect(context.Background()) })
	before := time.Date(2026, 9, 30, 23, 59, 0, 0, time.UTC)
	after := before.Add(2 * time.Minute)
	id := fmt.Sprintf("arena-season-test-%d", time.Now().UnixNano())
	t.Cleanup(func() { db.pvpProfiles.DeleteOne(context.Background(), bson.M{"player_id": id}) })
	old := PvPProfile{PlayerID: id, Revision: 1, LastMatchID: "old-final", Season: "2026-Q3", UpdatedAt: before,
		Rating: 1550, Wins: 70, Losses: 20, SeasonVictories: 50, SeasonPoints: 150, Honor: 100}
	if err := db.SavePvPProfile(old); err != nil {
		t.Fatal(err)
	}
	var group sync.WaitGroup
	results := make(chan error, 8)
	for i := 0; i < 8; i++ {
		group.Add(1)
		go func(i int) {
			defer group.Done()
			profile, err := db.getPvPProfileAt(id, after.Add(time.Duration(i)*time.Second))
			if err == nil && (profile.Honor != 1300 || profile.Revision != 2 || profile.Rating != 1000 || profile.SeasonVictories != 0 || len(profile.SeasonHistory) != 1) {
				err = fmt.Errorf("wrong settlement: %+v", profile)
			}
			results <- err
		}(i)
	}
	group.Wait()
	close(results)
	for err := range results {
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := db.SavePvPProfile(old); err != nil {
		t.Fatal("old match replay", err)
	}
	profile, err := db.getPvPProfileAt(id, after)
	if err != nil || profile.Honor != 1300 || len(profile.SeasonHistory) != 1 {
		t.Fatal("old replay erased settlement", profile, err)
	}
	record := profile.SeasonHistory[0]
	if record.Medal != "Gold" || record.EligibleWins != 50 || record.Rating != 1550 || record.Wins != 70 || record.HonorAwarded != 1200 {
		t.Fatal("archive lost earned season", record)
	}
	// The following quiet season records its actual zero wins, not fabricated
	// qualification or another copy of the previous quarter's prize.
	profile, err = db.getPvPProfileAt(id, time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC))
	if err != nil || profile.Honor != 1300 || len(profile.SeasonHistory) != 2 || profile.SeasonHistory[1].HonorAwarded != 0 {
		t.Fatal("quiet season awarded unearned prize", profile, err)
	}
}
