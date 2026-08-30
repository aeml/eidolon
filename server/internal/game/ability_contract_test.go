package game

import (
	"testing"
	"time"
)

func selectableAbilityContract() map[string][]string {
	contract := make(map[string][]string)
	for _, className := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		seen := make(map[string]bool)
		for _, branch := range []string{"A", "B", "C"} {
			for _, skillName := range getSkillsForBranch(className, branch) {
				if !seen[skillName] {
					seen[skillName] = true
					contract[className] = append(contract[className], skillName)
				}
			}
		}
	}
	return contract
}

func TestSelectableAbilitiesHaveConfigAndAuthoritativeHandler(t *testing.T) {
	for className, skills := range selectableAbilityContract() {
		if len(skills) != 13 {
			t.Fatalf("%s: expected 13 selectable abilities, got %d", className, len(skills))
		}
		for _, skillName := range skills {
			t.Run(className+"/"+skillName, func(t *testing.T) {
				if _, ok := getAbilitySpec(className, skillName); !ok {
					t.Fatalf("missing ability spec for %s %q", className, skillName)
				}

				w := newTestWorld()
				player := newTestPlayer("p1", className)
				player.InstanceID = "contract-instance"
				player.Mana = 10000
				player.MaxMana = 10000
				player.Health = 100
				player.MaxHealth = 1000 // Satisfies Last Stand Rampage's health gate.
				player.UnlockedSkills = []string{skillName}
				player.Stats = Stats{Strength: 30, Dexterity: 30, Intelligence: 30, Wisdom: 30, Vitality: 30}
				w.AddEntity(player)

				target := &Entity{
					ID: "enemy", InstanceID: player.InstanceID, Type: TypeEnemy, SubType: "Skeleton",
					X: 1, Z: 1, Health: 100000, MaxHealth: 100000, State: "IDLE", Scale: 1,
				}
				w.AddEntity(target)

				result := w.PerformAbility(player.ID, target.X, target.Z, target.ID, skillName)
				if !result.Accepted {
					t.Fatalf("selectable ability has no committing server path: reason=%q", result.Reason)
				}
				if result.Mana != player.Mana {
					t.Fatalf("result mana %d does not match player mana %d", result.Mana, player.Mana)
				}
				for _, entity := range w.Entities {
					if entity.OwnerID == player.ID && entity.InstanceID != player.InstanceID {
						t.Fatalf("spawned entity %q leaked from %q into %q", entity.ID, player.InstanceID, entity.InstanceID)
					}
				}
			})
		}
	}
}

func TestPerformAbilityFailedCastDoesNotAdvanceOrActivateCombo(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("p1", "Fighter")
	player.Mana = 0
	player.UnlockedSkills = []string{"Charge", "Whirlwind"}
	player.LastSkillUsed = "Charge"
	player.LastSkillTime = time.Now()
	w.AddEntity(player)

	result := w.PerformAbility(player.ID, 0, 0, "", "Whirlwind")
	if result.Accepted || result.Reason != "requirements_not_met" {
		t.Fatalf("expected failed cast result, got %+v", result)
	}
	if player.LastSkillUsed != "Charge" || player.ActiveCombo != "" {
		t.Fatalf("failed cast changed combo state: last=%q active=%q", player.LastSkillUsed, player.ActiveCombo)
	}
}

func TestPerformAbilityReturnsRuneAdjustedCooldown(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("p1", "Cleric")
	player.UnlockedSkills = []string{"Divine Intervention"}
	player.SkillRunes = map[string]string{"Divine Intervention": "divineintervention_quick"}
	w.AddEntity(player)

	result := w.PerformAbility(player.ID, 0, 0, "", "Divine Intervention")
	if !result.Accepted {
		t.Fatalf("expected accepted cast, got %+v", result)
	}
	if result.CooldownRemaining != 60 {
		t.Fatalf("expected authoritative rune cooldown 60s, got %v", result.CooldownRemaining)
	}
}

func TestSuccessfulAbilityActivatesSwiftAndReplicatedSpeed(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("p1", "Fighter")
	player.UnlockedSkills = []string{"Whirlwind"}
	player.BaseStats = Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}
	player.Equipment["feet"] = Item{UniqueEffect: "swift"}
	player.RecalculateStats()
	baseSpeed := player.Speed
	player.Mana = player.MaxMana
	w.AddEntity(player)

	result := w.PerformAbility(player.ID, 0, 0, "", "Whirlwind")
	if !result.Accepted || !player.SwiftActive {
		t.Fatalf("successful cast did not activate Swift: result=%+v active=%v", result, player.SwiftActive)
	}
	if player.Speed <= baseSpeed {
		t.Fatalf("Swift speed was not reflected authoritatively: base=%v swift=%v", baseSpeed, player.Speed)
	}
}

func TestBerserkerEdgePartyCastDoesNotDeadlockWorld(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("p1", "Fighter")
	player.UnlockedSkills = []string{"Berserker Edge"}
	member := newTestPlayer("p2", "Fighter")
	w.AddEntity(player)
	w.AddEntity(member)
	party := w.CreateParty(player.ID)
	if party == nil {
		t.Fatal("failed to create test party")
	}
	if err := w.JoinParty(party.ID, member.ID); err != nil {
		t.Fatalf("failed to join party: %v", err)
	}

	done := make(chan AbilityResult, 1)
	go func() {
		done <- w.PerformAbility(player.ID, 0, 0, "", "Berserker Edge")
	}()
	select {
	case result := <-done:
		if !result.Accepted || !member.BerserkerModeActive {
			t.Fatalf("party cast did not complete: result=%+v memberActive=%v", result, member.BerserkerModeActive)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Berserker Edge party cast deadlocked the world")
	}
}

func TestPartySupportAbilitiesUpdateNearbyAuthoritativeStats(t *testing.T) {
	tests := []struct {
		className string
		skillName string
		assert    func(t *testing.T, member *Entity, baseSpeed float64, baseDefense int)
	}{
		{"Fighter", "Guardian Roar", func(t *testing.T, member *Entity, _ float64, baseDefense int) {
			if !member.GuardianRoarActive || member.Defense <= baseDefense {
				t.Fatalf("Guardian Roar did not replicate defense buff: active=%v defense=%d base=%d", member.GuardianRoarActive, member.Defense, baseDefense)
			}
		}},
		{"Wizard", "Time Warp", func(t *testing.T, member *Entity, baseSpeed float64, _ int) {
			if !member.TimeWarpActive || member.Speed <= baseSpeed {
				t.Fatalf("Time Warp did not replicate haste: active=%v speed=%v base=%v", member.TimeWarpActive, member.Speed, baseSpeed)
			}
		}},
		{"Cleric", "Blessing of Resolve", func(t *testing.T, member *Entity, _ float64, baseDefense int) {
			if !member.BlessingResolveActive || member.Defense <= baseDefense {
				t.Fatalf("Blessing of Resolve did not replicate defense: active=%v defense=%d base=%d", member.BlessingResolveActive, member.Defense, baseDefense)
			}
		}},
		{"Cleric", "Blessing of Zeal", func(t *testing.T, member *Entity, baseSpeed float64, _ int) {
			if !member.ZealActive || member.Speed <= baseSpeed {
				t.Fatalf("Blessing of Zeal did not replicate haste: active=%v speed=%v base=%v", member.ZealActive, member.Speed, baseSpeed)
			}
		}},
	}

	for _, tt := range tests {
		t.Run(tt.skillName, func(t *testing.T) {
			w := newTestWorld()
			caster := newTestPlayer("caster", tt.className)
			caster.UnlockedSkills = []string{tt.skillName}
			caster.BaseStats = Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}
			caster.Equipment["chest"] = Item{Stats: map[string]int{"defense": 10}}
			caster.RecalculateStats()
			caster.Mana = caster.MaxMana
			member := newTestPlayer("member", "Fighter")
			member.X = 2
			member.BaseStats = caster.BaseStats
			member.Equipment["chest"] = Item{Stats: map[string]int{"defense": 10}}
			member.RecalculateStats()
			baseSpeed, baseDefense := member.Speed, member.Defense
			w.AddEntity(caster)
			w.AddEntity(member)

			result := w.PerformAbility(caster.ID, caster.X, caster.Z, "", tt.skillName)
			if !result.Accepted {
				t.Fatalf("support cast rejected: %+v", result)
			}
			tt.assert(t, member, baseSpeed, baseDefense)
		})
	}
}

func TestClericMarksUseDistinctAuthoritativeDamageTakenDebuff(t *testing.T) {
	w := newTestWorld()
	cleric := newTestPlayer("cleric", "Cleric")
	cleric.UnlockedSkills = []string{"Mark of Weakness"}
	cleric.Mana = 1000
	target := &Entity{ID: "enemy", Type: TypeEnemy, X: 1, Health: 1000, MaxHealth: 1000, State: "IDLE"}
	w.AddEntity(cleric)
	w.AddEntity(target)

	result := w.PerformAbility(cleric.ID, target.X, target.Z, target.ID, "Mark of Weakness")
	if !result.Accepted || !target.MarkWeakness || target.WeakPointMarked || target.MarkWeaknessFactor != 0.20 {
		t.Fatalf("cleric mark did not use its authoritative debuff: result=%+v mark=%v weakPoint=%v factor=%v", result, target.MarkWeakness, target.WeakPointMarked, target.MarkWeaknessFactor)
	}
	base := 100
	damage, _ := CalculateFinalDamage(cleric, target, base, "holy")
	if damage != 120 {
		t.Fatalf("expected Mark of Weakness to increase all damage by 20%%, got %d", damage)
	}
}

func TestDirectAbilityTargetCannotCrossInstances(t *testing.T) {
	w := newTestWorld()
	cleric := newTestPlayer("cleric", "Cleric")
	cleric.InstanceID = "dungeon-a"
	cleric.UnlockedSkills = []string{"Smite"}
	cleric.Mana = 1000
	target := &Entity{ID: "enemy", InstanceID: "dungeon-b", Type: TypeEnemy, X: 1, Health: 1000, MaxHealth: 1000, State: "IDLE"}
	w.AddEntity(cleric)
	w.AddEntity(target)

	result := w.PerformAbility(cleric.ID, target.X, target.Z, target.ID, "Smite")
	if !result.Accepted {
		t.Fatalf("Smite should still commit even if no valid target is found: %+v", result)
	}
	if target.Health != 1000 || target.Stunned {
		t.Fatalf("cross-instance target was affected: health=%d stunned=%v", target.Health, target.Stunned)
	}
}

func TestCrowdControlRejectsMovementJumpAndCastWithoutAcknowledgingMovement(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("p1", "Fighter")
	player.UnlockedSkills = []string{"Whirlwind"}
	player.Stunned = true
	player.StunEndTime = time.Now().Add(time.Second)
	w.AddEntity(player)

	if w.UpdatePlayerMovement(player.ID, 5, 0, 0, 0, "MOVING", 9) {
		t.Fatal("stunned player movement was accepted")
	}
	if player.X != 0 || player.LastMoveSequence != 0 {
		t.Fatalf("rejected movement changed transform/ack: x=%v sequence=%d", player.X, player.LastMoveSequence)
	}
	if w.StartPlayerJump(player.ID, 5, 0, 0) {
		t.Fatal("stunned player jump was accepted")
	}
	result := w.PerformAbility(player.ID, 0, 0, "", "Whirlwind")
	if result.Accepted || result.Reason != "crowd_controlled" {
		t.Fatalf("stunned player ability was not rejected authoritatively: %+v", result)
	}
}

func TestAbilityCooldownSnapshotPreservesReconnectAuthority(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("p1", "Wizard")
	player.Cooldowns["Fireball"] = time.Now().Add(2 * time.Second)
	player.Cooldowns["Teleport"] = time.Now().Add(-time.Second)
	w.AddEntity(player)

	cooldowns, ok := w.GetAbilityCooldownSnapshot(player.ID)
	if !ok {
		t.Fatal("expected cooldown snapshot")
	}
	if cooldowns["Fireball"] <= 1.5 || cooldowns["Fireball"] > 2 {
		t.Fatalf("unexpected active cooldown: %v", cooldowns["Fireball"])
	}
	if _, exists := cooldowns["Teleport"]; exists {
		t.Fatal("expired cooldown leaked into reconnect snapshot")
	}
}

func TestPerformUnlockSkillRejectsWrongBranchAndLevel(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("p1", "Wizard")
	player.SelectedBranch = "A"
	player.Level = 10
	player.SkillPoints = 10
	w.AddEntity(player)

	if _, ok := w.PerformUnlockSkill(player.ID, "Time Warp"); ok {
		t.Fatal("unlocked a skill from an unselected branch")
	}
	if _, ok := w.PerformUnlockSkill(player.ID, "Meteor Drop"); ok {
		t.Fatal("unlocked a branch skill before its required level")
	}
	if _, ok := w.PerformUnlockSkill(player.ID, "Flame Whip"); !ok {
		t.Fatal("rejected an eligible selected-branch skill")
	}
}

func TestMovementCannotOverrideServerOwnedCharge(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("p1", "Fighter")
	player.IsCharging = true
	player.State = "ATTACKING"
	w.AddEntity(player)

	if w.UpdatePlayerMovement(player.ID, 100, 0, 0, 0, "MOVING", 1) {
		t.Fatal("accepted client movement during authoritative charge")
	}
	if player.X != 0 || player.LastMoveSequence != 0 || player.State != "ATTACKING" {
		t.Fatalf("rejected movement changed charge state: x=%v sequence=%d state=%q", player.X, player.LastMoveSequence, player.State)
	}
}

func TestBasicAttackUsesClassRangeInsteadOfLegacyGlobalRange(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("p1", "Wizard")
	player.AttackCooldown = time.Millisecond
	enemy := &Entity{ID: "enemy", Type: TypeEnemy, X: 17, Health: 100, MaxHealth: 100, State: "IDLE", Scale: 1}
	w.AddEntity(player)
	w.AddEntity(enemy)

	if _, accepted := w.PerformAttack(player.ID, enemy.ID); accepted {
		t.Fatal("accepted a ranged basic attack beyond the authoritative 16-unit range")
	}
}

func TestGuardianRoarBossTauntRequiresSetBonus(t *testing.T) {
	newEncounter := func(withBonus bool) (*World, *Entity, *Entity) {
		w := newTestWorld()
		fighter := newTestPlayer("fighter", "Fighter")
		if withBonus {
			fighter.ActiveSetBonuses = map[string]map[string]int{"bulwark": {"bossTaunt": 1}}
		}
		boss := &Entity{ID: "boss", Type: TypeEnemy, X: 2, Health: 1000, MaxHealth: 1000, State: "IDLE", Scale: 4, Threat: make(map[string]float64)}
		w.AddEntity(fighter)
		w.AddEntity(boss)
		return w, fighter, boss
	}

	w, fighter, boss := newEncounter(false)
	w.performFighterAbility(fighter, 0, 0, "", "Guardian Roar", func(time.Duration) {})
	if boss.Threat[fighter.ID] != 0 {
		t.Fatal("Guardian Roar taunted a boss without the required set bonus")
	}

	w, fighter, boss = newEncounter(true)
	w.performFighterAbility(fighter, 0, 0, "", "Guardian Roar", func(time.Duration) {})
	if boss.Threat[fighter.ID] <= 0 {
		t.Fatal("Guardian Roar set bonus did not enable boss taunt")
	}
}

func TestMeteorResetRequiresFireLethalHit(t *testing.T) {
	w := newTestWorld()
	wizard := newTestPlayer("wizard", "Wizard")
	wizard.ActiveSetBonuses = map[string]map[string]int{"inferno": {"meteorReset": 1}}
	wizard.Cooldowns["Meteor Drop"] = time.Now().Add(time.Minute)
	w.AddEntity(wizard)

	physicalTarget := &Entity{ID: "physical", Type: TypeEnemy, Health: -1, MaxHealth: 100, State: "IDLE", LastDamageType: "physical"}
	w.AddEntity(physicalTarget)
	physicalTarget.Mu.Lock()
	w.handleDeath(physicalTarget, wizard, nil)
	physicalTarget.Mu.Unlock()
	if _, exists := wizard.Cooldowns["Meteor Drop"]; !exists {
		t.Fatal("non-fire kill reset Meteor cooldown")
	}

	fireTarget := &Entity{ID: "fire", Type: TypeEnemy, Health: -1, MaxHealth: 100, State: "IDLE", LastDamageType: "fire"}
	w.AddEntity(fireTarget)
	fireTarget.Mu.Lock()
	w.handleDeath(fireTarget, wizard, nil)
	fireTarget.Mu.Unlock()
	if _, exists := wizard.Cooldowns["Meteor Drop"]; exists {
		t.Fatal("fire kill did not reset Meteor cooldown")
	}
}
