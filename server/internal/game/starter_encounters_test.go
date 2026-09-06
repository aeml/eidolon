package game

import (
	"testing"
	"time"
)

func TestLanternholdSkeletonBandsAndCombatProfiles(t *testing.T) {
	for _, point := range [][2]float64{{0, 200}, {120, 150}, {-125, 250}, {0, 700}} {
		x, z := lanternholdElitePosition(point[0], point[1])
		if lanternholdSkeletonLevel(x, z) != 10 || x < -200 || x > 200 || z < -600 || z > 1000 {
			t.Fatalf("elite position escaped its sector or entered the starter band: %v,%v", x, z)
		}
		if lanternholdSkeletonLevel(point[0], point[1]) == 10 && (x != point[0] || z != point[1]) {
			t.Fatal("an elite already outside the starter band was unnecessarily relocated")
		}
	}
	for _, tc := range []struct {
		x, z  float64
		level int
	}{
		{125, 200, 1}, {145, 200, 1}, {165, 200, 2}, {185, 200, 3},
		{-125, 200, 1}, {0, 75, 1}, {0, 325, 1}, {0, 600, 10},
	} {
		if got := lanternholdSkeletonLevel(tc.x, tc.z); got != tc.level {
			t.Errorf("level at (%v,%v) = %d, want %d", tc.x, tc.z, got, tc.level)
		}
	}
	previousHealth, previousDamage := 0, 0
	for level := 1; level <= 10; level++ {
		profile := overworldEnemyCombatProfile("Skeleton", level, false)
		if profile.MaxHealth <= previousHealth || profile.Damage < previousDamage {
			t.Fatalf("starter progression is not increasing at level %d: %+v", level, profile)
		}
		previousHealth, previousDamage = profile.MaxHealth, profile.Damage
	}
	first := overworldEnemyCombatProfile("Skeleton", 1, false)
	if first.MaxHealth != 30 || first.Damage != 2 {
		t.Fatalf("level-one encounter = hp %d damage %d, want 30/2", first.MaxHealth, first.Damage)
	}
	// This onramp must not soften dungeon scaling or other enemy families.
	for _, subType := range []string{"Imp", "DemonOrc", "Construct", "InfernoTitan"} {
		if overworldEnemyCombatProfile(subType, 1, false) != overworldEnemyCombatProfile(subType, 10, false) {
			t.Fatalf("unrelated low-level family %s changed", subType)
		}
	}
	if dungeonEnemyCombatProfile("Skeleton", 1, DifficultyNormal, dungeonRankTrash, 5.4) !=
		dungeonEnemyCombatProfile("Skeleton", 10, DifficultyNormal, dungeonRankTrash, 5.4) {
		t.Fatal("starter onramp leaked into dungeon profiles")
	}
}

func TestLanternholdHasNormalPersistentStarterEncounters(t *testing.T) {
	w := NewWorld(nil)
	// Inspect real constructor output; explicitly respawning the population
	// here would hide missing initialization and leave stale spatial entries.
	for i, point := range lanternholdStarterSpawns {
		enemy := w.Entities[starterSkeletonID(i)]
		if enemy == nil || enemy.Type != TypeEnemy || enemy.SubType != "Skeleton" || enemy.Level != 1 ||
			enemy.SpawnX != point.x || enemy.SpawnZ != point.z || enemy.Health != 30 || enemy.Damage != 2 {
			t.Fatalf("starter encounter %d was not an ordinary level-one respawnable Skeleton", i)
		}
		if enemy.X <= 100 || enemy.X >= 200 || enemy.Z <= 100 || enemy.Z >= 300 {
			t.Fatalf("starter encounter is not outside the east gate: (%v,%v)", enemy.X, enemy.Z)
		}
		enemy.Health = 0
		enemy.State = "DEAD"
		enemy.X += 10
		enemy.LastAttackTime = time.Now().Add(-11 * time.Second)
		w.updateEntity(enemy, 0.05, nil, &deferredActions{})
		if enemy.State != "IDLE" || enemy.Health != 30 || enemy.Level != 1 ||
			enemy.X != point.x || enemy.Z != point.z {
			t.Fatal("normal respawn did not restore the authored starter encounter")
		}
	}
	for _, enemy := range w.Entities {
		if enemy.Type == TypeEnemy && enemy.SubType == "Skeleton" && enemy.Level != lanternholdSkeletonLevel(enemy.SpawnX, enemy.SpawnZ) {
			t.Fatal("spawn level and starter band disagree")
		}
	}
}
