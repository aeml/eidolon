package game

import (
	"math"
	"testing"
)

func TestEnemyBalanceKeepsStarterSkeletonAsTheExactAnchor(t *testing.T) {
	profile := overworldEnemyCombatProfile("Skeleton", 10, false)
	if profile.BaseStats != (Stats{Strength: 15, Dexterity: 9, Intelligence: 6, Wisdom: 6, Vitality: 15}) {
		t.Fatalf("starter Skeleton stats changed: %+v", profile.BaseStats)
	}
	if profile.MaxHealth != 150 || profile.Damage != 30 {
		t.Fatalf("starter Skeleton combat changed: health=%d damage=%d", profile.MaxHealth, profile.Damage)
	}
	if math.Abs(profile.AttackSpeed-(5.0/1.18)) > 0.000001 {
		t.Fatalf("starter Skeleton attack timing changed: %.6f", profile.AttackSpeed)
	}
}

func TestEveryOverworldFamilyFitsPostSquishGearBands(t *testing.T) {
	// The medium profile is the measured average primary-stat budget from a
	// same-level mixed uncommon/rare set across all 14 equipment slots. Low is
	// naked class progression. Top uses the *minimum* primary-stat share that
	// every same-level legendary item is guaranteed to carry, across all 14
	// slots, at potency +10 (2x stats). Fireball is used as a stable single-
	// target yardstick—the complete class kits retain their own faster/slower
	// rotational identities.
	testCases := []struct {
		subType string
		level   int
	}{
		{"Imp", 20},
		{"DemonOrc", 30},
		{"Construct", 40},
		{"InfernoTitan", 50},
		{"MountainTroll", 52},
		{"AquaGolem", 57},
		{"Siren", 62},
		{"FrostGuardian", 67},
		{"SandstormDjinn", 70},
		{"MagmaGolem", 75},
		{"ScorchedWraith", 80},
		{"InfernalBehemoth", 85},
		{"PhoenixSentinel", 90},
		{"StormHarpy", 70},
		{"CloudElemental", 75},
		{"ThunderRoc", 80},
		{"TempestGiant", 85},
		{"CycloneAvatar", 90},
	}

	for _, testCase := range testCases {
		t.Run(testCase.subType, func(t *testing.T) {
			profile := overworldEnemyCombatProfile(testCase.subType, testCase.level, false)
			basePrimary := canonicalBaseStatsForClass("Wizard").Intelligence + testCase.level - 1
			lowHit := 20 + basePrimary*2
			mediumPrimary := basePrimary + int(math.Round(1.75*float64(testCase.level)))
			mediumHit := 20 + mediumPrimary*2
			// A legendary's weakest guaranteed primary-stat share is 0.2 per
			// item level after the 25x squish: 14 slots * 0.2 * 2x potency.
			topPrimary := basePrimary + int(math.Round(5.6*float64(testCase.level)))
			topHit := 20 + topPrimary*2

			lowHits := hitsToDefeat(profile.MaxHealth, lowHit)
			mediumHits := hitsToDefeat(profile.MaxHealth, mediumHit)
			topHits := hitsToDefeat(profile.MaxHealth, topHit)
			if lowHits < 4 || lowHits <= mediumHits {
				t.Fatalf("low gear should struggle more than medium: health=%d low=%d medium=%d", profile.MaxHealth, lowHits, mediumHits)
			}
			if mediumHits < 3 || mediumHits > 7 {
				t.Fatalf("medium gear left the 3-7 hit target: health=%d hit=%d count=%d", profile.MaxHealth, mediumHit, mediumHits)
			}
			if topHits > 3 {
				t.Fatalf("optimized legendary gear should be easy: health=%d hit=%d count=%d", profile.MaxHealth, topHit, topHits)
			}

			lowHealth := (10+(testCase.level-1)*2)*10 + (testCase.level-1)*5
			mediumHealth := lowHealth + int(math.Round(0.9*float64(testCase.level)))*10
			mediumDefense := testCase.level
			lowSurvivalHits := hitsToDefeat(lowHealth, profile.Damage)
			mediumSurvivalHits := hitsToDefeat(mediumHealth, max(1, profile.Damage-mediumDefense))
			if lowSurvivalHits < 4 || lowSurvivalHits > 8 {
				t.Fatalf("low-gear incoming pressure left the 4-8 hit target: damage=%d health=%d hits=%d", profile.Damage, lowHealth, lowSurvivalHits)
			}
			if mediumSurvivalHits < 7 || mediumSurvivalHits < lowSurvivalHits+2 {
				t.Fatalf("medium mitigation is not meaningfully safer: damage=%d health=%d defense=%d hits=%d", profile.Damage, mediumHealth, mediumDefense, mediumSurvivalHits)
			}
			topDefense := int(math.Round(10.8 * float64(testCase.level)))
			if profile.Damage-topDefense > 1 {
				t.Fatalf("optimized legendary defense did not make the encounter easy: damage=%d defense=%d", profile.Damage, topDefense)
			}
		})
	}
}

func TestOverworldEliteUsesTheSameCurveWithElitePressure(t *testing.T) {
	normal := overworldEnemyCombatProfile("DemonOrc", 30, false)
	elite := overworldEnemyCombatProfile("DemonOrc", 30, true)
	if elite.MaxHealth <= normal.MaxHealth || elite.Damage <= normal.Damage {
		t.Fatalf("elite did not exceed its normal family: normal=%+v elite=%+v", normal, elite)
	}
	assertApproxRatio(t, float64(elite.MaxHealth)/float64(normal.MaxHealth), 1.5, 0.03, "elite health")
	assertApproxRatio(t, float64(elite.Damage)/float64(normal.Damage), 1.5, 0.03, "elite damage")
}

func TestDungeonRanksAndDifficultyScaleFromThePostSquishCurve(t *testing.T) {
	trash := dungeonEnemyCombatProfile("Skeleton", 30, DifficultyNormal, dungeonRankTrash, 3.0)
	elite := dungeonEnemyCombatProfile("Skeleton", 30, DifficultyNormal, dungeonRankElite, 3.0)
	boss := dungeonEnemyCombatProfile("RootboundWarden", 30, DifficultyNormal, dungeonRankBoss, 2.5)
	heroic := dungeonEnemyCombatProfile("RootboundWarden", 30, DifficultyHeroic, dungeonRankBoss, 2.5)
	mythic := dungeonEnemyCombatProfile("RootboundWarden", 30, DifficultyMythic, dungeonRankBoss, 2.5)

	if trash.MaxHealth >= elite.MaxHealth || elite.MaxHealth >= boss.MaxHealth {
		t.Fatalf("dungeon rank health order is wrong: trash=%d elite=%d boss=%d", trash.MaxHealth, elite.MaxHealth, boss.MaxHealth)
	}
	if trash.Damage >= elite.Damage || elite.Damage >= boss.Damage {
		t.Fatalf("dungeon rank damage order is wrong: trash=%d elite=%d boss=%d", trash.Damage, elite.Damage, boss.Damage)
	}
	assertApproxRatio(t, float64(heroic.MaxHealth)/float64(boss.MaxHealth), 2.0, 0.01, "heroic boss health")
	assertApproxRatio(t, float64(mythic.MaxHealth)/float64(boss.MaxHealth), 4.0, 0.01, "mythic boss health")
	assertApproxRatio(t, float64(heroic.Damage)/float64(boss.Damage), 1.5, 0.02, "heroic boss damage")
	assertApproxRatio(t, float64(mythic.Damage)/float64(boss.Damage), 2.5, 0.02, "mythic boss damage")

	level100 := dungeonEnemyCombatProfile("Skeleton", 100, DifficultyNormal, dungeonRankTrash, 3.0)
	if level100.MaxHealth <= trash.MaxHealth || level100.Damage <= trash.Damage {
		t.Fatalf("run-level progression did not increase dungeon trash: level30=%+v level100=%+v", trash, level100)
	}
}

func TestEnemyRecalculationPreservesBalanceAndOnlyAppliesTemporarySlow(t *testing.T) {
	profile := overworldEnemyCombatProfile("PhoenixSentinel", 90, false)
	enemy := &Entity{
		Type:           TypeEnemy,
		SubType:        "PhoenixSentinel",
		Level:          90,
		BaseStats:      profile.BaseStats,
		Health:         profile.MaxHealth / 2,
		MaxHealth:      profile.MaxHealth,
		Damage:         profile.Damage,
		BaseSpeed:      profile.Speed,
		Speed:          profile.Speed,
		AttackSpeed:    profile.AttackSpeed,
		AttackCooldown: profile.AttackCooldown,
		Slowed:         true,
		SlowFactor:     0.5,
	}

	enemy.RecalculateStats()
	if enemy.MaxHealth != profile.MaxHealth || enemy.Damage != profile.Damage {
		t.Fatalf("temporary recalc changed enemy balance: health=%d/%d damage=%d/%d", enemy.MaxHealth, profile.MaxHealth, enemy.Damage, profile.Damage)
	}
	if enemy.HpRegen != 0 {
		t.Fatalf("temporary enemy slow accidentally enabled %.2f health regen", enemy.HpRegen)
	}
	if math.Abs(enemy.Speed-profile.Speed*0.5) > 0.000001 {
		t.Fatalf("slow did not use authored base speed: got %.3f want %.3f", enemy.Speed, profile.Speed*0.5)
	}

	enemy.Slowed = false
	enemy.SlowFactor = 0
	enemy.RecalculateStats()
	if math.Abs(enemy.Speed-profile.Speed) > 0.000001 {
		t.Fatalf("slow expiry did not restore authored base speed: got %.3f want %.3f", enemy.Speed, profile.Speed)
	}
}

func hitsToDefeat(health, hit int) int {
	if health <= 0 || hit <= 0 {
		return 0
	}
	return (health + hit - 1) / hit
}

func assertApproxRatio(t *testing.T, got, want, tolerance float64, label string) {
	t.Helper()
	if math.Abs(got-want) > tolerance {
		t.Fatalf("%s ratio %.3f, want %.3f (+/- %.3f)", label, got, want, tolerance)
	}
}
