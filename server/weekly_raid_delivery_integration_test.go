package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func weeklyDisposableDatabase(t *testing.T) *database.DB {
	t.Helper()
	if os.Getenv("EIDOLON_WEEKLY_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	uri := os.Getenv("MONGO_URI")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("refusing non-disposable Mongo target")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.Close(context.Background()) })
	return repo
}

func TestWeeklyRaidMongoPendingLegacyAndDeferredQueries(t *testing.T) {
	repo := weeklyDisposableDatabase(t)
	playerID := fmt.Sprintf("player-weekly-query-%d", time.Now().UnixNano())
	at := time.Now().UTC()
	entry, err := repo.PrepareWeeklyRaidReward(playerID, at)
	if err != nil || entry == nil || !entry.DeliveryPending {
		t.Fatal("prepare failed", err)
	}
	duplicate, err := repo.PrepareWeeklyRaidReward(playerID, at.Add(time.Second))
	if err != nil || duplicate == nil || duplicate.Week != entry.Week || !duplicate.CompletedAt.Equal(entry.CompletedAt.Truncate(time.Millisecond)) {
		t.Fatal("duplicate did not retain first entitlement", err)
	}
	contains := func() bool {
		t.Helper()
		entries, err := repo.PendingWeeklyRaidRewards()
		if err != nil {
			t.Fatal(err)
		}
		for _, pending := range entries {
			if pending.PlayerID == playerID {
				return true
			}
		}
		return false
	}
	if !contains() {
		t.Fatal("new entitlement missing from recovery")
	}
	if err := repo.DeferWeeklyRaidReward(playerID, entry.Week, at.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if contains() {
		t.Fatal("deferred entry still occupies bounded batch")
	}
	if claimed, err := repo.HasWeeklyRaidReward(playerID, at); err != nil || !claimed {
		t.Fatal("deferral erased lockout")
	}
	if err := repo.DeferWeeklyRaidReward(playerID, entry.Week, at.Add(-time.Second)); err != nil {
		t.Fatal(err)
	}
	if !contains() {
		t.Fatal("due entitlement never retries")
	}
	for i := 0; i < 2; i++ {
		if err := repo.FinishWeeklyRaidReward(playerID, entry.Week); err != nil {
			t.Fatal(err)
		}
	}
	if contains() {
		t.Fatal("delivered entitlement still pending")
	}
	if replay, err := repo.PrepareWeeklyRaidReward(playerID, at); err != nil || replay != nil {
		t.Fatal("delivered entitlement reopened", err)
	}
	legacy := playerID + "-legacy"
	if ok, err := repo.ClaimWeeklyRaidReward(legacy, at); err != nil || !ok {
		t.Fatal("legacy setup failed", err)
	}
	if replay, err := repo.PrepareWeeklyRaidReward(legacy, at); err != nil || replay != nil {
		t.Fatal("legacy reward reissued", err)
	}
	version, err := repo.SchemaVersion(context.Background())
	if err != nil || version != 15 {
		t.Fatal("weekly receipt writer fence missing", version, err)
	}
	if err := repo.RunMigrations(context.Background()); err != nil {
		t.Fatal("migration replay failed", err)
	}
}

func TestWeeklyRaidMongoJournalFailureAndOfflineRecovery(t *testing.T) {
	repo := weeklyDisposableDatabase(t)
	_, failed := setupCharacterJournalTest(t)
	old := weeklyRaidRewards
	t.Cleanup(func() { weeklyRaidRewards = old })
	weeklyRaidRewards = repo
	username := fmt.Sprintf("weekly-recovery-%d", time.Now().UnixNano())
	if err := repo.CreateUser(username, username+"@example.invalid", "temporary-fixture-password"); err != nil {
		t.Fatal(err)
	}
	initial := &database.Character{Name: username, Class: "Wizard", Level: 100, Gold: 99, EP: 12,
		Inventory: make([]database.Item, game.MaxInventorySize)}
	if err := repo.CreateCharacter(username, initial); err != nil {
		t.Fatal(err)
	}
	entry, err := repo.PrepareWeeklyRaidReward("player-"+username, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	failed.fail = errors.New("injected character commit failure")
	if _, _, err := deliverWeeklyRaidReward(*entry); err == nil {
		t.Fatal("commit failure hidden")
	}
	pending, err := characterSaveJournal.Read(username)
	if err != nil || pending == nil {
		t.Fatal("journal lost reward")
	}
	planned, err := pending.Character()
	if err != nil {
		t.Fatal(err)
	}
	stored, err := repo.GetCharacter(username, username)
	if err != nil || stored.Gold != 99 || stored.WeeklyRaidRewardReceipts[entry.Week] {
		t.Fatal("failed commit mutated stored character")
	}
	characterSaveCommitter = repo
	if err := recoverPendingWeeklyRaidRewards(); err != nil {
		t.Fatal(err)
	}
	stored, err = repo.GetCharacter(username, username)
	if err != nil || stored.Gold != 15099 || stored.ResonanceXP != 1000000 || !stored.WeeklyRaidRewardReceipts[entry.Week] || stored.EP != 12 || !reflect.DeepEqual(stored.Inventory, planned.Inventory) {
		t.Fatal("recovery changed or lost exact reward", err)
	}
	// A stale pending snapshot after acknowledgement cannot pay again.
	if _, granted, err := deliverWeeklyRaidReward(*entry); err != nil || granted {
		t.Fatal("replayed entitlement paid twice", err)
	}
	if pending, err := characterSaveJournal.Read(username); err != nil || pending != nil {
		t.Fatal("committed journal remained pending")
	}
}

func TestWeeklyRaidProductionStartupRuntimeAndReconnect(t *testing.T) {
	repo := weeklyDisposableDatabase(t)
	binary := os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !filepath.IsAbs(binary) {
		t.Skip("requires built server binary")
	}
	username := fmt.Sprintf("weekly-runtime-%d", time.Now().UnixNano())
	password := username + "-fixture-password"
	if err := repo.CreateUser(username, username+"@example.invalid", password); err != nil {
		t.Fatal(err)
	}
	at := time.Now().UTC()
	week := database.CurrentRaidWeek(at)
	initial := &database.Character{Name: username, Class: "Fighter", Level: 100, Gold: 99, EP: 12,
		WeeklyRaidCompletions: map[string]time.Time{week: at},
		Inventory:             make([]database.Item, game.MaxInventorySize),
		Stats:                 database.Stats{Strength: 208, Dexterity: 109, Intelligence: 109, Wisdom: 109, Vitality: 208},
		Resources:             &database.CharacterResources{Version: 1, Health: 100, Mana: 100}}
	if err := repo.CreateCharacter(username, initial); err != nil {
		t.Fatal(err)
	}
	first := &database.WeeklyRaidLockout{PlayerID: "player-" + username, Week: week, CompletedAt: at}
	// An invalid entitlement must stay recoverable without blocking startup.
	bad, err := repo.PrepareWeeklyRaidReward("invalid-"+username, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, os.Getenv("MONGO_URI"), 1371, "-save-journal-dir", journal)
	defer stop()
	stored, err := repo.GetCharacter(username, username)
	if err != nil || stored.Gold != 15099 || !stored.WeeklyRaidRewardReceipts[first.Week] {
		t.Fatal("startup did not deliver saved entitlement", err)
	}
	conn, _ := resourceLoginCharacter(t, address, username, password, "Fighter")
	defer conn.Close()
	second, err := repo.PrepareWeeklyRaidReward("player-"+username, time.Now().UTC().Add(7*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(12 * time.Second)
	for {
		stored, err = repo.GetCharacter(username, username)
		if err != nil {
			t.Fatal(err)
		}
		if stored.WeeklyRaidRewardReceipts[second.Week] {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("runtime retry did not deliver")
		}
		time.Sleep(100 * time.Millisecond)
	}
	resourceCloseAndWait(t, repo, conn, username)
	stop()
	_, stopAgain := compatStartServer(t, binary, os.Getenv("MONGO_URI"), 1372, "-save-journal-dir", journal)
	defer stopAgain()
	stored, err = repo.GetCharacter(username, username)
	if err != nil || stored.Gold != 30099 || stored.ResonanceXP != 2000000 ||
		!stored.WeeklyRaidRewardReceipts[first.Week] || !stored.WeeklyRaidRewardReceipts[second.Week] || stored.EP != 12 {
		t.Fatal("login/disconnect/restart lost or repeated weekly rewards", err)
	}
	if claimed, err := repo.HasWeeklyRaidReward(bad.PlayerID, bad.CompletedAt); err != nil || !claimed {
		t.Fatal("bad entitlement discarded", err)
	}
}

type initialWeeklyPrepareFailure struct{ *database.DB }

func (s initialWeeklyPrepareFailure) PrepareWeeklyRaidReward(string, time.Time) (*database.WeeklyRaidLockout, error) {
	return nil, errors.New("injected initial entitlement write failure")
}

func TestWeeklyRaidMongoInitialHandoffRecoversOriginalWeek(t *testing.T) {
	repo := weeklyDisposableDatabase(t)
	setupCharacterJournalTest(t)
	old := weeklyRaidRewards
	t.Cleanup(func() { weeklyRaidRewards = old })
	characterSaveCommitter = repo
	weeklyRaidRewards = initialWeeklyPrepareFailure{repo}
	username := fmt.Sprintf("weekly-outbox-%d", time.Now().UnixNano())
	if err := repo.CreateUser(username, username+"@example.invalid", "temporary-fixture-password"); err != nil {
		t.Fatal(err)
	}
	at := time.Date(2026, 9, 27, 23, 59, 59, 0, time.UTC)
	week := database.CurrentRaidWeek(at)
	initial := &database.Character{Name: username, Class: "Wizard", Level: 100, Gold: 99,
		WeeklyRaidCompletions: map[string]time.Time{week: at}}
	if err := repo.CreateCharacter(username, initial); err != nil {
		t.Fatal(err)
	}
	entry := database.WeeklyRaidLockout{PlayerID: "player-" + username, Week: week, CompletedAt: at, DeliveryPending: true}
	if _, err := prepareRecordedWeeklyRaidCompletion(entry); err == nil {
		t.Fatal("initial outage hidden")
	}
	if claimed, err := repo.HasWeeklyRaidReward(entry.PlayerID, at); err != nil || claimed {
		t.Fatal("failed initial write was treated as claimed")
	}
	stored, err := repo.GetCharacter(username, username)
	if err != nil || !stored.WeeklyRaidCompletions[week].Equal(at) || stored.Gold != 99 {
		t.Fatal("outbox lost before entitlement reached Mongo")
	}
	weeklyRaidRewards = repo // A fresh process discovers the saved outbox.
	if err := recoverPendingWeeklyRaidRewards(); err != nil {
		t.Fatal(err)
	}
	stored, err = repo.GetCharacter(username, username)
	if err != nil || len(stored.WeeklyRaidCompletions) != 0 || !stored.WeeklyRaidRewardReceipts[week] ||
		stored.Gold != 15099 || len(stored.Inventory) != 1 || stored.ResonanceXP != 1000000 {
		t.Fatal("original-week reward did not recover", err)
	}
	if current, err := repo.HasWeeklyRaidReward(entry.PlayerID, at.Add(2*time.Second)); err != nil || current {
		t.Fatal("recovery consumed following week's reward")
	}
}
