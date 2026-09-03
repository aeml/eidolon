package game

import (
	"strings"
	"testing"
)

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
	w.InstanceLayouts["boss-low"] = &DungeonInstance{ID: "boss-low", Difficulty: DifficultyHeroic, RunLevel: 30}
	w.InstanceLayouts["boss-high"] = &DungeonInstance{ID: "boss-high", Difficulty: DifficultyHeroic, RunLevel: 100}

	w.spawnBossInInstance("HollowSentinel", 0, 0, "boss-low", DifficultyHeroic)
	w.spawnBossInInstance("HollowSentinel", 0, 0, "boss-high", DifficultyHeroic)

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
	if got := enemy.ID; !strings.HasPrefix(got, "elite-") {
		t.Fatalf("expected Verdant elite-room enemy id to use elite prefix for loot logic, got %s", got)
	}
}

func TestEveryDungeonEliteFactoryUsesEliteBalanceAndLootIdentity(t *testing.T) {
	w := NewWorld(nil)
	testCases := []struct {
		name       string
		subType    string
		instanceID string
		spawn      func()
	}{
		{
			name:       "verdant",
			subType:    "DemonOrc",
			instanceID: "verdant-elite-factory",
			spawn: func() {
				w.spawnDungeonEnemyInInstance("DemonOrc", 0, 0, "verdant-elite-factory", DifficultyNormal, true)
			},
		},
		{
			name:       "molten",
			subType:    "InfernalBehemoth",
			instanceID: "molten-elite-factory",
			spawn: func() {
				w.spawnFireDungeonEnemy("InfernalBehemoth", 0, 0, "molten-elite-factory", true, DifficultyNormal)
			},
		},
		{
			name:       "tempest",
			subType:    "TempestGiant",
			instanceID: "tempest-elite-factory",
			spawn: func() {
				w.spawnAirDungeonEnemy("TempestGiant", 0, 0, "tempest-elite-factory", true, DifficultyNormal)
			},
		},
		{
			name:       "abyssal",
			subType:    "FrostGuardian",
			instanceID: "abyssal-elite-factory",
			spawn: func() {
				w.spawnDungeonEnemyInInstance("FrostGuardian", 0, 0, "abyssal-elite-factory", DifficultyNormal, true)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			w.InstanceLayouts[testCase.instanceID] = &DungeonInstance{
				ID:         testCase.instanceID,
				Difficulty: DifficultyNormal,
				RunLevel:   70,
			}
			testCase.spawn()
			enemy := findOnlyEnemyForInstance(t, w, testCase.instanceID)
			if !strings.HasPrefix(enemy.ID, "elite-") {
				t.Fatalf("expected elite loot id, got %s", enemy.ID)
			}
			if enemy.SubType != testCase.subType {
				t.Fatalf("expected subtype %s, got %s", testCase.subType, enemy.SubType)
			}
			want := dungeonEnemyCombatProfile(testCase.subType, 70, DifficultyNormal, dungeonRankElite, enemy.BaseSpeed)
			if enemy.MaxHealth != want.MaxHealth || enemy.Damage != want.Damage {
				t.Fatalf("elite factory bypassed shared balance: got health=%d damage=%d, want health=%d damage=%d", enemy.MaxHealth, enemy.Damage, want.MaxHealth, want.Damage)
			}
		})
	}
}

func TestDungeonEnemySpawnsCarrySelectedRunLevel(t *testing.T) {
	w := NewWorld(nil)
	testCases := []struct {
		instanceID string
		runLevel   int
		spawn      func()
	}{
		{
			instanceID: "standard-level",
			runLevel:   40,
			spawn: func() {
				w.spawnEnemyInInstance("Skeleton", 0, 0, "standard-level", DifficultyNormal)
			},
		},
		{
			instanceID: "fire-level",
			runLevel:   70,
			spawn: func() {
				w.spawnFireDungeonEnemy("MagmaGolem", 0, 0, "fire-level", false, DifficultyNormal)
			},
		},
		{
			instanceID: "air-level",
			runLevel:   80,
			spawn: func() {
				w.spawnAirDungeonEnemy("StormHarpy", 0, 0, "air-level", false, DifficultyNormal)
			},
		},
		{
			instanceID: "boss-level",
			runLevel:   100,
			spawn: func() {
				w.spawnBossInInstance("Thalorath", 0, 0, "boss-level", DifficultyMythic)
			},
		},
	}

	for _, testCase := range testCases {
		w.InstanceLayouts[testCase.instanceID] = &DungeonInstance{
			ID:         testCase.instanceID,
			Difficulty: DifficultyNormal,
			RunLevel:   testCase.runLevel,
		}
		testCase.spawn()
		enemy := findOnlyEnemyForInstance(t, w, testCase.instanceID)
		if enemy.Level != testCase.runLevel {
			t.Fatalf("expected %s spawn to carry run level %d, got %d", testCase.instanceID, testCase.runLevel, enemy.Level)
		}
	}
}

func TestDungeonBossTelegraphsUseRegionalEncounterLanguage(t *testing.T) {
	testCases := []struct {
		boss   string
		theme  string
		attack string
		label  string
	}{
		{"HollowSentinel", "verdant_bastion_catacombs", "root_quake", "ROOT QUAKE"},
		{"LordInfernax", "molten_core", "furnace_rupture", "FURNACE RUPTURE"},
		{"Zephyrion", "tempest_spire", "stormbreak", "STORMBREAK"},
		{"Thalorath", "abyssal_well", "undertow_crush", "UNDERTOW CRUSH"},
	}

	for _, testCase := range testCases {
		presentation := telegraphPresentationForDungeonBoss(testCase.boss)
		if presentation.Theme != testCase.theme || presentation.Attack != testCase.attack || presentation.Label != testCase.label {
			t.Fatalf("unexpected %s telegraph presentation: %+v", testCase.boss, presentation)
		}
	}
}
