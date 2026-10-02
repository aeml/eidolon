package main

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

type weeklyDeliveryTestStore struct {
	committer      *testCharacterCommitter
	initial        *database.Character
	entry          database.WeeklyRaidLockout
	finishError    error
	finished       int
	prepareError   error
	discoveryError error
	preparedAt     []time.Time
}

func (s *weeklyDeliveryTestStore) GetCharacter(_, _ string) (*database.Character, error) {
	source := s.initial
	if s.committer.saved != nil {
		source = s.committer.saved
	}
	data, err := bson.Marshal(source)
	if err != nil {
		return nil, err
	}
	var result database.Character
	err = bson.Unmarshal(data, &result)
	return &result, err
}
func (s *weeklyDeliveryTestStore) PrepareWeeklyRaidReward(_ string, at time.Time) (*database.WeeklyRaidLockout, error) {
	s.preparedAt = append(s.preparedAt, at)
	if s.prepareError != nil {
		return nil, s.prepareError
	}
	return &s.entry, nil
}

func TestWeeklyDeliveryDiscoversUnsavedDisconnectedCompletion(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	at := time.Date(2026, 9, 27, 23, 59, 59, 0, time.UTC)
	s.entry.Week, s.entry.CompletedAt = database.CurrentRaidWeek(at), at
	p := &game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Wizard", Level: 100, Gold: 99,
		Disconnected: true, Inventory: make([]game.Item, game.MaxInventorySize),
		WeeklyRaidCompletions: map[string]time.Time{s.entry.Week: at}}
	world.AddEntity(p)
	if len(s.initial.WeeklyRaidCompletions) != 0 {
		t.Fatal("fixture already persisted the live completion")
	}
	if err := recoverPendingWeeklyRaidRewards(); err != nil {
		t.Fatal(err)
	}
	copy := world.GetEntityCopy(p.ID)
	if s.finished != 1 || len(s.preparedAt) != 1 || !s.preparedAt[0].Equal(at) ||
		copy.Gold != 15099 || len(copy.WeeklyRaidCompletions) != 0 || !copy.WeeklyRaidRewardReceipts[s.entry.Week] ||
		s.committer.saved.Gold != 15099 || !s.committer.saved.WeeklyRaidRewardReceipts[s.entry.Week] {
		t.Fatal("unsaved disconnected outbox missed delivery, changed kill week or lost the durable receipt")
	}
	if err := recoverPendingWeeklyRaidRewards(); err != nil || s.finished != 1 || world.GetEntityCopy(p.ID).Gold != 15099 {
		t.Fatal("later recovery paid the completion again", err)
	}
}

type expiringWeeklyDeliveryStore struct {
	*weeklyDeliveryTestStore
}

func (s *expiringWeeklyDeliveryStore) PrepareWeeklyRaidReward(playerID string, at time.Time) (*database.WeeklyRaidLockout, error) {
	entry, err := s.weeklyDeliveryTestStore.PrepareWeeklyRaidReward(playerID, at)
	world.RemoveEntity(playerID)
	return entry, err
}

func TestWeeklyDeliveryExpiryDuringPreparationRecoversOffline(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	weeklyRaidRewards = &expiringWeeklyDeliveryStore{s}
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	at := time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC)
	s.entry.CompletedAt = at
	world.AddEntity(&game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Wizard", Level: 100, Gold: 99,
		Inventory: make([]game.Item, game.MaxInventorySize), WeeklyRaidCompletions: map[string]time.Time{s.entry.Week: at}})
	if err := recoverPendingWeeklyRaidRewards(); err == nil {
		t.Fatal("expiry during live preparation was hidden")
	}
	if s.finished != 1 || s.committer.saved.Gold != 15099 || !s.committer.saved.WeeklyRaidRewardReceipts[s.entry.Week] {
		t.Fatal("recorded entitlement lost offline delivery after expiry")
	}
	if err := recoverPendingWeeklyRaidRewards(); err != nil || s.finished != 1 || s.committer.saved.Gold != 15099 ||
		len(s.committer.saved.WeeklyRaidCompletions) != 0 {
		t.Fatal("offline retry lost the completion or repeated its reward", err)
	}
}
func (s *weeklyDeliveryTestStore) UnpreparedWeeklyRaidRewards() ([]database.WeeklyRaidLockout, error) {
	if s.discoveryError != nil {
		return nil, s.discoveryError
	}
	character, err := s.GetCharacter("hero", "hero")
	if err != nil {
		return nil, err
	}
	var entries []database.WeeklyRaidLockout
	for week, at := range character.WeeklyRaidCompletions {
		entries = append(entries, database.WeeklyRaidLockout{PlayerID: "player-hero", Week: week, CompletedAt: at, DeliveryPending: true})
	}
	return entries, nil
}
func (s *weeklyDeliveryTestStore) PendingWeeklyRaidRewards() ([]database.WeeklyRaidLockout, error) {
	if s.entry.DeliveryPending {
		return []database.WeeklyRaidLockout{s.entry}, nil
	}
	return nil, nil
}
func (s *weeklyDeliveryTestStore) FinishWeeklyRaidReward(string, string) error {
	if s.finishError != nil {
		return s.finishError
	}
	s.finished++
	s.entry.DeliveryPending = false
	return nil
}

func (s *weeklyDeliveryTestStore) DeferWeeklyRaidReward(string, string, time.Time) error { return nil }

type mixedWeeklyDeliveryStore struct {
	*weeklyDeliveryTestStore
	deferred []string
}

func (s *mixedWeeklyDeliveryStore) PendingWeeklyRaidRewards() ([]database.WeeklyRaidLockout, error) {
	return []database.WeeklyRaidLockout{{PlayerID: "malformed", Week: "2026-W40", DeliveryPending: true}, s.entry}, nil
}
func (s *mixedWeeklyDeliveryStore) DeferWeeklyRaidReward(playerID, _ string, _ time.Time) error {
	s.deferred = append(s.deferred, playerID)
	return nil
}

func TestWeeklyDeliveryBadRecipientDoesNotBlockHealthyRecipient(t *testing.T) {
	s := &mixedWeeklyDeliveryStore{weeklyDeliveryTestStore: setupWeeklyDeliveryTest(t)}
	weeklyRaidRewards = s
	if err := recoverPendingWeeklyRaidRewards(); err == nil {
		t.Fatal("invalid recipient failure hidden")
	}
	if s.finished != 1 || s.committer.saved == nil || s.committer.saved.Gold != 15099 || !reflect.DeepEqual(s.deferred, []string{"malformed"}) {
		t.Fatal("invalid first recipient starved the healthy reward or was discarded")
	}
}

func TestWeeklyDeliveryOutboxFailureDoesNotBlockRecordedEntitlement(t *testing.T) {
	for _, stage := range []string{"discovery", "prepare"} {
		t.Run(stage, func(t *testing.T) {
			s := setupWeeklyDeliveryTest(t)
			failure := errors.New("initial completion handoff unavailable")
			at := time.Date(2026, 9, 27, 12, 0, 0, 0, time.UTC)
			s.initial.WeeklyRaidCompletions = map[string]time.Time{database.CurrentRaidWeek(at): at}
			if stage == "discovery" {
				s.discoveryError = failure
			} else {
				s.prepareError = failure
			}
			if err := recoverPendingWeeklyRaidRewards(); !errors.Is(err, failure) {
				t.Fatal("outbox failure was hidden", err)
			}
			if s.finished != 1 || s.committer.saved == nil || s.committer.saved.Gold != 15099 ||
				!s.committer.saved.WeeklyRaidRewardReceipts[s.entry.Week] ||
				len(s.committer.saved.WeeklyRaidCompletions) != 1 {
				t.Fatal("initial handoff blocked an existing entitlement or discarded its retry intent")
			}
		})
	}
}

func setupWeeklyDeliveryTest(t *testing.T) *weeklyDeliveryTestStore {
	t.Helper()
	_, committer := setupCharacterJournalTest(t)
	old := weeklyRaidRewards
	t.Cleanup(func() { weeklyRaidRewards = old })
	store := &weeklyDeliveryTestStore{committer: committer,
		initial: &database.Character{Name: "hero", Level: 100, Gold: 99, EP: 42,
			Inventory:   make([]database.Item, game.MaxInventorySize),
			ResonanceXP: game.ResonanceXPPerLevel - 10, Resources: &database.CharacterResources{Version: 1, Health: 123, Mana: 17}},
		entry: database.WeeklyRaidLockout{PlayerID: "player-hero", Week: "2026-W40", DeliveryPending: true}}
	weeklyRaidRewards = store
	return store
}

func TestWeeklyDeliverySavesDisconnectedCharacterAndReceiptTogether(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	r, granted, err := deliverWeeklyRaidReward(s.entry)
	if err != nil || !granted || s.finished != 1 {
		t.Fatalf("delivery failed: %v %+v", err, r)
	}
	saved := s.committer.saved
	if saved.Gold != 15099 || !saved.WeeklyRaidRewardReceipts[s.entry.Week] || saved.Inventory[0].ID == "" ||
		saved.ResonanceLevel != 1 || saved.ResonancePoints != 1 || saved.ResonanceXP != 999990 ||
		saved.EP != 42 || !reflect.DeepEqual(saved.Resources, s.initial.Resources) {
		t.Fatal("grant/receipt lost or unrelated resources changed")
	}
}

func TestWeeklyDeliveryRecoversFailedCharacterSaveWithoutDoubleGrant(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	s.committer.fail = errors.New("database write unavailable")
	if _, _, err := deliverWeeklyRaidReward(s.entry); err == nil || s.finished != 0 {
		t.Fatal("failed save acknowledged entitlement")
	}
	pending, err := characterSaveJournal.Read("hero")
	if err != nil || pending == nil {
		t.Fatal("reward did not reach existing durable journal")
	}
	planned, err := pending.Character()
	if err != nil {
		t.Fatal(err)
	}
	// Lost process memory: recovery must use the recorded roll and receipt.
	failedCharacterSaves.users = make(map[string]bool)
	s.committer.fail = nil
	if err := recoverPendingWeeklyRaidRewards(); err != nil {
		t.Fatal(err)
	}
	if s.finished != 1 || !reflect.DeepEqual(s.committer.saved, planned) {
		t.Fatal("retry changed or duplicated the recorded reward")
	}
}

func TestWeeklyDeliveryLostAcknowledgementDoesNotRerollOrPayAgain(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	s.finishError = errors.New("acknowledgement lost")
	if _, _, err := deliverWeeklyRaidReward(s.entry); err == nil {
		t.Fatal("ack failure hidden")
	}
	saved := s.committer.saved
	s.finishError = nil
	if err := recoverPendingWeeklyRaidRewards(); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(saved, s.committer.saved) || s.finished != 1 || len(s.committer.ids) != 1 {
		t.Fatal("acknowledgement retry replaced or repeated the saved grant")
	}
}

func TestWeeklyDeliveryWorldReceiptSurvivesDisconnectAndClone(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	p := &game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Wizard", Level: 100, Gold: 99,
		Inventory: make([]game.Item, game.MaxInventorySize)}
	world.AddEntity(p)
	s.finishError = errors.New("acknowledgement lost")
	if _, _, err := deliverWeeklyRaidReward(s.entry); err == nil {
		t.Fatal("ack failure hidden")
	}
	copy := world.GetEntityCopy(p.ID)
	if !copy.WeeklyRaidRewardReceipts[s.entry.Week] {
		t.Fatal("snapshot dropped receipt")
	}
	copy.WeeklyRaidRewardReceipts[s.entry.Week] = false
	if !world.GetEntityCopy(p.ID).WeeklyRaidRewardReceipts[s.entry.Week] {
		t.Fatal("snapshot aliases live receipts")
	}
	world = nil // Simulate restart/disconnect after durable character save.
	saved := s.committer.saved
	s.finishError = nil
	if err := recoverPendingWeeklyRaidRewards(); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(saved, s.committer.saved) || saved.Gold != 15099 {
		t.Fatal("reconnect repeated reward")
	}
}

func TestWeeklyDeliveryUnderlevelRemainsPending(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	s.initial.Level = 99
	if _, _, err := deliverWeeklyRaidReward(s.entry); err == nil || s.finished != 0 || s.committer.saved != nil {
		t.Fatal("ineligible recipient silently consumed reward")
	}
}

func TestWeeklyDeliveryConcurrentCompletionPaysOnce(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	entry := s.entry
	results := make(chan error, 12)
	for i := 0; i < cap(results); i++ {
		go func() {
			_, _, err := deliverWeeklyRaidReward(entry)
			results <- err
		}()
	}
	for i := 0; i < cap(results); i++ {
		if err := <-results; err != nil {
			t.Fatal(err)
		}
	}
	if s.committer.saved.Gold != 15099 || s.committer.saved.ResonanceXP != 999990 || len(s.committer.ids) != 1 {
		t.Fatal("concurrent completion repeated weekly grant")
	}
}

func TestWeeklyDeliveryOfflineGoldSourceRecordedOnce(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	s.finishError = errors.New("acknowledgement lost")
	if _, _, err := deliverWeeklyRaidReward(s.entry); err == nil {
		t.Fatal("ack failure hidden")
	}
	s.finishError = nil
	if _, _, err := deliverWeeklyRaidReward(s.entry); err != nil {
		t.Fatal(err)
	}
	if got := world.Economy.Drain(time.Now()).Sources["weekly_raid"]; got != 15000 {
		t.Fatalf("offline weekly source = %d, want 15000", got)
	}
}

func TestWeeklyCompletionOutboxSurvivesInitialWriteFailure(t *testing.T) {
	for _, failure := range []string{"character commit", "entitlement prepare"} {
		t.Run(failure, func(t *testing.T) {
			s := setupWeeklyDeliveryTest(t)
			world = game.NewWorld(nil)
			t.Cleanup(world.StopBackground)
			at := time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC)
			s.entry.CompletedAt = at
			p := &game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Wizard", Level: 100, Gold: 99,
				Inventory: make([]game.Item, game.MaxInventorySize), WeeklyRaidCompletions: map[string]time.Time{s.entry.Week: at}}
			world.AddEntity(p)
			if failure == "character commit" {
				s.committer.fail = errors.New("database offline")
			} else {
				s.prepareError = errors.New("lockout collection unavailable")
			}
			if _, err := prepareRecordedWeeklyRaidCompletion(s.entry); err == nil {
				t.Fatal("initial failure hidden")
			}
			pending, err := characterSaveJournal.Read("hero")
			if err != nil {
				t.Fatal(err)
			}
			var recorded *database.Character
			if pending != nil {
				recorded, err = pending.Character()
			} else {
				recorded = s.committer.saved
			}
			if err != nil || recorded == nil || !recorded.WeeklyRaidCompletions[s.entry.Week].Equal(at) || recorded.Gold != 99 {
				t.Fatal("initial failure lost completion or granted before eligibility")
			}
			world = nil // Abrupt process-memory loss after the first durable write.
			failedCharacterSaves.users = make(map[string]bool)
			s.committer.fail, s.prepareError = nil, nil
			if err := retryPendingCharacterSaves(); err != nil {
				t.Fatal(err)
			}
			if err := recoverPendingWeeklyRaidRewards(); err != nil {
				t.Fatal(err)
			}
			if s.committer.saved.Gold != 15099 || !s.committer.saved.WeeklyRaidRewardReceipts[s.entry.Week] || len(s.committer.saved.WeeklyRaidCompletions) != 0 {
				t.Fatal("recovery did not consume outbox and grant exactly once")
			}
			if err := recoverPendingWeeklyRaidRewards(); err != nil || s.committer.saved.Gold != 15099 {
				t.Fatal("replay repeated reward", err)
			}
		})
	}
}
