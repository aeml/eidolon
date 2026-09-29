package game

import "testing"

func TestLearnedControlFighterGripStrikesAndThreatensImmuneBoss(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level = 40
	p.BaseStats = InitialPlayerStats()
	p.BaseStats.Strength = 40
	if _, ok := w.PerformSelectBranch(p.ID, "B"); !ok {
		t.Fatal("branch selection failed")
	}
	p.RecalculateStats()
	p.Mana = p.MaxMana
	target.CCImmune = true
	target.Health, target.MaxHealth, target.Defense = 10000, 10000, 0
	x, z, mana := target.X, target.Z, p.Mana
	if result := w.PerformAbility(p.ID, x, z, target.ID, "Unbreakable Grip"); !result.Accepted {
		t.Fatal(result)
	}
	damage := 10000 - target.Health
	if damage <= 0 || target.X != x || target.Z != z || target.Rooted || target.Stunned || !target.CCImmune {
		t.Fatal("boss must take damage but retain control immunity", damage)
	}
	if p.Mana != mana-35 {
		t.Fatal("Grip price changed")
	}
	if target.Threat[p.ID] != float64(damage)*2 {
		t.Fatal("Grip did not grant its double-damage threat", target.Threat)
	}
}
