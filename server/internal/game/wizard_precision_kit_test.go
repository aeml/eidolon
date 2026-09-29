package game

import (
	"fmt"
	"testing"
	"time"
)

func TestPrecisionBeamOffersLevelTenControlWithoutIgnoringWallsOrImmunity(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		for _, immune := range []bool{false, true} {
			t.Run(fmt.Sprintf("doorway=%v/immune=%v", doorway, immune), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Wizard", doorway)
				t.Cleanup(w.StopBackground)
				p.Level, target.CCImmune = 10, immune
				w.PerformSelectBranch(p.ID, "B")
				if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Scorch Beam"); !result.Accepted {
					t.Fatal(result)
				}
				if got := target.Health < target.MaxHealth; got != doorway {
					t.Fatalf("wall/damage mismatch: %v", got)
				}
				if target.Slowed != (doorway && !immune) {
					t.Fatal("control ignored wall or immunity")
				}
				if target.Slowed && (target.SlowFactor != .30 || !target.SlowEndTime.After(time.Now()) || time.Until(target.SlowEndTime) > 3*time.Second) {
					t.Fatal("incorrect slow strength/duration")
				}
			})
		}
	}
}

func TestPrecisionBeamPreservesAnExistingSlow(t *testing.T) {
	w, p, target := directSkillWallFixture("Wizard", true)
	t.Cleanup(w.StopBackground)
	w.PerformSelectBranch(p.ID, "B")
	until := time.Now().Add(10 * time.Second)
	target.Slowed, target.SlowFactor, target.SlowEndTime = true, .6, until
	if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Scorch Beam"); !result.Accepted {
		t.Fatal(result)
	}
	if target.SlowFactor != .6 || target.SlowEndTime != until {
		t.Fatal("beam overwrote an existing slow")
	}
}

func TestPrecisionBranchEarnsBarrageWithoutCrossBranchSkills(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("precision", "Wizard")
	p.Level = 40
	w.AddEntity(p)
	if _, ok := w.PerformSelectBranch(p.ID, "B"); !ok {
		t.Fatal("branch selection failed")
	}
	if result := w.PerformAbility(p.ID, p.X+8, p.Z, "", "Scorch Beam"); !result.Accepted {
		t.Fatal(result)
	}
	p.LastAbilityTime = time.Now().Add(-time.Second) // advance only GCD, not combo window
	before := p.Mana
	if result := w.PerformAbility(p.ID, p.X+8, p.Z, "", "Arcane Missiles"); !result.Accepted {
		t.Fatal(result)
	}
	count := 0
	for _, e := range w.Entities {
		if e.OwnerID == p.ID && e.SubType == "ArcaneMissile" {
			count++
		}
	}
	if count != 5 || p.Mana != before-30 || p.ActiveCombo != "" || !p.Cooldowns["Arcane Missiles"].After(time.Now()) {
		t.Fatalf("barrage did not settle once: missiles=%d mana=%d combo=%q", count, p.Mana, p.ActiveCombo)
	}
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Arcane Shield"); result.Accepted {
		t.Fatal("B gained a cross-branch skill")
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	p.Cooldowns["Arcane Missiles"] = time.Now().Add(-time.Second)
	if result := w.PerformAbility(p.ID, p.X+8, p.Z, "", "Arcane Missiles"); !result.Accepted {
		t.Fatal(result)
	}
	count = 0
	for _, e := range w.Entities {
		if e.OwnerID == p.ID && e.SubType == "ArcaneMissile" {
			count++
		}
	}
	if count != 8 {
		t.Fatalf("ordinary followup should add only three missiles: %d", count)
	}
}

func TestPrecisionFocusWardPreservesExistingShieldAndExpires(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("focus-ward", "Wizard")
	p.Level, p.Stats.Intelligence = 40, 30
	w.AddEntity(p)
	w.PerformSelectBranch(p.ID, "B")
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Spell Focus"); !result.Accepted {
		t.Fatal(result)
	}
	if !p.SpellFocusActive || !p.ArcaneShieldActive || p.ArcaneShieldHP != 100 || time.Until(p.ArcaneShieldEndTime) > 6*time.Second {
		t.Fatal("focus did not supply its brief ward")
	}
	if hit := resolveImpactDefenseLocked(p, 25, time.Now()); hit.damage != 0 || p.ArcaneShieldHP != 75 {
		t.Fatal("paid Focus ward did not absorb incoming damage")
	}
	if hit := resolveImpactDefenseLocked(p, 25, p.ArcaneShieldEndTime); hit.damage != 25 || p.ArcaneShieldActive || p.ArcaneShieldHP != 0 {
		t.Fatal("Focus ward still absorbed at its expiry boundary")
	}
	until := time.Now().Add(time.Minute)
	p.ArcaneShieldActive = true
	p.ArcaneShieldHP, p.ArcaneShieldEndTime, p.ArcaneShieldRuneID = 500, until, "existing"
	p.LastAbilityTime = time.Now().Add(-time.Second)
	p.Cooldowns["Spell Focus"] = time.Now().Add(-time.Second)
	w.PerformAbility(p.ID, p.X, p.Z, "", "Spell Focus")
	if p.ArcaneShieldHP != 500 || p.ArcaneShieldEndTime != until || p.ArcaneShieldRuneID != "existing" {
		t.Fatal("focus replaced another active ward")
	}
}
