package game

import (
	"math"
	"testing"
	"time"
)

// --- helpers ---

// newTestWorld creates a minimal World suitable for ability handler tests.
func newTestWorld() *World {
	return NewWorld(nil)
}

// newTestPlayer creates a player Entity with the given class and enough mana/health for testing.
func newTestPlayer(id, class string) *Entity {
	return &Entity{
		ID:             id,
		Type:           TypePlayer,
		SubType:        class,
		Health:         500,
		MaxHealth:      500,
		Mana:           200,
		MaxMana:        200,
		Level:          10,
		Damage:         50,
		Defense:        10,
		State:          "IDLE",
		Speed:          5.0,
		UnlockedSkills: []string{},
		Cooldowns:      make(map[string]time.Time),
		Equipment:      make(map[string]Item),
		TalentRanks:    make(map[string]int),
	}
}

func singleRoomDungeonLayout() DungeonLayout {
	layout := DungeonLayout{}
	appendDungeonRoom(&layout, DungeonRoom{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"})
	return layout
}

// --- Fighter tests ---

func TestFighterCharge_DeductsManaAndSetsCooldown(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Fighter")
	w.AddEntity(p)

	var cooldownSet time.Duration
	setCooldown := func(d time.Duration) {
		cooldownSet = d
	}

	startMana := p.Mana
	w.performFighterAbility(p, 10, 10, "", "Charge", setCooldown)

	expectedCost := resolveAbilityManaCost(p, "Charge", 20)
	if p.Mana != startMana-expectedCost {
		t.Fatalf("expected mana %d, got %d", startMana-expectedCost, p.Mana)
	}
	if cooldownSet == 0 {
		t.Fatal("expected cooldown to be set, got 0")
	}
	expectedCD := resolveAbilityCooldown("Fighter", "Charge", 5*time.Second)
	if cooldownSet != expectedCD {
		t.Fatalf("expected cooldown %s, got %s", expectedCD, cooldownSet)
	}
	if !p.IsCharging {
		t.Fatal("expected player to be charging")
	}
	if p.State != "ATTACKING" {
		t.Fatalf("expected state ATTACKING, got %s", p.State)
	}
}

func TestFighterCharge_InsufficientMana(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Fighter")
	p.Mana = 0
	w.AddEntity(p)

	setCooldown := func(d time.Duration) {
		t.Fatal("cooldown should not be set when mana insufficient")
	}

	w.performFighterAbility(p, 10, 10, "", "Charge", setCooldown)

	if p.IsCharging {
		t.Fatal("player should not be charging with 0 mana")
	}
}

func TestFighterCharge_FiresAbilityEvent(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Fighter")
	w.AddEntity(p)

	var eventFired bool
	w.OnEvent = func(eventType string, data interface{}) {
		if eventType == "ability" {
			ae := data.(AbilityEvent)
			if ae.SourceID == "p1" && ae.SkillName == "Charge" {
				eventFired = true
			}
		}
	}

	setCooldown := func(d time.Duration) {}
	w.performFighterAbility(p, 10, 10, "", "Charge", setCooldown)

	if !eventFired {
		t.Fatal("expected ability event to be fired for Charge")
	}
}

// --- Wizard tests ---

func TestWizardSpellFocus_ActivatesBuff(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Wizard")
	w.AddEntity(p)

	var cooldownSet time.Duration
	setCooldown := func(d time.Duration) {
		cooldownSet = d
	}

	startMana := p.Mana
	w.performWizardAbility(p, 0, 0, "", "Spell Focus", setCooldown)

	expectedCost := resolveAbilityManaCost(p, "Spell Focus", 30)
	if p.Mana != startMana-expectedCost {
		t.Fatalf("expected mana %d, got %d", startMana-expectedCost, p.Mana)
	}
	if !p.SpellFocusActive {
		t.Fatal("expected SpellFocusActive to be true")
	}
	if cooldownSet == 0 {
		t.Fatal("expected cooldown to be set")
	}
}

func TestWizardSpellFocus_BoostsNextDamageSpellOnly(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Wizard")
	p.UnlockedSkills = []string{"Spell Focus", "Teleport", "Fireball"}
	w.AddEntity(p)

	if result := w.PerformAbility(p.ID, 0, 0, "", "Spell Focus"); !result.Accepted {
		t.Fatalf("Spell Focus rejected: %+v", result)
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	if result := w.PerformAbility(p.ID, 1, 0, "", "Teleport"); !result.Accepted {
		t.Fatalf("Teleport rejected: %+v", result)
	}
	if !p.SpellFocusActive {
		t.Fatal("utility spell consumed Spell Focus")
	}

	p.LastAbilityTime = time.Now().Add(-time.Second)
	if result := w.PerformAbility(p.ID, 10, 0, "", "Fireball"); !result.Accepted {
		t.Fatalf("Fireball rejected: %+v", result)
	}
	if p.SpellFocusActive {
		t.Fatal("damage spell did not consume Spell Focus")
	}
	for _, entity := range w.Entities {
		if entity.OwnerID == p.ID && entity.ProjectileSkill == "Fireball" {
			if entity.Damage != 50 { // (20 + 0 Intelligence) * 2.5
				t.Fatalf("expected focused Fireball damage 50, got %d", entity.Damage)
			}
			return
		}
	}
	t.Fatal("focused Fireball projectile was not spawned")
}

func TestWizardArcaneShield_SetsShieldHP(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Wizard")
	p.Stats.Intelligence = 20
	w.AddEntity(p)

	setCooldown := func(d time.Duration) {}
	w.performWizardAbility(p, 0, 0, "", "Arcane Shield", setCooldown)

	if !p.ArcaneShieldActive {
		t.Fatal("expected ArcaneShieldActive to be true")
	}
	expectedHP := 100 + (20 * 5) // 100 + Intelligence*5
	if p.ArcaneShieldHP != expectedHP {
		t.Fatalf("expected shield HP %d, got %d", expectedHP, p.ArcaneShieldHP)
	}
}

// --- Rogue tests ---

func TestRogueStealth_ActivatesAndDeductsMana(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Rogue")
	w.AddEntity(p)

	var cooldownSet time.Duration
	setCooldown := func(d time.Duration) {
		cooldownSet = d
	}

	startMana := p.Mana
	w.performRogueAbility(p, 0, 0, "", "Stealth", setCooldown)

	expectedCost := resolveAbilityManaCost(p, "Stealth", 25)
	if p.Mana != startMana-expectedCost {
		t.Fatalf("expected mana %d, got %d", startMana-expectedCost, p.Mana)
	}
	if !p.StealthActive {
		t.Fatal("expected StealthActive to be true")
	}
	if cooldownSet == 0 {
		t.Fatal("expected cooldown to be set")
	}
}

func TestRogueStealth_InsufficientMana(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Rogue")
	p.Mana = 0
	w.AddEntity(p)

	setCooldown := func(d time.Duration) {
		t.Fatal("cooldown should not be set with 0 mana")
	}

	w.performRogueAbility(p, 0, 0, "", "Stealth", setCooldown)

	if p.StealthActive {
		t.Fatal("stealth should not activate with 0 mana")
	}
}

// --- Cleric tests ---

func TestClericDivineIntervention_HealsAndActivates(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Cleric")
	p.Health = 200 // Damaged
	w.AddEntity(p)

	var cooldownSet time.Duration
	setCooldown := func(d time.Duration) {
		cooldownSet = d
	}

	startMana := p.Mana
	w.performClericAbility(p, 0, 0, "", "Divine Intervention", setCooldown)

	expectedCost := resolveAbilityManaCost(p, "Divine Intervention", 60)
	if p.Mana != startMana-expectedCost {
		t.Fatalf("expected mana %d, got %d", startMana-expectedCost, p.Mana)
	}
	if !p.DivineInterventionActive {
		t.Fatal("expected DivineInterventionActive to be true")
	}
	// Should heal for MaxHealth/2 = 250, so 200 + 250 = 450
	if p.Health != 450 {
		t.Fatalf("expected health 450, got %d", p.Health)
	}
	if cooldownSet == 0 {
		t.Fatal("expected cooldown to be set")
	}
}

func TestClericDivineIntervention_HealthCap(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Cleric")
	p.Health = 400 // Only 100 below max
	w.AddEntity(p)

	setCooldown := func(d time.Duration) {}
	w.performClericAbility(p, 0, 0, "", "Divine Intervention", setCooldown)

	// Heal = MaxHealth/2 = 250, but capped at MaxHealth (500)
	if p.Health != 500 {
		t.Fatalf("expected health capped at 500, got %d", p.Health)
	}
}

func TestClericDivineIntervention_TargetsAndSavesAlly(t *testing.T) {
	w := newTestWorld()
	cleric := newTestPlayer("cleric-1", "Cleric")
	ally := newTestPlayer("ally-1", "Fighter")
	ally.X = 5
	ally.Health = 100
	w.AddEntity(cleric)
	w.AddEntity(ally)

	w.performClericAbility(cleric, ally.X, ally.Z, ally.ID, "Divine Intervention", func(time.Duration) {})

	if !ally.DivineInterventionActive || cleric.DivineInterventionActive {
		t.Fatalf("expected selected ally alone to receive intervention, cleric=%v ally=%v", cleric.DivineInterventionActive, ally.DivineInterventionActive)
	}
	if ally.Health != 350 {
		t.Fatalf("expected selected ally to receive the 50%% heal, got %d", ally.Health)
	}

	ally.Health = -50
	ally.Mu.Lock()
	w.handleDeath(ally, nil, nil)
	ally.Mu.Unlock()

	if ally.State == "DEAD" || ally.Health != ally.MaxHealth*30/100 {
		t.Fatalf("expected lethal damage prevention to restore 30%% health, state=%s health=%d", ally.State, ally.Health)
	}
	if ally.DivineInterventionActive {
		t.Fatal("expected lethal damage prevention to be consumed")
	}
}

func TestClericDivineIntervention_FiresEvents(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Cleric")
	p.Health = 300
	w.AddEntity(p)

	var abilityFired bool
	w.OnEvent = func(eventType string, data interface{}) {
		if eventType == "ability" {
			ae := data.(AbilityEvent)
			if ae.SourceID == "p1" && ae.SkillName == "Divine Intervention" {
				abilityFired = true
			}
		}
	}

	setCooldown := func(d time.Duration) {}
	w.performClericAbility(p, 0, 0, "", "Divine Intervention", setCooldown)

	if !abilityFired {
		t.Fatal("expected ability event for Divine Intervention")
	}
}

// --- Integration test: PerformAbility dispatches correctly ---

func TestPerformAbility_DispatchesToFighter(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Fighter")
	p.UnlockedSkills = []string{"Charge"}
	w.AddEntity(p)

	var eventFired bool
	w.OnEvent = func(eventType string, data interface{}) {
		if eventType == "ability" {
			ae := data.(AbilityEvent)
			if ae.SourceID == "p1" && ae.SkillName == "Charge" {
				eventFired = true
			}
		}
	}

	startMana := p.Mana
	w.PerformAbility("p1", 10, 10, "", "Charge")

	if p.Mana >= startMana {
		t.Fatal("expected mana to decrease after Charge")
	}
	if !eventFired {
		t.Fatal("expected ability event from PerformAbility dispatch")
	}
}

func TestPerformAbility_DispatchesToWizard(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Wizard")
	p.UnlockedSkills = []string{"Spell Focus"}
	w.AddEntity(p)

	w.PerformAbility("p1", 0, 0, "", "Spell Focus")

	if !p.SpellFocusActive {
		t.Fatal("expected Spell Focus to activate via PerformAbility")
	}
}

func TestPerformAbility_DispatchesToRogue(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Rogue")
	p.UnlockedSkills = []string{"Stealth"}
	w.AddEntity(p)

	w.PerformAbility("p1", 0, 0, "", "Stealth")

	if !p.StealthActive {
		t.Fatal("expected Stealth to activate via PerformAbility")
	}
}

func TestPerformAbility_DispatchesToCleric(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Cleric")
	p.UnlockedSkills = []string{"Divine Intervention"}
	p.Health = 200
	w.AddEntity(p)

	w.PerformAbility("p1", 0, 0, "", "Divine Intervention")

	if !p.DivineInterventionActive {
		t.Fatal("expected Divine Intervention to activate via PerformAbility")
	}
	if p.Health <= 200 {
		t.Fatal("expected health to increase after Divine Intervention")
	}
}

func TestPerformAbility_PreservesMovementForSpiritGuardians(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Cleric")
	p.State = "MOVING"
	p.X = 7
	p.Z = 9
	p.TargetX = 20
	p.TargetZ = 9
	p.LastMoveSequence = 42
	w.AddEntity(p)

	w.PerformAbility("p1", 12, 9, "", "Spirit Guardians")

	if !p.SpiritsActive {
		t.Fatal("expected Spirit Guardians to activate")
	}
	if p.State != "MOVING" {
		t.Fatalf("expected moving cast to preserve MOVING, got %s", p.State)
	}
	if p.X != 7 || p.Z != 9 || p.TargetX != 20 || p.TargetZ != 9 {
		t.Fatalf("moving cast changed locomotion: position=(%v,%v) target=(%v,%v)", p.X, p.Z, p.TargetX, p.TargetZ)
	}
	if p.LastMoveSequence != 42 {
		t.Fatalf("moving cast changed movement acknowledgement: got %d", p.LastMoveSequence)
	}
}

func TestSpiritGuardiansBoostCapturesExpandedRuneOnStandaloneActivation(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Cleric")
	p.SkillRunes = map[string]string{"Spirit Guardians": "spirits_expanded"}
	w.AddEntity(p)

	w.performClericAbility(p, 0, 0, "", "Spirit Guardians Boost", func(time.Duration) {})

	if !p.SpiritsActive || !p.SpiritsBoosted {
		t.Fatal("expected boosted Spirit Guardians to activate")
	}
	if p.SpiritGuardiansRuneID != "spirits_expanded" {
		t.Fatalf("expected expanded rune to be captured, got %q", p.SpiritGuardiansRuneID)
	}
}

func TestPerformAbility_PreservesMovementForProjectileCasts(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Wizard")
	p.State = "MOVING"
	p.UnlockedSkills = []string{"Fireball"}
	p.LastMoveSequence = 17
	w.AddEntity(p)

	w.PerformAbility("p1", 10, 0, "", "Fireball")

	if p.State != "MOVING" {
		t.Fatalf("expected Fireball cast to preserve MOVING, got %s", p.State)
	}
	if p.LastMoveSequence != 17 {
		t.Fatalf("Fireball cast changed movement acknowledgement: got %d", p.LastMoveSequence)
	}
}

func TestPerformAbility_ChargeKeepsServerOwnedMovementState(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Fighter")
	p.State = "MOVING"
	w.AddEntity(p)

	w.PerformAbility("p1", 10, 0, "", "Charge")

	if !p.IsCharging || p.State != "ATTACKING" {
		t.Fatalf("expected Charge to retain server-owned ATTACKING movement, charging=%v state=%s", p.IsCharging, p.State)
	}
}

func TestPerformAbility_RejectsDeadPlayer(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Fighter")
	p.State = "DEAD"
	w.AddEntity(p)

	startMana := p.Mana
	w.PerformAbility("p1", 10, 10, "", "Charge")

	if p.Mana != startMana {
		t.Fatal("dead player should not use mana")
	}
}

func TestPerformAbility_RejectsLockedSkill(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Fighter")
	p.UnlockedSkills = []string{"Charge"} // Only Charge unlocked
	w.AddEntity(p)

	startMana := p.Mana
	w.PerformAbility("p1", 10, 10, "", "Whirlwind")

	if p.Mana != startMana {
		t.Fatal("locked skill should not deduct mana")
	}
}

func TestPerformAbility_BaseSkillAlwaysAllowed(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("p1", "Fighter")
	p.UnlockedSkills = []string{} // Empty — but Charge is base skill
	w.AddEntity(p)

	startMana := p.Mana
	w.PerformAbility("p1", 10, 10, "", "Charge")

	if p.Mana >= startMana {
		t.Fatal("base skill Charge should work even with empty UnlockedSkills")
	}
}

func TestWizardTeleport_ClampsOutOfBoundsTargetInsideDungeon(t *testing.T) {
	w := newTestWorld()
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{ID: "dungeon_test", Layout: singleRoomDungeonLayout()}
	p := newTestPlayer("p1", "Wizard")
	p.InstanceID = "dungeon_test"
	p.X = 10
	p.Z = 0
	w.AddEntity(p)

	setCooldown := func(d time.Duration) {}
	w.performWizardAbility(p, 24, 0, "", "Teleport", setCooldown)

	if p.InstanceID != "dungeon_test" {
		t.Fatalf("expected teleport to remain in dungeon instance, got %q", p.InstanceID)
	}
	if math.Abs(p.X-20) > 0.001 || math.Abs(p.Z) > 0.001 {
		t.Fatalf("expected teleport to clamp to room boundary (20,0), got (%.2f, %.2f)", p.X, p.Z)
	}
}

func TestFighterCharge_ClampsDungeonTargetToWalkableArea(t *testing.T) {
	w := newTestWorld()
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{ID: "dungeon_test", Layout: singleRoomDungeonLayout()}
	p := newTestPlayer("p1", "Fighter")
	p.InstanceID = "dungeon_test"
	p.X = 0
	p.Z = 0
	w.AddEntity(p)

	setCooldown := func(d time.Duration) {}
	w.performFighterAbility(p, 200, 0, "", "Charge", setCooldown)

	if p.ChargeTargetX != 20 || p.ChargeTargetZ != 0 {
		t.Fatalf("expected charge target to clamp to room boundary (20,0), got (%.2f, %.2f)", p.ChargeTargetX, p.ChargeTargetZ)
	}
}

func TestFighterShatteringCharge_ClampsRangeAndAppliesArmorBreak(t *testing.T) {
	w := newTestWorld()
	fighter := newTestPlayer("fighter-1", "Fighter")
	fighter.X = 0
	fighter.Z = 0
	w.AddEntity(fighter)

	enemy := &Entity{
		ID:        "enemy-1",
		Type:      TypeEnemy,
		SubType:   "Skeleton",
		State:     "IDLE",
		Health:    1000,
		MaxHealth: 1000,
		Defense:   20,
		X:         28,
		Z:         0,
		Threat:    make(map[string]float64),
	}
	w.AddEntity(enemy)

	w.performFighterAbility(fighter, 1000, 0, "", "Shattering Charge", func(time.Duration) {})
	if math.Abs(fighter.ChargeTargetX-28) > 0.001 {
		t.Fatalf("expected shattering charge target to clamp to 28 units, got %.2f", fighter.ChargeTargetX)
	}
	w.Update(1)

	if fighter.IsCharging || fighter.ChargeSkillName != "" {
		t.Fatalf("expected charge state to clear after impact, charging=%v skill=%q", fighter.IsCharging, fighter.ChargeSkillName)
	}
	if enemy.ArmorReduction != 5 || time.Until(enemy.ArmorReductionEndTime) <= 0 {
		t.Fatalf("expected shattering charge armor break, reduction=%d end=%v", enemy.ArmorReduction, enemy.ArmorReductionEndTime)
	}
}

func TestPurifyingWave_ClearsSlowAndRecalculatesSpeed(t *testing.T) {
	w := newTestWorld()
	cleric := newTestPlayer("cleric-1", "Cleric")
	ally := newTestPlayer("ally-1", "Fighter")
	ally.X = 2
	ally.BaseStats = Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}
	ally.RecalculateStats()
	baseSpeed := ally.Speed
	ally.Slowed = true
	ally.SlowFactor = 0.5
	ally.SlowEndTime = time.Now().Add(time.Minute)
	ally.Bleeding = true
	ally.BleedDamage = 10
	ally.BleedSourceID = "enemy"
	ally.Poisoned = true
	ally.PoisonDamage = 10
	ally.PoisonSourceID = "enemy"
	ally.RecalculateStats()
	if ally.Speed >= baseSpeed {
		t.Fatalf("test setup did not slow ally: base=%v slowed=%v", baseSpeed, ally.Speed)
	}
	w.AddEntity(cleric)
	w.AddEntity(ally)

	w.performClericAbility(cleric, cleric.X, cleric.Z, "", "Purifying Wave", func(time.Duration) {})

	if ally.Slowed || ally.Bleeding || ally.Poisoned || ally.SlowFactor != 0 {
		t.Fatalf("cleanse left debuffs active: slowed=%v bleed=%v poison=%v factor=%v", ally.Slowed, ally.Bleeding, ally.Poisoned, ally.SlowFactor)
	}
	if ally.BleedSourceID != "" || ally.PoisonSourceID != "" {
		t.Fatalf("cleanse retained DoT ownership: bleed=%q poison=%q", ally.BleedSourceID, ally.PoisonSourceID)
	}
	if ally.Speed != baseSpeed {
		t.Fatalf("cleanse left stale slowed speed: got=%v want=%v", ally.Speed, baseSpeed)
	}
}

func TestCloakAndVanishSpeedBurstIsAuthoritativeAndExpires(t *testing.T) {
	w := newTestWorld()
	rogue := newTestPlayer("rogue-cloak", "Rogue")
	rogue.BaseStats = Stats{Dexterity: 10, Vitality: 10, Intelligence: 10}
	rogue.RecalculateStats()
	baseSpeed := rogue.Speed
	w.AddEntity(rogue)

	w.performRogueAbility(rogue, 0, 0, "", "Cloak & Vanish", func(time.Duration) {})
	if rogue.Speed != baseSpeed*2 {
		t.Fatalf("expected authoritative 100%% cloak burst, got=%v base=%v", rogue.Speed, baseSpeed)
	}

	rogue.CloakBurstSpeedEndTime = time.Now().Add(-time.Millisecond)
	w.updateEntity(rogue, 0.016, nil, &deferredActions{})
	if rogue.CloakBurstSpeedBonus || rogue.Speed != baseSpeed {
		t.Fatalf("cloak burst left stale speed after expiry: active=%v speed=%v want=%v", rogue.CloakBurstSpeedBonus, rogue.Speed, baseSpeed)
	}
}

func TestTripwireRootsForThreeSecondsAndRespectsCCImmunity(t *testing.T) {
	for _, test := range []struct {
		name     string
		ccImmune bool
		rooted   bool
	}{
		{name: "ordinary enemy", rooted: true},
		{name: "cc immune enemy", ccImmune: true, rooted: false},
	} {
		t.Run(test.name, func(t *testing.T) {
			w := newTestWorld()
			rogue := newTestPlayer("rogue-tripwire", "Rogue")
			enemy := &Entity{
				ID: "enemy-tripwire", Type: TypeEnemy, Health: 200, MaxHealth: 200,
				State: "IDLE", CCImmune: test.ccImmune, Scale: 1,
			}
			w.AddEntity(rogue)
			w.AddEntity(enemy)
			w.performRogueAbility(rogue, 0, 0, "", "Tripwire", func(time.Duration) {})

			for _, entity := range w.Entities {
				if entity.SubType == "Tripwire" {
					w.updateEntity(entity, 0.016, nil, &deferredActions{})
					break
				}
			}

			if enemy.Rooted != test.rooted {
				t.Fatalf("rooted=%v, want %v", enemy.Rooted, test.rooted)
			}
			if test.rooted {
				remaining := time.Until(enemy.RootEndTime)
				if remaining < 2500*time.Millisecond || remaining > 3100*time.Millisecond {
					t.Fatalf("tripwire root duration=%v, want about 3s", remaining)
				}
			}
		})
	}
}

func TestPoisonCoatingHealingReductionMatchesClientContract(t *testing.T) {
	target := &Entity{Poisoned: true}
	if got := applyHealingReceived(target, 101); got != 50 {
		t.Fatalf("poisoned heal=%d, want 50", got)
	}
	target.Poisoned = false
	if got := applyHealingReceived(target, 101); got != 101 {
		t.Fatalf("unpoisoned heal=%d, want 101", got)
	}
}

func TestTeleportRejectsStaleMovementUntilAbilityLockExpires(t *testing.T) {
	w := newTestWorld()
	wizard := newTestPlayer("wizard-teleport", "Wizard")
	wizard.UnlockedSkills = []string{"Teleport"}
	w.AddEntity(wizard)

	result := w.PerformAbility(wizard.ID, 10, 0, "", "Teleport")
	if !result.Accepted || wizard.X != 10 {
		t.Fatalf("teleport failed: result=%+v x=%v", result, wizard.X)
	}
	if w.UpdatePlayerMovement(wizard.ID, 0, 0, 0, 0, "MOVING", 1) {
		t.Fatal("accepted a stale pre-teleport movement sample during the ability lock")
	}
	if wizard.X != 10 || wizard.LastMoveSequence != 0 {
		t.Fatalf("stale sample overwrote teleport: x=%v sequence=%d", wizard.X, wizard.LastMoveSequence)
	}

	wizard.MoveLockUntil = time.Now().Add(-time.Millisecond)
	if !w.UpdatePlayerMovement(wizard.ID, 11, 0, 0, 0, "MOVING", 2) {
		t.Fatal("movement remained locked after the authoritative window expired")
	}
}

func TestPerformAbilityRejectsCastDuringServerOwnedCharge(t *testing.T) {
	w := newTestWorld()
	fighter := newTestPlayer("fighter-action-lock", "Fighter")
	fighter.UnlockedSkills = []string{"Whirlwind"}
	fighter.IsCharging = true
	w.AddEntity(fighter)

	result := w.PerformAbility(fighter.ID, 0, 0, "", "Whirlwind")
	if result.Accepted || result.Reason != "action_locked" {
		t.Fatalf("cast during charge result=%+v, want action_locked", result)
	}
}

func TestWizardDragonfireUsesDistinctProjectileContract(t *testing.T) {
	w := newTestWorld()
	wizard := newTestPlayer("wizard-1", "Wizard")
	w.AddEntity(wizard)

	w.performWizardAbility(wizard, 10, 0, "", "Dragonfire Lance", func(time.Duration) {})

	for _, entity := range w.Entities {
		if entity.OwnerID != wizard.ID {
			continue
		}
		if entity.SubType != "DragonfireLance" || entity.ProjectileSkill != "Dragonfire Lance" {
			t.Fatalf("Dragonfire inherited another projectile contract: subtype=%q skill=%q", entity.SubType, entity.ProjectileSkill)
		}
		return
	}
	t.Fatal("Dragonfire projectile was not spawned")
}

func TestRogueBackstabShadowstep_ClampsInsideDungeon(t *testing.T) {
	w := newTestWorld()
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{ID: "dungeon_test", Layout: singleRoomDungeonLayout()}
	p := newTestPlayer("p1", "Rogue")
	p.InstanceID = "dungeon_test"
	p.X = 17.5
	p.Z = 0
	p.SkillRunes = map[string]string{"Backstab": "backstab_shadowstep"}
	w.AddEntity(p)

	enemy := &Entity{
		ID:         "enemy-1",
		InstanceID: "dungeon_test",
		Type:       TypeEnemy,
		SubType:    "Skeleton",
		State:      "IDLE",
		Health:     100,
		MaxHealth:  100,
		Defense:    0,
		X:          19,
		Z:          0,
		Rotation:   -math.Pi / 2,
	}
	w.AddEntity(enemy)

	setCooldown := func(d time.Duration) {}
	w.performRogueAbility(p, 0, 0, "", "Backstab", setCooldown)

	if p.X > 20.001 || math.Abs(p.Z) > 0.001 {
		t.Fatalf("expected shadowstep to clamp inside dungeon boundary, got (%.2f, %.2f)", p.X, p.Z)
	}
}

func TestChargeShockwave_ClampsForcedMovementInsideDungeon(t *testing.T) {
	w := newTestWorld()
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{ID: "dungeon_test", Layout: singleRoomDungeonLayout()}
	fighter := newTestPlayer("fighter-1", "Fighter")
	fighter.InstanceID = "dungeon_test"
	fighter.X = 15
	fighter.Z = 0
	fighter.IsCharging = true
	fighter.ChargeTargetX = 15
	fighter.ChargeTargetZ = 0
	fighter.ChargeRuneID = "charge_shockwave"
	fighter.State = "ATTACKING"
	w.AddEntity(fighter)

	enemy := &Entity{
		ID:         "enemy-1",
		InstanceID: "dungeon_test",
		Type:       TypeEnemy,
		SubType:    "Skeleton",
		State:      "IDLE",
		Health:     100,
		MaxHealth:  100,
		X:          19,
		Z:          0,
	}
	w.AddEntity(enemy)

	w.Update(0.1)

	if enemy.X > 20.001 || enemy.Z != 0 {
		t.Fatalf("expected knockback to remain inside dungeon boundary, got (%.2f, %.2f)", enemy.X, enemy.Z)
	}
}
