package main

import (
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestBridgeRetainsFutureStoryRecordsAndZeroQuotesAcrossSaveAndRefresh(t *testing.T) {
	// Unknown future content must round-trip unchanged, including optional status
	// and evidence already read. The Earth diary/Watch are now known definitions;
	// use genuinely unknown IDs to retain this forward-compatibility contract.
	future := []database.Quest{
		{ID: "chronicle_future_keepers_house", Type: "INVESTIGATE", Category: "chronicle",
			Chapter: 2, Accepted: true, Count: 1, MaxCount: 1, InvestigationMask: 1,
			LegacyOptional: true, RewardXP: 200, RewardGold: 25, Title: "The Keeper's Empty House"},
		{ID: "chronicle_future_kept_watch", Type: "KILL", Category: "chronicle", Chapter: 3,
			Target: "ChronicleHunt:chronicle_future_kept_watch", Accepted: true, Count: 12, MaxCount: 40,
			LegacyOptional: true, RewardXP: 1593, RewardGold: 100, Title: "Those Who Kept the Watch"},
		{ID: "daily_skeleton", Type: "KILL", Category: "daily", Accepted: true,
			Count: 3, MaxCount: 12, RewardXP: 0, RewardGold: 0},
	}
	encoded, err := bson.Marshal(database.Character{Name: "bridge-records", Class: "Wizard",
		Level: 30, XP: 10562, ProgressionVersion: 2, Gold: 731, SkillPoints: 2,
		Quests: future, LastDailyQuest: time.Now().UTC()})
	if err != nil {
		t.Fatal(err)
	}
	var saved database.Character
	if err := bson.Unmarshal(encoded, &saved); err != nil {
		t.Fatal(err)
	}
	progress, err := game.MigrateSavedProgression(saved.Level, saved.XP, saved.ProgressionVersion)
	if err != nil {
		t.Fatal(err)
	}
	p := &game.Entity{ID: "bridge-records", Type: game.TypePlayer, SubType: "Wizard",
		Gold: saved.Gold, SkillPoints: saved.SkillPoints, LastDailyQuest: saved.LastDailyQuest}
	for _, q := range saved.Quests {
		p.Quests = append(p.Quests, questFromDatabase(q))
	}
	p.ApplySavedProgression(progress)
	expectedFuture := append([]game.Quest(nil), p.Quests[:2]...)
	w := game.NewWorld(nil)
	w.AddEntity(p)
	for repeat := 0; repeat < 3; repeat++ {
		w.GenerateDailyQuests(p.ID)
		for _, expected := range expectedFuture {
			found := false
			for _, actual := range p.Quests {
				if actual.ID == expected.ID {
					found = true
					if !reflect.DeepEqual(actual, expected) {
						t.Fatalf("future record rewritten: %+v", actual)
					}
				}
			}
			if !found {
				t.Fatalf("future record lost: %s", expected.ID)
			}
		}
		for _, q := range p.Quests {
			if q.ID == "daily_skeleton" && (q.RewardXP != 0 || q.RewardGold != 0 || q.MaxCount != 12 || q.Count != 3) {
				t.Fatalf("accepted zero contract rewritten during rollback: %+v", q)
			}
		}
		snapshot := characterSnapshot("bridge-records", p, time.Now().UTC())
		encoded, err = bson.Marshal(snapshot)
		if err != nil {
			t.Fatal(err)
		}
		if err := bson.Unmarshal(encoded, &saved); err != nil {
			t.Fatal(err)
		}
		if saved.ProgressionVersion != game.CurrentProgressionVersion || saved.Gold != 731 || saved.SkillPoints != 2 {
			t.Fatal("bridge snapshot changed earned state or omitted active curve version")
		}
		again, err := game.MigrateSavedProgression(saved.Level, saved.XP, saved.ProgressionVersion)
		if err != nil || again != progress {
			t.Fatalf("rollback converted twice: %+v / %v", again, err)
		}
		p.Quests = nil
		for _, q := range saved.Quests {
			p.Quests = append(p.Quests, questFromDatabase(q))
		}
	}
}
