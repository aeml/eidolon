package main

import (
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

// A combined durable-data regression, not an earned-gameplay or socket test.
func TestExpandedStoryMigrationRetainsRestResourcesAndAcceptedTerms(t *testing.T) {
	for _, class := range []string{"Wizard", "Fighter", "Rogue", "Cleric"} {
		for _, dead := range []bool{false, true} {
			name := class + "/living"
			if dead {
				name = class + "/dead"
			}
			t.Run(name, func(t *testing.T) {
				health := 1
				if dead {
					health = 0
				}
				saved := database.Character{Name: "combined-save", Class: class, Level: 30,
					XP: 9890, ProgressionVersion: 1, Gold: 732, LastDailyQuest: time.Now().UTC(),
					Stats:      database.Stats{Strength: 10, Intelligence: 10, Dexterity: 10, Wisdom: 10, Vitality: 10},
					WellRested: &database.CharacterWellRested{Version: 1, RemainingSeconds: 123.456789},
					Resources:  &database.CharacterResources{Version: 1, Health: health, Mana: 0, Dead: dead},
					Quests: []database.Quest{
						{ID: "chronicle_01_bell_below", Type: "KILL", Category: "chronicle", Count: 3, MaxCount: 3,
							Accepted: true, Completed: true, RewardXP: 500, RewardGold: 100, GrantedXP: 500, GrantedGold: 100},
						{ID: "chronicle_02_seeds_first_grove", Type: "COLLECT", Category: "chronicle", Count: 3, MaxCount: 5,
							Accepted: true, CollectionVersion: 1, RewardXP: 8000, RewardGold: 100},
						{ID: "chronicle_earth_keepers_house", Type: "INVESTIGATE", Category: "chronicle", Count: 1, MaxCount: 1,
							Accepted: true, LegacyOptional: true, InvestigationMask: 1, RewardXP: 0, RewardGold: 0},
					}}
				// Compare economic/progress fields independently of refreshed authored prose.
				terms := func(quests []database.Quest) map[string][11]int {
					result := map[string][11]int{}
					for _, q := range quests {
						if q.ID != "chronicle_01_bell_below" && q.ID != "chronicle_02_seeds_first_grove" && q.ID != "chronicle_earth_keepers_house" {
							continue
						}
						flag := func(value bool) int {
							if value {
								return 1
							}
							return 0
						}
						result[q.ID] = [11]int{q.Count, q.MaxCount, q.RewardXP, q.RewardGold, q.GrantedXP, q.GrantedGold,
							q.CollectionVersion, int(q.InvestigationMask), flag(q.Accepted), flag(q.Completed), flag(q.LegacyOptional)}
					}
					return result
				}
				originalTerms, originalStats := terms(saved.Quests), saved.Stats
				journal, err := database.OpenCharacterSaveJournal(t.TempDir())
				if err != nil {
					t.Fatal(err)
				}
				for repeat := 0; repeat < 3; repeat++ {
					encoded, err := bson.Marshal(saved)
					if err != nil {
						t.Fatal(err)
					}
					if err := bson.Unmarshal(encoded, &saved); err != nil {
						t.Fatal(err)
					}
					progress, err := game.MigrateSavedProgression(saved.Level, saved.XP, saved.ProgressionVersion)
					if err != nil {
						t.Fatal(err)
					}
					if progress.Level != 30 || progress.XP != 10561 || progress.PendingLevels != 0 {
						t.Fatal("curve migration changed earned progress", progress)
					}
					p := &game.Entity{ID: saved.Name, Type: game.TypePlayer, SubType: class, Gold: saved.Gold,
						LastDailyQuest: saved.LastDailyQuest, BaseStats: game.Stats{Strength: saved.Stats.Strength,
							Intelligence: saved.Stats.Intelligence, Dexterity: saved.Stats.Dexterity, Wisdom: saved.Stats.Wisdom, Vitality: saved.Stats.Vitality}}
					for _, q := range saved.Quests {
						p.Quests = append(p.Quests, questFromDatabase(q))
					}
					p.ApplySavedProgression(progress)
					if err := restoreCharacterWellRested(p, saved.WellRested); err != nil {
						t.Fatal(err)
					}
					p.RecalculateStats()
					if err := restoreCharacterResources(p, saved.Resources); err != nil {
						t.Fatal(err)
					}
					w := game.NewWorld(nil)
					w.AddEntity(p)
					w.GenerateDailyQuests(p.ID)
					w.StopBackground()
					if p.Health != health || p.Mana != 0 || (p.State == "DEAD") != dead || p.WellRestedSeconds != 123.456789 {
						t.Fatal("catalog/migration restored resources or changed earned rest")
					}
					snapshot := characterSnapshot(saved.Name, p, time.Now().UTC())
					if snapshot.ProgressionVersion != 2 || snapshot.Gold != 732 || snapshot.Stats != originalStats || !reflect.DeepEqual(terms(snapshot.Quests), originalTerms) {
						t.Fatal("catalog refresh changed base stats, currency, accepted terms or receipts", terms(snapshot.Quests))
					}
					pending, err := journal.Write(saved.Name, snapshot)
					if err != nil {
						t.Fatal(err)
					}
					loaded, err := pending.Character()
					if err != nil {
						t.Fatal(err)
					}
					saved = *loaded
				}
			})
		}
	}
}
