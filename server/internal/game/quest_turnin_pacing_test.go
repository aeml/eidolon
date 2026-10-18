package game

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
)

func TestEveryStoryQuestUsesProportionalContentRewards(t *testing.T) {
	for _, q := range chronicleQuestCatalog() {
		level, percent, ok := chronicleRewardTerms(q.ID)
		if !ok {
			t.Fatalf("unbudgeted quest %s", q.ID)
		}
		if q.RewardXP != experienceRequiredForLevel(level)*percent/100 {
			t.Fatalf("wrong proportion: %+v", q)
		}
		ordinary := q.Type == "INVESTIGATE" || q.Type == "COLLECT" || strings.HasPrefix(q.Target, "ChronicleHunt:") || strings.HasPrefix(q.Target, "DarkRealmHunt:")
		expectedPercent := 125
		if ordinary {
			expectedPercent = 75
		}
		if q.ID == "chronicle_01_bell_below" {
			expectedPercent = 100
		}
		if q.ID == ChronicleDarkKingID {
			expectedPercent = 175
		}
		if percent != expectedPercent {
			t.Fatalf("quest %s pays %d%%, want %d%%", q.ID, percent, expectedPercent)
		}

		t.Logf("QUEST_REWARD id=%s content_level=%d percent=%d xp=%d", q.ID, level, percent, q.RewardXP)
	}
}

func TestEveryQuestAwardAdvancesAtMostTwoLevels(t *testing.T) {
	w := newTestWorld()
	for _, q := range append(chronicleQuestCatalog(), dailyQuestCatalog()...) {
		for level := 1; level < MaxPlayerLevel; level++ {
			for _, carry := range []int{0, experienceRequiredForLevel(level) / 2, experienceRequiredForLevel(level) - 1} {
				p := newTestPlayer("bounded-quest", "Wizard")
				p.Level, p.Experience, p.MaxExperience = level, carry, experienceRequiredForLevel(level)
				quote := q
				boundQuestExperience(p, &quote)
				w.awardQuestRewardsLocked(p, &quote)
				if p.Level-level > 2 || quote.GrantedXP+quote.GrantedResonanceXP != quote.RewardXP {
					t.Fatalf("quest=%s start=%d carry=%d end=%d receipt=%+v", q.ID, level, carry, p.Level, quote)
				}
			}
		}
	}
}

func TestPostBastionLegacyTurnInsCannotSkipEnemyBands(t *testing.T) {
	for _, id := range []string{ChronicleEarthDungeonID, "chronicle_water_missing_ferry", "chronicle_water_flood_shelter", "chronicle_water_snow_debts", ChronicleWaterDungeonID} {
		t.Run(id, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("post-bastion", "Fighter")
			p.Level, p.Experience, p.MaxExperience = 30, experienceRequiredForLevel(30)-1, experienceRequiredForLevel(30)
			p.X, p.Z = 20, 215
			for _, definition := range chronicleQuestCatalog() {
				q := definition
				q.Accepted, q.Completed, q.Count = true, true, q.MaxCount
				if q.ID == id {
					q.Completed = false
					q.RewardXP = 2_000_000
					p.Quests = append(p.Quests, q)
					break
				}
				p.Quests = append(p.Quests, q)
			}
			w.AddEntity(p)
			// Direct claim exercises reconciliation without relying on a login refresh.
			if _, ok := w.PerformCompleteQuest(p.ID, id); !ok {
				t.Fatal("ready saved quest failed")
			}
			q := *questByID(t, p, id)
			if p.Level > 32 || !q.Completed || q.GrantedXP != q.RewardXP {
				t.Fatalf("oversized saved payout: level=%d quest=%+v", p.Level, q)
			}
			beforeXP, beforeGold := p.Experience, p.Gold
			if _, ok := w.PerformCompleteQuest(p.ID, id); ok || p.Experience != beforeXP || p.Gold != beforeGold {
				t.Fatal("replayed quest paid twice")
			}
			t.Logf("POST_BASTION id=%s level=30->%d xp=%d", id, p.Level, q.GrantedXP)
		})
	}
}

func TestQuestExperienceSafetyPreservesPaidAndCappedRecords(t *testing.T) {
	for _, level := range []int{1, 30, 99, 100} {
		for _, completed := range []bool{false, true} {
			p := &Entity{Level: level}
			q := Quest{Completed: completed, RewardXP: 9_000_000, GrantedXP: 3, GrantedGold: 4, GrantedResonanceXP: 5}
			before := q
			changed := boundQuestExperience(p, &q)
			if completed || level == 100 {
				if changed || !reflect.DeepEqual(q, before) {
					t.Fatal("historical/cap reward changed", fmt.Sprint(level, completed))
				}
			}
			if q.GrantedXP != 3 || q.GrantedGold != 4 || q.GrantedResonanceXP != 5 {
				t.Fatal("receipt rewritten")
			}
		}
	}
}

func TestFreshDailyContractsUseProportionalFieldRewardsAndBoundedDungeonBonuses(t *testing.T) {
	dungeons := map[string]int{"DungeonBoss": 30, "VerdantBastionBoss": 30, "AbyssalWellBoss": 60, "MoltenCoreBoss": 70, "TempestSpireBoss": 70, "DungeonBossHeroic": 100, "DungeonBossMythic": 100}
	for _, q := range dailyQuestCatalog() {
		if level, ordinary := dailyHuntContentLevels[q.Target]; ordinary {
			if q.RewardXP != contentExperiencePercent(level, 75) {
				t.Fatalf("disproportionate field contract %s: %+v", q.ID, q)
			}
			continue
		}
		// Overlapping boss contracts are supplementary bonuses. Their actual
		// combined payout is covered by the four-boss production receipt audit.
		level := dungeons[q.Target]
		if level == 0 || q.RewardXP <= 0 || q.RewardXP > contentExperiencePercent(level, 125) {
			t.Fatalf("unbounded dungeon bonus %s: %+v", q.ID, q)
		}
	}
}
