package database

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func arenaReceiptFixture(id string, revision int64) PvPResultReceipt {
	at := time.Now().UTC().Truncate(time.Millisecond)
	return PvPResultReceipt{MatchID: fmt.Sprintf("match-%s-%d", id, revision), Profiles: []PvPProfile{{
		PlayerID: id, Revision: revision, LastMatchID: fmt.Sprintf("match-%s-%d", id, revision),
		Season: CurrentArenaSeason(at), Rating: 1000 + int(revision)*25, Wins: int(revision), Honor: int(revision) * 50, SeasonPoints: int(revision) * 3, UpdatedAt: at,
	}}}
}

func TestArenaResultJournalRetainsDetachedChecksummedReceiptAndRejectsConflicts(t *testing.T) {
	dir := t.TempDir()
	j, err := OpenPvPResultJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	receipt := arenaReceiptFixture("../hero", 1)
	if err = j.Write(receipt); err != nil {
		t.Fatal(err)
	}
	if err = j.Write(receipt); err != nil {
		t.Fatal("identical retry", err)
	}
	name := j.filename(receipt.MatchID)
	if filepath.Dir(name) != dir {
		t.Fatal("receipt escaped journal")
	}
	info, err := os.Stat(name)
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("unsafe receipt permissions", err)
	}
	receipt.Profiles[0].Honor = 999
	if err = j.Write(receipt); err == nil {
		t.Fatal("same match accepted conflicting rewards")
	}
	reopened, err := OpenPvPResultJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := reopened.Pending()
	if err != nil || len(pending) != 1 || pending[0].Profiles[0].Honor != 50 {
		t.Fatal("durable receipt aliased live state", pending, err)
	}
	data, err := os.ReadFile(name)
	if err != nil {
		t.Fatal(err)
	}
	corrupt := strings.Replace(string(data), `"honor":50`, `"honor":51`, 1)
	if corrupt == string(data) {
		t.Fatal("corruption fixture failed")
	}
	if err = os.WriteFile(name, []byte(corrupt), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = reopened.Pending(); err == nil {
		t.Fatal("valid JSON with corrupted rewards passed checksum")
	}
	if err = os.WriteFile(name, data, 0600); err != nil {
		t.Fatal(err)
	}
	if err = reopened.Acknowledge(receipt.MatchID); err != nil {
		t.Fatal(err)
	}
	if pending, err = reopened.Pending(); err != nil || len(pending) != 0 {
		t.Fatal("acknowledged receipt survived", err)
	}
}

func TestArenaReceiptMongoReplayAndOutOfOrderWrites(t *testing.T) {
	uri := os.Getenv("EIDOLON_ARENA_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable arena Mongo required")
	}
	if !strings.HasPrefix(uri, "mongodb://127.0.0.1:") {
		t.Fatal("arena fixture requires explicit loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.client.Disconnect(context.Background()) })
	id := fmt.Sprintf("arena-replay-test-%d", time.Now().UnixNano())
	t.Cleanup(func() { db.pvpProfiles.DeleteOne(context.Background(), bson.M{"player_id": id}) })
	first := arenaReceiptFixture(id, 1)
	second := arenaReceiptFixture(id, 2)
	if err = db.SavePvPProfile(second.Profiles[0]); err != nil {
		t.Fatal(err)
	}
	if err = db.SavePvPProfile(first.Profiles[0]); err != nil {
		t.Fatal("stale retry", err)
	}
	if err = db.SavePvPProfile(second.Profiles[0]); err != nil {
		t.Fatal("same result replay", err)
	}
	conflict := second.Profiles[0]
	conflict.Honor++
	if err = db.SavePvPProfile(conflict); err == nil {
		t.Fatal("conflicting same-revision update succeeded")
	}
	var group sync.WaitGroup
	errors := make(chan error, 8)
	for revision := int64(3); revision <= 10; revision++ {
		group.Add(1)
		go func(revision int64) {
			defer group.Done()
			errors <- db.SavePvPProfile(arenaReceiptFixture(id, revision).Profiles[0])
		}(revision)
	}
	group.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	profile, err := db.GetPvPProfile(id)
	if err != nil || profile.Revision != 10 || profile.Wins != 10 || profile.Honor != 500 {
		t.Fatal("newest outcome lost", profile, err)
	}

	// Crash boundary: first participant committed, second not yet written.
	j, err := OpenPvPResultJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	receipt := arenaReceiptFixture(id, 11)
	other := arenaReceiptFixture(id+"-partner", 1).Profiles[0]
	other.LastMatchID = receipt.MatchID
	receipt.Profiles = append(receipt.Profiles, other)
	t.Cleanup(func() { db.pvpProfiles.DeleteOne(context.Background(), bson.M{"player_id": other.PlayerID}) })
	if err = j.Write(receipt); err != nil {
		t.Fatal(err)
	}
	if err = db.SavePvPProfile(receipt.Profiles[0]); err != nil {
		t.Fatal(err)
	}
	pending, err := j.Pending()
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err = db.CommitPvPReceipt(pending[0]); err != nil {
			t.Fatal(err)
		}
	}
	profile, err = db.GetPvPProfile(id)
	if err != nil || profile.Revision != 11 || profile.Honor != 550 {
		t.Fatal("partial replay doubled/lost first reward", profile, err)
	}
	partner, err := db.GetPvPProfile(other.PlayerID)
	if err != nil || partner.Revision != 1 || partner.Honor != 50 {
		t.Fatal("partial replay lost partner", partner, err)
	}
}
