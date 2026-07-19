package game

import (
	"testing"
	"time"
)

func TestQAGuaranteedLootIsConsumedByNextEnemyKill(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:            "player-qa-loot",
		Type:          TypePlayer,
		SubType:       "Wizard",
		Level:         MaxPlayerLevel,
		MaxExperience: 1_000_000,
		Health:        100,
		MaxHealth:     100,
		Inventory:     make([]Item, MaxInventorySize),
		Equipment:     make(map[string]Item),
		Cooldowns:     make(map[string]time.Time),
		SkillRunes:    make(map[string]string),
		TalentRanks:   make(map[string]int),
	}
	enemy := &Entity{
		ID:        "qa-loot-enemy",
		Type:      TypeEnemy,
		SubType:   "Skeleton",
		Level:     1,
		Health:    10,
		MaxHealth: 10,
		State:     "IDLE",
		X:         20,
		Z:         20,
	}
	w.AddEntity(player)
	w.AddEntity(enemy)

	if !w.ArmPlayerQAGuaranteedLoot(player.ID) {
		t.Fatal("expected QA loot flag to arm")
	}
	w.handleDeath(enemy, player, nil)
	if player.QAGuaranteedLoot {
		t.Fatal("expected QA loot flag to be consumed synchronously on kill")
	}

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		w.Mu.RLock()
		found := false
		for _, entity := range w.Entities {
			if entity.Type == TypeLoot && entity.LootItem != nil &&
				entity.LootItem.Type != ItemMaterial && entity.LootItem.Type != ItemRelic &&
				entity.LootItem.Type != ItemGem {
				found = true
				break
			}
		}
		w.Mu.RUnlock()
		if found {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("expected the armed enemy kill to create a normal loot entity")
}

func TestQAGuaranteedLootMakesNextAcceptedBasicAttackDeterministic(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:               "player-qa-combat",
		Type:             TypePlayer,
		SubType:          "Wizard",
		Damage:           10,
		AttackCooldown:   time.Millisecond,
		Inventory:        make([]Item, MaxInventorySize),
		Equipment:        make(map[string]Item),
		Cooldowns:        make(map[string]time.Time),
		SkillRunes:       make(map[string]string),
		TalentRanks:      make(map[string]int),
		MaxExperience:    100,
		QAGuaranteedLoot: true,
	}
	enemy := &Entity{
		ID:        "qa-combat-enemy",
		Type:      TypeEnemy,
		SubType:   "Skeleton",
		Health:    150,
		MaxHealth: 150,
		State:     "IDLE",
		X:         2,
	}
	w.AddEntity(player)
	w.AddEntity(enemy)

	if _, ok := w.PerformAttack(player.ID, enemy.ID); !ok {
		t.Fatal("expected a real in-range basic attack to be accepted")
	}

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		got := w.GetEntity(enemy.ID)
		if got == nil {
			t.Fatal("enemy disappeared before its death state could be observed")
		}
		got.Mu.RLock()
		dead := got.State == "DEAD"
		got.Mu.RUnlock()
		if dead {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("expected the allowlisted QA attack to finish the enemy")
}
