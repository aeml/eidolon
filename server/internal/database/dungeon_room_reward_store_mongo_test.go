package database

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"sync"
	"testing"
	"time"
)

// Real disposable Mongo/index/repository proof. Character receipts below are
// test-owned saved fixtures, not ordinary connected room-clear gameplay.
func TestDungeonRoomRewardStoreActualMongo(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	uri := os.Getenv("EIDOLON_ROOM_TEST_MONGO_URI")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("refusing non-disposable room reward database")
	}
	repo, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.Close(context.Background()) })
	op := dungeonRoomRewardFixture()
	nonce := time.Now().UnixNano()
	op.InstanceID = fmt.Sprintf("dungeon_room_store_%d", nonce)
	op.ID = DungeonRoomRewardID(op.InstanceID, op.RoomIndex)
	opaqueItems := append([]string(nil), op.Participants[0].Items...)
	op.Participants = nil
	characters := make([]*Character, 0, 4)
	for index := range 4 {
		username := fmt.Sprintf("room-store-%d-%02d", nonce, index)
		if err := repo.CreateUser(username, username+"@example.invalid", "isolated-fixture-password"); err != nil {
			t.Fatal(err)
		}
		character := &Character{Name: username, Level: 40, Gold: 99}
		if err := repo.SetFirstCharacter(username, character); err != nil {
			t.Fatal(err)
		}
		characters = append(characters, character)
		op.Participants = append(op.Participants, DungeonRoomRewardRecipient{Username: username, PlayerID: "player-" + username, Gold: 234, XP: 780})
	}
	op.Participants[0].Items = opaqueItems
	op.Fingerprint, _ = DungeonRoomRewardFingerprint(op)
	// Contenders propose different first outcomes for the SAME physical room.
	// Exactly one may win; all others must preserve it, not reroll or overwrite.
	results := make(chan *DungeonRoomRewardRecord, 12)
	failures := make(chan error, 12)
	var workers sync.WaitGroup
	for index := range 12 {
		workers.Add(1)
		go func(index int) {
			defer workers.Done()
			candidate := op
			candidate.Participants = append([]DungeonRoomRewardRecipient(nil), op.Participants...)
			candidate.Participants[0].Gold += index
			candidate.Fingerprint, _ = DungeonRoomRewardFingerprint(candidate)
			result, err := repo.PrepareDungeonRoomReward(candidate)
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
			op = result.DungeonRoomRewardOperation
		}
	}
	for failure := range failures {
		if errors.Is(failure, ErrDungeonRoomRewardConflict) {
			rejected++
		} else if failure != nil {
			t.Fatal(failure)
		}
	}
	if accepted != 1 || rejected != 11 {
		t.Fatal("physical-room uniqueness accepted multiple outcomes", accepted, rejected)
	}
	for index, character := range characters[:2] {
		character.ItemDeliveryReceipts = map[string]string{op.ID: op.Fingerprint}
		if err := repo.CommitCharacterSave(character.Name, character, fmt.Sprintf("%032x", index+1)); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := repo.CompleteDungeonRoomReward(op.ID, op.Fingerprint); !errors.Is(err, ErrDungeonRoomRewardUnconfirmed) {
		t.Fatal("two saved recipients retired the two unsaved claims", err)
	}
	reopened, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = reopened.Close(context.Background()) })
	for _, character := range characters[2:] {
		pending, err := reopened.PendingDungeonRoomRewards(character.Name, "", 50)
		if err != nil || len(pending) != 1 || pending[0].Fingerprint != op.Fingerprint || !reflect.DeepEqual(pending[0].Participants, op.Participants) {
			t.Fatal("fresh repository lost a recipient's retained first cohort", pending, err)
		}
	}
	// More than one recovery page, using legitimate empty eligible cohorts.
	for index := 3; index < 56; index++ {
		empty := op
		empty.RoomIndex, empty.Participants = index, nil
		empty.ID = DungeonRoomRewardID(empty.InstanceID, empty.RoomIndex)
		empty.Fingerprint, _ = DungeonRoomRewardFingerprint(empty)
		if _, err := reopened.PrepareDungeonRoomReward(empty); err != nil {
			t.Fatal(err)
		}
	}
	after, discovered := "", 0
	for {
		page, err := reopened.PendingDungeonRoomRewards("", after, 50)
		if err != nil {
			t.Fatal(err)
		}
		if len(page) == 0 {
			break
		}
		for _, record := range page {
			if record.ID <= after {
				t.Fatal("recovery cursor did not advance")
			}
			after = record.ID
			if record.InstanceID == op.InstanceID {
				discovered++
				if len(record.Participants) == 0 {
					if _, err := reopened.CompleteDungeonRoomReward(record.ID, record.Fingerprint); err != nil {
						t.Fatal(err)
					}
				}
			}
		}
	}
	if discovered != 54 {
		t.Fatal("pending cohorts beyond the first page were missed", discovered)
	}
	for index, character := range characters[2:] {
		character.ItemDeliveryReceipts = map[string]string{op.ID: op.Fingerprint}
		if err := reopened.CommitCharacterSave(character.Name, character, fmt.Sprintf("%032x", index+3)); err != nil {
			t.Fatal(err)
		}
	}
	if record, err := reopened.CompleteDungeonRoomReward(op.ID, op.Fingerprint); err != nil || record.State != DungeonRoomRewardComplete {
		t.Fatal("fully saved cohort did not complete", err)
	}
	if record, err := reopened.PrepareDungeonRoomReward(op); err != nil || record.State != DungeonRoomRewardComplete {
		t.Fatal("terminal replay reopened or rerolled the room", err)
	}
	if pending, err := reopened.PendingDungeonRoomRewards(characters[0].Name, "", 50); err != nil || len(pending) != 0 {
		t.Fatal("completed cohort still occupies recovery", pending, err)
	}
	if version, err := reopened.SchemaVersion(context.Background()); err != nil || version != CurrentSchemaVersion {
		t.Fatal("cohort writer fence missing", version, err)
	}
}
