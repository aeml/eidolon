package game

import (
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
