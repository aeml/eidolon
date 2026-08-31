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

func TestNearDeathAnimationQARemovesOwnedEffectsAndBlocksRecovery(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:                  "player-qa-near-death",
		Type:                TypePlayer,
		SubType:             "Cleric",
		Health:              90,
		MaxHealth:           90,
		Mana:                10,
		MaxMana:             100,
		Defense:             100,
		Cooldowns:           make(map[string]time.Time),
		InvulnerableEndTime: time.Now().Add(time.Minute),
	}
	enemy := &Entity{
		ID:             "qa-near-death-enemy",
		Type:           TypeEnemy,
		SubType:        "Skeleton",
		Health:         100,
		MaxHealth:      100,
		Damage:         1,
		State:          "IDLE",
		X:              1,
		AttackCooldown: time.Millisecond,
		Threat:         map[string]float64{"prior-qa-player": 100_000},
	}
	ownedZone := &Entity{
		ID:      "owned-healing-zone",
		Type:    TypeProjectile,
		SubType: "ZoneHoly",
		OwnerID: player.ID,
	}
	ownedSeraph := &Entity{
		ID:      "owned-seraph",
		Type:    TypeNPC,
		SubType: "AvengingSeraph",
		OwnerID: player.ID,
	}
	unrelatedZone := &Entity{
		ID:      "other-player-zone",
		Type:    TypeProjectile,
		SubType: "ZoneHoly",
		OwnerID: "another-player",
	}
	w.AddEntity(player)
	w.AddEntity(ownedZone)
	w.AddEntity(ownedSeraph)
	w.AddEntity(unrelatedZone)
	w.AddEntity(enemy)

	if !w.PreparePlayerForAnimationQA(player.ID, false, false, true) {
		t.Fatal("expected near-death animation readiness reset")
	}
	if player.Health != 1 {
		t.Fatalf("expected near-death health to remain at one, got %d", player.Health)
	}
	if got := applyHealingReceived(player, player.MaxHealth); got != 0 {
		t.Fatalf("expected retained healing to be suppressed, got %d", got)
	}
	if w.GetEntity(ownedZone.ID) != nil || w.GetEntity(ownedSeraph.ID) != nil {
		t.Fatal("expected player-owned projectiles and summons to be removed")
	}
	if w.GetEntity(unrelatedZone.ID) == nil {
		t.Fatal("expected another player's transient effect to remain")
	}
	enemy.Mu.RLock()
	focusedThreat := enemy.Threat[player.ID]
	priorThreat := enemy.Threat["prior-qa-player"]
	enemy.Mu.RUnlock()
	if focusedThreat <= priorThreat {
		t.Fatalf("expected nearby hostile to focus the active QA character, got active=%v prior=%v", focusedThreat, priorThreat)
	}

	// Simulate a mitigation edge being reapplied between readiness and the
	// hostile swing. The release check must still take one real point of damage
	// after explicit waypoint protection is gone.
	player.Mu.Lock()
	player.SanctuaryDamageReduction = true
	player.SanctuaryEndTime = time.Now().Add(time.Minute)
	player.Mu.Unlock()
	if !w.DisablePlayerQAProtection(player.ID) {
		t.Fatal("expected waypoint protection to be disabled")
	}
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		player.Mu.RLock()
		dead := player.State == "DEAD"
		player.Mu.RUnlock()
		if dead {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("expected the real hostile hit to complete the near-death check")
}
