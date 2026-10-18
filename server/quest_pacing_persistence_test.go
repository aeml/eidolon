package main

import (
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestPostBastionRewardRebalanceBSONClaimAndReload(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Cleric", "Wizard"} {
		for _, carry := range []int{0, game.ExperienceRequiredForLevel(30) - 1} {
			t.Run(fmt.Sprintf("%s/carry%d", class, carry), func(t *testing.T) {
				raw, err := bson.Marshal(bson.M{"id": "chronicle_water_missing_ferry", "type": "KILL", "target": "ChronicleHunt:chronicle_water_missing_ferry", "category": "chronicle", "accepted": true, "legacy_optional": true, "count": 60, "max_count": 60, "reward_xp": 200000, "reward_gold": 71})
				if err != nil {
					t.Fatal(err)
				}
				var old database.Quest
				if err := bson.Unmarshal(raw, &old); err != nil {
					t.Fatal(err)
				}
				p := newLevelCommandPlayer("pacing-save-" + class)
				p.SubType = class
				p.Level, p.Experience, p.MaxExperience = 30, carry, game.ExperienceRequiredForLevel(30)
				p.X, p.Z, p.Gold = 20, 215, 731
				p.Quests = []game.Quest{questFromDatabase(old)}
				w := game.NewWorld(nil)
				t.Cleanup(w.StopBackground)
				w.AddEntity(p)
				w.GenerateDailyQuests(p.ID)
				quote := p.Quests[0]
				if quote.RewardXP != 28593 || quote.RewardGold != 71 || quote.Count != 60 || !quote.Accepted || quote.Completed {
					t.Fatalf("incorrect unpaid migration: %+v", quote)
				}
				if p.Level != 30 || p.Experience != carry || p.Gold != 731 {
					t.Fatal("refresh changed earned progression")
				}
				// The corrected quote is persisted and shown before the normal claim.
				encoded, err := bson.Marshal(characterSnapshot("pacing-save", p, time.Now()))
				if err != nil {
					t.Fatal(err)
				}
				var saved database.Character
				if err := bson.Unmarshal(encoded, &saved); err != nil {
					t.Fatal(err)
				}
				p.Quests = nil
				for _, q := range saved.Quests {
					p.Quests = append(p.Quests, questFromDatabase(q))
				}
				if _, ok := w.PerformCompleteQuest(p.ID, quote.ID); !ok {
					t.Fatal("saved ready quest could not be claimed")
				}
				receipt := p.Quests[0]
				if p.Level > 32 || !receipt.Completed || receipt.GrantedXP != 28593 || receipt.GrantedGold != 71 || p.Gold != 802 {
					t.Fatalf("incorrect bounded claim: level=%d receipt=%+v", p.Level, receipt)
				}
				encoded, err = bson.Marshal(characterSnapshot("pacing-save", p, time.Now()))
				if err != nil {
					t.Fatal(err)
				}
				if err := bson.Unmarshal(encoded, &saved); err != nil {
					t.Fatal(err)
				}
				p.Quests = nil
				for _, q := range saved.Quests {
					p.Quests = append(p.Quests, questFromDatabase(q))
				}
				w.GenerateDailyQuests(p.ID)
				if !reflect.DeepEqual(p.Quests[0], receipt) {
					t.Fatal("paid historical receipt changed on reload")
				}
				if _, ok := w.PerformCompleteQuest(p.ID, quote.ID); ok || p.Gold != 802 {
					t.Fatal("reloaded receipt paid twice")
				}
			})
		}
	}
}
