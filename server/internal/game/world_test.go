package game

import (
	"math"
	"testing"
	"time"
)

func TestNewWorld(t *testing.T) {
	w := NewWorld(nil)
	if w == nil {
		t.Fatal("NewWorld returned nil")
	}
	if w.Entities == nil {
		t.Fatal("World.Entities is nil")
	}
	// Check initial enemies
	if len(w.Entities) == 0 {
		t.Log("Warning: No initial enemies spawned (might be intentional)")
	}
}

func TestAddRemoveEntity(t *testing.T) {
	w := NewWorld(nil)
	e := &Entity{
		ID:   "player-1",
		Type: TypePlayer,
		X:    0,
		Y:    0,
		Z:    0,
	}

	w.AddEntity(e)
	if got := w.GetEntity("player-1"); got != e {
		t.Errorf("GetEntity returned %v, want %v", got, e)
	}

	w.RemoveEntity("player-1")
	if got := w.GetEntity("player-1"); got != nil {
		t.Errorf("GetEntity returned %v after removal, want nil", got)
	}
}

func TestGenerateDailyQuestsGivesLevelOneStarterCatalog(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "player-level-one-quests", Type: TypePlayer, Level: 1}
	w.AddEntity(player)

	generated := w.GenerateDailyQuests(player.ID)
	if generated == nil {
		t.Fatal("expected daily quest generation to return the level-one player")
	}
	if len(generated.Quests) != len(dailyQuestCatalog()) {
		t.Fatalf("expected complete daily catalog, got %d quests", len(generated.Quests))
	}

	foundStarter := false
	for _, quest := range generated.Quests {
		if quest.ID != "daily_skeleton" {
			continue
		}
		foundStarter = true
		if quest.Target != "Skeleton" || quest.MaxCount != 100 || quest.RewardXP != 50000 {
			t.Fatalf("unexpected starter daily: %+v", quest)
		}
		if quest.Accepted || quest.Completed || quest.Count != 0 {
			t.Fatalf("starter daily should begin available with no progress: %+v", quest)
		}
	}
	if !foundStarter {
		t.Fatal("expected daily_skeleton to be available to a level-one player")
	}
}

func TestGenerateDailyQuestsRepairsPartialSameDayCatalogWithoutResettingProgress(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:             "player-partial-quests",
		Type:           TypePlayer,
		Level:          1,
		LastDailyQuest: time.Now(),
		Quests: []Quest{{
			ID:        "daily_skeleton",
			Type:      "LEGACY",
			Target:    "Skeleton",
			Count:     42,
			MaxCount:  10,
			RewardXP:  1,
			Accepted:  true,
			Completed: false,
		}},
	}
	w.AddEntity(player)

	generated := w.GenerateDailyQuests(player.ID)
	if len(generated.Quests) != len(dailyQuestCatalog()) {
		t.Fatalf("expected partial same-day row to be repaired to %d quests, got %d", len(dailyQuestCatalog()), len(generated.Quests))
	}
	for _, quest := range generated.Quests {
		if quest.ID == "daily_skeleton" {
			if quest.Count != 42 || !quest.Accepted || quest.Completed {
				t.Fatalf("catalog repair reset today's starter progress: %+v", quest)
			}
			if quest.Type != "KILL" || quest.MaxCount != 100 || quest.RewardXP != 50000 {
				t.Fatalf("catalog repair did not restore the starter definition: %+v", quest)
			}
			return
		}
	}
	t.Fatal("repaired catalog is missing daily_skeleton")
}

func TestWorldUpdate(t *testing.T) {
	w := NewWorld(nil)
	// Add a moving enemy outside safe zone (> 50)
	e := &Entity{
		ID:      "enemy-1",
		Type:    TypeEnemy,
		State:   "MOVING",
		X:       100,
		Y:       0,
		Z:       0,
		TargetX: 110,
		TargetZ: 0,
		Speed:   1.0,
	}
	w.AddEntity(e)

	// Update for 1 second
	w.Update(1.0)

	// Should have moved towards (110, 0)
	// New X should be approx 101.0
	if e.X <= 100 {
		t.Errorf("Entity did not move. X = %f", e.X)
	}
	if e.X > 101.1 {
		t.Errorf("Entity moved too far. X = %f", e.X)
	}
}

func TestWorldUpdateEnemiesIgnoreDisconnectedPlayers(t *testing.T) {
	w := NewWorld(nil)
	connected := &Entity{
		ID:    "player-connected",
		Type:  TypePlayer,
		State: "IDLE",
		X:     8,
		Z:     0,
	}
	disconnected := &Entity{
		ID:           "player-disconnected",
		Type:         TypePlayer,
		State:        "IDLE",
		X:            100,
		Z:            0,
		Disconnected: true,
	}
	enemy := &Entity{
		ID:             "enemy-disconnected-target",
		Type:           TypeEnemy,
		State:          "IDLE",
		X:              0,
		Z:              0,
		SpawnX:         -1000,
		Speed:          5,
		AttackCooldown: time.Second,
		Threat: map[string]float64{
			disconnected.ID: 100,
		},
	}
	w.AddEntity(connected)
	w.AddEntity(disconnected)
	w.AddEntity(enemy)

	before := math.Hypot(enemy.X-connected.X, enemy.Z-connected.Z)
	w.Update(0.1)
	after := math.Hypot(enemy.X-connected.X, enemy.Z-connected.Z)

	if after >= before {
		t.Fatalf("expected enemy to chase the connected player instead of stale disconnected threat: before=%f after=%f", before, after)
	}
}

func TestGetState(t *testing.T) {
	w := NewWorld(nil)
	e := &Entity{ID: "p1", Type: TypePlayer}
	w.AddEntity(e)

	state := w.GetState()
	if len(state) != len(w.Entities) {
		t.Errorf("GetState returned %d entities, want %d", len(state), len(w.Entities))
	}

	// Verify deep copy (or at least shallow copy of struct)
	// Modify original
	e.X = 100

	// State should have old value if it was copied BEFORE modification
	// But GetState returns a snapshot at the time of call.
	// If we call GetState again:
	state2 := w.GetState()
	if state2["p1"].X != 100 {
		t.Errorf("GetState did not reflect update. Got %f, want 100", state2["p1"].X)
	}
}

func TestDungeonDifficultyMinLevelsUseProgressionRules(t *testing.T) {
	if got := MinLevelForDifficulty(DifficultyNormal, "verdant_bastion_catacombs"); got != 30 {
		t.Fatalf("expected normal dungeon access at 30, got %d", got)
	}
	if got := MinLevelForDifficulty(DifficultyHeroic, "verdant_bastion_catacombs"); got != 100 {
		t.Fatalf("expected heroic unlock at 100, got %d", got)
	}
	if got := MinLevelForDifficulty(DifficultyMythic, "verdant_bastion_catacombs"); got != 100 {
		t.Fatalf("expected mythic unlock at 100, got %d", got)
	}
}

func TestDifficultyRewardNoteMatchesEndgameIdentityCopy(t *testing.T) {
	if got := difficultyRewardNote(DifficultyNormal); got != "" {
		t.Fatalf("expected no normal difficulty note, got %q", got)
	}
	if got := difficultyRewardNote(DifficultyHeroic); got != "Heroic bosses guarantee one bonus gem drop." {
		t.Fatalf("unexpected heroic note: %q", got)
	}
	if got := difficultyRewardNote(DifficultyMythic); got != "Mythic bosses guarantee one bonus gem and one unique-effect item." {
		t.Fatalf("unexpected mythic note: %q", got)
	}
}

func TestEntityRecalculateStats(t *testing.T) {
	e := &Entity{
		ID:    "player-1",
		Type:  TypePlayer,
		Level: 1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// MaxHealth = vitality * 10 + (level-1)*5 = 100 + 0 = 100
	if e.MaxHealth != 100 {
		t.Errorf("Expected MaxHealth 100, got %d", e.MaxHealth)
	}

	// MaxMana = intelligence * 10 + (level-1)*5 = 100 + 0 = 100
	if e.MaxMana != 100 {
		t.Errorf("Expected MaxMana 100, got %d", e.MaxMana)
	}

	// HpRegen = vitality * 0.5 = 5
	if e.HpRegen != 5.0 {
		t.Errorf("Expected HpRegen 5.0, got %f", e.HpRegen)
	}

	// ManaRegen = wisdom * 0.5 = 5
	if e.ManaRegen != 5.0 {
		t.Errorf("Expected ManaRegen 5.0, got %f", e.ManaRegen)
	}

	// CDR = min(0.5, intelligence * 0.01) = 0.1
	if e.CooldownReduction != 0.1 {
		t.Errorf("Expected CooldownReduction 0.1, got %f", e.CooldownReduction)
	}
}

func TestEntityRecalculateStatsWithLevel(t *testing.T) {
	e := &Entity{
		ID:    "player-1",
		Type:  TypePlayer,
		Level: 10,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// MaxHealth = vitality * 10 + (level-1)*5 = 100 + 45 = 145
	if e.MaxHealth != 145 {
		t.Errorf("Expected MaxHealth 145, got %d", e.MaxHealth)
	}

	// MaxMana = intelligence * 10 + (level-1)*5 = 100 + 45 = 145
	if e.MaxMana != 145 {
		t.Errorf("Expected MaxMana 145, got %d", e.MaxMana)
	}
}

func TestEntityRecalculateStatsWithEquipment(t *testing.T) {
	e := &Entity{
		ID:    "player-1",
		Type:  TypePlayer,
		Level: 1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	// Add equipment with stats
	e.Equipment["mainHand"] = Item{
		Stats: map[string]int{"damage": 50},
	}
	e.Equipment["chest"] = Item{
		Stats: map[string]int{"defense": 20, "vitality": 5},
	}

	e.RecalculateStats()

	// Defense = 20 from chest
	if e.Defense != 20 {
		t.Errorf("Expected Defense 20, got %d", e.Defense)
	}

	// Vitality = 10 + 5 = 15
	if e.Stats.Vitality != 15 {
		t.Errorf("Expected Vitality 15, got %d", e.Stats.Vitality)
	}

	// MaxHealth = vitality * 10 = 150
	if e.MaxHealth != 150 {
		t.Errorf("Expected MaxHealth 150, got %d", e.MaxHealth)
	}
}

func TestEntityRecalculateStatsFighter(t *testing.T) {
	e := &Entity{
		ID:      "player-1",
		Type:    TypePlayer,
		SubType: "Fighter",
		Level:   1,
		BaseStats: Stats{
			Strength:     20,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// Fighter damage = strength / 4 = 20 / 4 = 5
	if e.Damage != 5 {
		t.Errorf("Expected Fighter Damage 5, got %d", e.Damage)
	}
}

func TestEntityRecalculateStatsRogue(t *testing.T) {
	e := &Entity{
		ID:      "player-1",
		Type:    TypePlayer,
		SubType: "Rogue",
		Level:   1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    20,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// Rogue damage = dexterity / 4 = 20 / 4 = 5
	if e.Damage != 5 {
		t.Errorf("Expected Rogue Damage 5, got %d", e.Damage)
	}
}

func TestEntityRecalculateStatsWizard(t *testing.T) {
	e := &Entity{
		ID:      "player-1",
		Type:    TypePlayer,
		SubType: "Wizard",
		Level:   1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 20,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// Wizard damage = intelligence / 4 = 20 / 4 = 5
	if e.Damage != 5 {
		t.Errorf("Expected Wizard Damage 5, got %d", e.Damage)
	}
}

func TestPerformPickup_InventoryFull_DoesNotDeleteLoot(t *testing.T) {
	w := NewWorld(nil)

	player := &Entity{ID: "player-1", Type: TypePlayer, X: 0, Z: 0}
	player.Inventory = make([]Item, MaxInventorySize)
	for i := 0; i < len(player.Inventory); i++ {
		player.Inventory[i] = Item{ID: "filled"}
	}
	w.AddEntity(player)

	loot := &Entity{ID: "loot-1", Type: TypeLoot, X: 0, Z: 0}
	loot.LootItem = &Item{ID: "item-1", Name: "Test Item", Stack: 1, MaxStack: 1}
	w.AddEntity(loot)

	_, success, reason := w.PerformPickup(player.ID, loot.ID)
	if success {
		t.Fatalf("expected pickup to fail due to full inventory")
	}
	if reason != "inventory_full" {
		t.Fatalf("expected reason inventory_full, got %q", reason)
	}
	if got := w.GetEntity(loot.ID); got == nil {
		t.Fatalf("expected loot to remain in world, but it was deleted")
	}
}

func TestEntityRecalculateStatsCleric(t *testing.T) {
	e := &Entity{
		ID:      "player-1",
		Type:    TypePlayer,
		SubType: "Cleric",
		Level:   1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       20,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// Cleric damage = wisdom / 4 = 20 / 4 = 5
	if e.Damage != 5 {
		t.Errorf("Expected Cleric Damage 5, got %d", e.Damage)
	}
}

func TestEntitySpeedCalculation(t *testing.T) {
	e := &Entity{
		ID:    "player-1",
		Type:  TypePlayer,
		Level: 1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// Speed = (3.0 + (dex * 0.5)) * 1.2 = (3 + 5) * 1.2 = 9.6
	expectedSpeed := 9.6
	if e.Speed != expectedSpeed {
		t.Errorf("Expected Speed %f, got %f", expectedSpeed, e.Speed)
	}
}

func TestEntitySpeedCap(t *testing.T) {
	e := &Entity{
		ID:    "player-1",
		Type:  TypePlayer,
		Level: 1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    100, // Very high dex
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// Max speed = refSpeed * 3 = 9.6 * 3 = 28.8
	maxSpeed := 28.8
	diff := e.Speed - maxSpeed
	if diff < -0.001 || diff > 0.001 {
		t.Errorf("Expected capped Speed %f, got %f", maxSpeed, e.Speed)
	}
}

func TestEntityAttackSpeedCalculation(t *testing.T) {
	e := &Entity{
		ID:    "player-1",
		Type:  TypePlayer,
		Level: 1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// Attack Speed = 5.0 / (1 + dex*0.02) = 5.0 / 1.2 ≈ 4.17
	expectedAttackSpeed := 5.0 / 1.2
	diff := e.AttackSpeed - expectedAttackSpeed
	if diff < -0.01 || diff > 0.01 {
		t.Errorf("Expected AttackSpeed %f, got %f", expectedAttackSpeed, e.AttackSpeed)
	}
}

func TestEntityAttackSpeedMinimum(t *testing.T) {
	e := &Entity{
		ID:    "player-1",
		Type:  TypePlayer,
		Level: 1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    500, // Extremely high
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// Attack Speed minimum is 1.0
	if e.AttackSpeed != 1.0 {
		t.Errorf("Expected minimum AttackSpeed 1.0, got %f", e.AttackSpeed)
	}
}

func TestEntityCDRCap(t *testing.T) {
	e := &Entity{
		ID:    "player-1",
		Type:  TypePlayer,
		Level: 1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 100, // High int
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// CDR capped at 0.5
	if e.CooldownReduction != 0.5 {
		t.Errorf("Expected capped CDR 0.5, got %f", e.CooldownReduction)
	}
}

func TestResetTalentsRefundsPointsFromLevel(t *testing.T) {
	w := NewWorld(nil)
	p := &Entity{
		ID:      "player-1",
		Type:    TypePlayer,
		SubType: "Fighter",
		Level:   35, // should yield 7 points (1 per 5 levels)
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment:   make(map[string]Item),
		TalentRanks: map[string]int{"FTR_01": 2},
	}
	// Ensure points are derived properly.
	p.RecalculateStats()
	if p.TalentPoints != 5 {
		t.Fatalf("expected TalentPoints 5 after spending 2 ranks at level 35, got %d", p.TalentPoints)
	}
	w.AddEntity(p)

	_, ok, msg := w.PerformResetTalents("player-1")
	if !ok {
		t.Fatalf("PerformResetTalents failed: %s", msg)
	}

	if len(p.TalentRanks) != 0 {
		t.Fatalf("expected TalentRanks empty after reset, got %v", p.TalentRanks)
	}
	if p.TalentPoints != 7 {
		t.Fatalf("expected TalentPoints 7 after reset at level 35, got %d", p.TalentPoints)
	}
}

func TestEnemyDamageCalculation(t *testing.T) {
	e := &Entity{
		ID:    "enemy-1",
		Type:  TypeEnemy,
		Level: 1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: make(map[string]Item),
	}

	e.RecalculateStats()

	// Enemy damage = strength * 2 = 20
	if e.Damage != 20 {
		t.Errorf("Expected Enemy Damage 20, got %d", e.Damage)
	}
}
