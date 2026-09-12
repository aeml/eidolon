package game

import (
	"math"
	"testing"
)

func TestVerdantBossBudgetFitsIntroductoryPartyExpeditions(t *testing.T) {
	for _, tc := range []struct {
		name   string
		health int
	}{{"RootboundWarden", 9000}, {"BriarMatron", 10080}, {"RustboundColossus", 11250}, {"HollowSentinel", 13050}} {
		t.Run(tc.name, func(t *testing.T) {
			profile := dungeonEnemyCombatProfile(tc.name, 30, DifficultyNormal, dungeonRankBoss, 2.5)
			if profile.MaxHealth != tc.health || profile.Health != tc.health {
				t.Fatalf("entry party health budget=%d/%d, want %d", profile.Health, profile.MaxHealth, tc.health)
			}
		})
	}
}

// This verifies scope and scaling, not a simulated dungeon clear. Real party
// combat, resource consumption and subsequent boss progression remain gates.
func TestVerdantBudgetPreservesDamageOtherFamiliesAndDifficultyScaling(t *testing.T) {
	verdant := map[string]bool{"RootboundWarden": true, "BriarMatron": true, "RustboundColossus": true, "HollowSentinel": true}
	for _, level := range []int{30, 60, 70, 100} {
		for name, balance := range dungeonBossBalances {
			for _, difficulty := range []DungeonDifficulty{DifficultyNormal, DifficultyHeroic, DifficultyMythic} {
				hpScale, damageScale, _, _ := DifficultyMultipliers(difficulty)
				base := balancedEnemyBaseStats(level)
				healthScale := dungeonBossHealthMultiplier * balance.HealthMultiplier * hpScale
				if verdant[name] {
					healthScale *= .6
				}
				wantHP := int(math.Round(float64(base.Vitality)*healthScale)) * 10
				wantDamage := int(math.Round(float64(base.Strength)*dungeonBossDamageMultiplier*balance.DamageMultiplier*damageScale)) * 2
				profile := dungeonEnemyCombatProfile(name, level, difficulty, dungeonRankBoss, 2.5)
				if profile.MaxHealth != wantHP || profile.Damage != wantDamage || profile.Speed != 2.5 {
					t.Errorf("%s level%d difficulty%s: hp%d damage%d speed%g; want hp%d damage%d speed2.5", name, level, difficulty, profile.MaxHealth, profile.Damage, profile.Speed, wantHP, wantDamage)
				}
			}
		}
		for _, rank := range []dungeonEnemyRank{dungeonRankTrash, dungeonRankElite} {
			healthScale, damageScale := dungeonRankMultipliers(rank)
			want := enemyProfileFromStats(balancedEnemyStats("Skeleton", level, healthScale, damageScale), 3)
			got := dungeonEnemyCombatProfile("Skeleton", level, DifficultyNormal, rank, 3)
			if got != want {
				t.Errorf("changed trash/elite level%d rank%d", level, rank)
			}
		}
	}
}
