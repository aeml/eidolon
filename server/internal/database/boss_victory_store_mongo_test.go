package database

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// Actual primary/majority repository, indexes and saved receipts. Characters
// here are prepared stored fixtures, not connected earned boss-fight proof.
func TestBossVictoryStoreActualMongo(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	uri := os.Getenv("EIDOLON_BOSS_TEST_MONGO_URI")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("refusing non-disposable boss victory database")
	}
	repo, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.Close(context.Background()) })
	op := bossVictoryFixture()
	nonce := time.Now().UnixNano()
	// Other socket checks deliberately retain completed victories and their
	// original drops in this disposable database. Do not delete that history or
	// mistake an additional active victory for a failed projection query.
	unrelated := bossVictoryFixture()
	unrelated.InstanceID = fmt.Sprintf("dungeon_boss_unrelated_%d", nonce)
	unrelated.BossID = unrelated.BossType + "-" + unrelated.InstanceID
	unrelated.ID = BossVictoryID(unrelated.InstanceID, unrelated.BossID)
	unrelated.Drops[0].LootID = fmt.Sprintf("loot-boss-%s-0", strings.TrimPrefix(unrelated.ID, bossVictoryPrefix))
	unrelated.Fingerprint, _ = BossVictoryFingerprint(unrelated)
	sharedVictories := repo.bossVictories
	fixtureVictories := repo.client.Database("eidolon").Collection(fmt.Sprintf("boss_victory_store_%d", nonce))
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := fixtureVictories.Drop(ctx); err != nil {
			t.Error(err)
		}
		if _, err := sharedVictories.DeleteOne(ctx, bson.M{"_id": unrelated.ID}); err != nil {
			t.Error(err)
		}
	})
	if _, err := repo.PrepareBossVictory(unrelated); err != nil {
		t.Fatal(err)
	}
	repo.bossVictories = fixtureVictories
	if err := applyBossVictoryIndexes(t.Context(), repo); err != nil {
		t.Fatal(err)
	}
	characters := make([]*Character, 2)
	var usernames []string
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if len(usernames) > 0 {
			if _, err := repo.users.DeleteMany(ctx, bson.M{"username": bson.M{"$in": usernames}}); err != nil {
				t.Error(err)
			}
		}
	})
	for index := range characters {
		name := fmt.Sprintf("boss-store-%d-%02d", nonce, index)
		if err := repo.CreateUser(name, name+"@example.invalid", "isolated-fixture-password"); err != nil {
			t.Fatal(err)
		}
		usernames = append(usernames, name)
		characters[index] = &Character{Name: name, Level: 30, Gold: 99, EP: 43}
		if err := repo.SetFirstCharacter(name, characters[index]); err != nil {
			t.Fatal(err)
		}
		op.Participants[index].Username, op.Participants[index].PlayerID = name, "player-"+name
	}
	results := make(chan *BossVictoryRecord, 8)
	failures := make(chan error, 8)
	var workers sync.WaitGroup
	for index := range 8 {
		workers.Add(1)
		go func(index int) {
			defer workers.Done()
			candidate := op
			candidate.Participants = append([]BossVictoryRecipient(nil), op.Participants...)
			candidate.Participants[0].Gold += index
			candidate.Fingerprint, _ = BossVictoryFingerprint(candidate)
			result, err := repo.PrepareBossVictory(candidate)
			results <- result
			failures <- err
		}(index)
	}
	workers.Wait()
	close(results)
	close(failures)
	accepted, rejected := 0, 0
	for result := range results {
		if result != nil {
			accepted++
			op = result.BossVictoryOperation
		}
	}
	for failure := range failures {
		if errors.Is(failure, ErrBossVictoryConflict) {
			rejected++
		} else if failure != nil {
			t.Fatal(failure)
		}
	}
	if accepted != 1 || rejected != 7 {
		t.Fatal("conflicting first victories were overwritten or accepted together", accepted, rejected)
	}
	if record, err := repo.CompleteBossVictory(op.ID, op.Fingerprint); !errors.Is(err, ErrBossVictoryUnconfirmed) || record != nil {
		t.Fatal("unpaid original cohort was falsely completed", err)
	}
	for index, character := range characters {
		character.ItemDeliveryReceipts = map[string]string{op.ID: op.Fingerprint}
		character.PendingBossLoot = append([]string(nil), op.Participants[index].Items...)
		if index == 1 {
			// A RAM receipt from the second original member is not saved proof.
			if _, err := repo.CompleteBossVictory(op.ID, op.Fingerprint); !errors.Is(err, ErrBossVictoryUnconfirmed) {
				t.Fatal("completion trusted an unsaved recipient receipt", err)
			}
		}
		if err := repo.SaveCharacter(character.Name, character); err != nil {
			t.Fatal(err)
		}
	}
	record, err := repo.CompleteBossVictory(op.ID, op.Fingerprint)
	if err != nil || record == nil || record.State != BossVictoryComplete {
		t.Fatal("actual saved original cohort could not complete", err)
	}
	// A new repository instance resolves the first exact cohort and ground
	// lifetime, independent of the earlier process's RAM.
	fresh, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = fresh.Close(context.Background()) })
	fresh.bossVictories = fresh.client.Database("eidolon").Collection(fixtureVictories.Name())
	stored, err := fresh.GetBossVictory(op.ID)
	if err != nil || stored == nil || !reflect.DeepEqual(stored.BossVictoryOperation, op) || stored.State != BossVictoryComplete {
		t.Fatal("fresh repository lost original victory or ground metadata", err)
	}
	for index := range 52 {
		candidate := op
		candidate.InstanceID = fmt.Sprintf("dungeon_boss_page_%d_%02d", nonce, index)
		candidate.BossID = candidate.BossType + "-" + candidate.InstanceID
		candidate.ID = BossVictoryID(candidate.InstanceID, candidate.BossID)
		candidate.Participants = []BossVictoryRecipient{{Username: characters[0].Name, PlayerID: "player-" + characters[0].Name, Gold: 1}}
		candidate.Drops = nil
		candidate.Fingerprint, _ = BossVictoryFingerprint(candidate)
		if _, err := fresh.PrepareBossVictory(candidate); err != nil {
			t.Fatal(err)
		}
	}
	after := ""
	seen := map[string]bool{}
	for {
		page, err := fresh.PendingBossVictories(characters[0].Name, after, 7)
		if err != nil {
			t.Fatal(err)
		}
		if len(page) == 0 {
			break
		}
		for _, record := range page {
			if seen[record.ID] || record.ID <= after {
				t.Fatal("pending cursor repeated or omitted its sort bound")
			}
			seen[record.ID], after = true, record.ID
		}
	}
	if len(seen) != 52 {
		t.Fatal("bounded recovery missed original pending victories", len(seen))
	}
	if page, err := fresh.PendingBossVictories(characters[1].Name, "", 50); err != nil || len(page) != 0 {
		t.Fatal("completed victory or another cohort leaked into account recovery", err)
	}
	// Terminal reward receipts must not hide still-available original spawns.
	page, err := fresh.ActiveBossVictoryDropPage("", op.CreatedAt, 50)
	if err != nil || len(page) != 1 || page[0].ID != op.ID || page[0].State != BossVictoryComplete {
		t.Fatal("terminal first victory lost active original drops", err)
	}
	if page, err := fresh.ActiveBossVictoryDropPage(op.ID, op.CreatedAt, 50); err != nil || len(page) != 0 {
		t.Fatal("active projection cursor repeated its exclusive ID bound", err)
	}
	if page, err := fresh.ActiveBossVictoryDropPage("", op.Drops[0].ExpiresAt, 50); err != nil || len(page) != 0 {
		t.Fatal("expired first drop was renewed or included at its expiry", err)
	}
	for _, query := range []struct {
		after string
		now   time.Time
		limit int
	}{{"invalid", op.CreatedAt, 1}, {"", time.Time{}, 1}, {"", op.CreatedAt, 51}} {
		if _, err := fresh.ActiveBossVictoryDropPage(query.after, query.now, query.limit); !errors.Is(err, ErrBossVictoryConflict) {
			t.Fatal("unbounded or malformed active projection query was accepted", err)
		}
	}
	var retained BossVictoryRecord
	if err := sharedVictories.FindOne(t.Context(), bson.M{"_id": unrelated.ID}).Decode(&retained); err != nil ||
		retained.State != BossVictoryPending || !reflect.DeepEqual(retained.BossVictoryOperation, unrelated) {
		t.Fatal("isolated repository check changed unrelated retained victory", err)
	}
}
