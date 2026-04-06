package game

import "testing"

func findOnlyEnemyForInstance(t *testing.T, w *World, instanceID string) *Entity {
	t.Helper()
	var found *Entity
	for _, entity := range w.Entities {
		if entity == nil || entity.InstanceID != instanceID || entity.Type != TypeEnemy {
			continue
		}
		if found != nil {
			t.Fatalf("expected one enemy in instance %s, found multiple", instanceID)
		}
		found = entity
	}
	if found == nil {
		t.Fatalf("expected enemy in instance %s", instanceID)
	}
	return found
}

func TestDungeonRunLevelScalingIncreasesStandardEnemyStats(t *testing.T) {
	w := NewWorld(nil)
	w.InstanceLayouts["instance-low"] = &DungeonInstance{ID: "instance-low", Difficulty: DifficultyNormal, RunLevel: 30}
	w.InstanceLayouts["instance-high"] = &DungeonInstance{ID: "instance-high", Difficulty: DifficultyNormal, RunLevel: 100}

	w.spawnEnemyInInstance("Skeleton", 0, 0, "instance-low", DifficultyNormal)
	w.spawnEnemyInInstance("Skeleton", 0, 0, "instance-high", DifficultyNormal)

	lowEnemy := findOnlyEnemyForInstance(t, w, "instance-low")
	highEnemy := findOnlyEnemyForInstance(t, w, "instance-high")

	if highEnemy.MaxHealth <= lowEnemy.MaxHealth {
		t.Fatalf("expected run level 100 enemy health to exceed run level 30, got low=%d high=%d", lowEnemy.MaxHealth, highEnemy.MaxHealth)
	}
	if highEnemy.Damage <= lowEnemy.Damage {
		t.Fatalf("expected run level 100 enemy damage to exceed run level 30, got low=%d high=%d", lowEnemy.Damage, highEnemy.Damage)
	}
}

func TestDungeonRunLevelScalingIncreasesBossStats(t *testing.T) {
	w := NewWorld(nil)
	bossStats := Stats{Strength: 5000, Vitality: 120000, Dexterity: 20}
	w.InstanceLayouts["boss-low"] = &DungeonInstance{ID: "boss-low", Difficulty: DifficultyHeroic, RunLevel: 30}
	w.InstanceLayouts["boss-high"] = &DungeonInstance{ID: "boss-high", Difficulty: DifficultyHeroic, RunLevel: 100}

	w.spawnBossInInstance("HollowSentinel", 0, 0, "boss-low", bossStats, DifficultyHeroic)
	w.spawnBossInInstance("HollowSentinel", 0, 0, "boss-high", bossStats, DifficultyHeroic)

	lowBoss := findOnlyEnemyForInstance(t, w, "boss-low")
	highBoss := findOnlyEnemyForInstance(t, w, "boss-high")

	if highBoss.MaxHealth <= lowBoss.MaxHealth {
		t.Fatalf("expected run level 100 boss health to exceed run level 30, got low=%d high=%d", lowBoss.MaxHealth, highBoss.MaxHealth)
	}
	if highBoss.Damage <= lowBoss.Damage {
		t.Fatalf("expected run level 100 boss damage to exceed run level 30, got low=%d high=%d", lowBoss.Damage, highBoss.Damage)
	}
}

func TestVerdantEliteRoomSpawnUsesEliteIDPrefixForLootLogic(t *testing.T) {
	w := NewWorld(nil)
	w.InstanceLayouts["verdant-elite"] = &DungeonInstance{ID: "verdant-elite", Difficulty: DifficultyNormal, RunLevel: 30}

	w.spawnEnemyInInstance("DemonOrc", 0, 0, "verdant-elite", DifficultyNormal)

	enemy := findOnlyEnemyForInstance(t, w, "verdant-elite")
	if enemy.SubType != "DemonOrc" {
		t.Fatalf("expected DemonOrc elite placeholder, got %s", enemy.SubType)
	}
	if got := enemy.ID; len(got) < len("elite-") || got[:len("elite-")] != "elite-" {
		t.Fatalf("expected Verdant elite-room enemy id to use elite prefix for loot logic, got %s", got)
	}
}
