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
