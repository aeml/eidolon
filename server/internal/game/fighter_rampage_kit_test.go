package game

import (
	"slices"
	"testing"
	"time"
)

func TestEveryFighterComboBelongsToALearnedBranch(t *testing.T) {
	covered := map[string]bool{}
	for _, combo := range fighterCombos {
		reachable := false
		for _, branch := range []string{"A", "B", "C"} {
			skills := getSkillsForBranch("Fighter", branch)
			if slices.Contains(skills, combo.FirstSkill) && slices.Contains(skills, combo.SecondSkill) {
				reachable, covered[branch] = true, true
			}
		}
		if !reachable {
			t.Fatal("cross-branch Fighter combo", combo)
		}
	}
	if len(covered) != 3 {
		t.Fatal("missing branch combo", covered)
	}
}

func TestLearnedIronWillWardConsumesOnceAndPreservesOtherShields(t *testing.T) {
	for _, existing := range []bool{false, true} {
		w := newTestWorld()
		t.Cleanup(w.StopBackground)
		p := newTestPlayer("iron-will", "Fighter")
		p.Level = 40
		w.AddEntity(p)
		w.PerformSelectBranch(p.ID, "C")
		p.RecalculateStats()
		p.Health, p.Mana = p.MaxHealth, p.MaxMana
		until := time.Now().Add(time.Minute)
		if existing {
			p.ArcaneShieldActive, p.ArcaneShieldHP, p.ArcaneShieldEndTime = true, 777, until
		}
		cast := func(skill string) {
			p.LastAbilityTime = time.Now().Add(-time.Second)
			if result := w.PerformAbility(p.ID, p.X, p.Z, "", skill); !result.Accepted {
				t.Fatal(result)
			}
		}
		cast("Berserker Edge")
		cast("Last Stand Rampage")
		if p.ActiveCombo != "" || p.IronFortressActive || !p.ArcaneShieldActive {
			t.Fatal("ward missing, combo unconsumed, or borrowed Fortress")
		}
		if existing {
			if p.ArcaneShieldHP != 777 || p.ArcaneShieldEndTime != until {
				t.Fatal("overwrote active ward")
			}
			continue
		}
		if p.ArcaneShieldHP != p.MaxHealth/5 || p.ArcaneShieldEndTime != p.LastStandEndTime {
			t.Fatal("incorrect ward capacity/duration")
		}
		before := p.ArcaneShieldHP
		if hit := resolveImpactDefenseLocked(p, 10, time.Now()); hit.damage != 0 || p.ArcaneShieldHP != before-10 {
			t.Fatal("ward failed to absorb")
		}
		if hit := resolveImpactDefenseLocked(p, 10, p.ArcaneShieldEndTime); hit.damage != 10 || p.ArcaneShieldActive {
			t.Fatal("expired ward absorbed")
		}
		p.Cooldowns["Last Stand Rampage"] = time.Time{}
		cast("Last Stand Rampage")
		if p.ArcaneShieldActive {
			t.Fatal("ordinary followup retained consumed combo")
		}
	}
}

func TestLearnedOffensiveFighterRampageHealthBoundary(t *testing.T) {
	for _, health := range []int{299, 300, 1000} {
		w := newTestWorld()
		t.Cleanup(w.StopBackground)
		p := newTestPlayer("offensive-rampage", "Fighter")
		p.Level = 40
		w.AddEntity(p)
		w.PerformSelectBranch(p.ID, "C")
		p.RecalculateStats()
		p.Mana = p.MaxMana
		p.Health, p.MaxHealth = health, 1000
		mana := p.Mana
		start := time.Now()
		if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Last Stand Rampage"); !result.Accepted {
			t.Fatal(health, result)
		}
		want := 2.0
		if health < 300 {
			want = 3
		}
		if p.LastStandMultiplier != want || p.Mana != mana || p.LastStandEndTime.Sub(start) < 10*time.Second || p.LastStandEndTime.Sub(start) > 11*time.Second {
			t.Fatal("health boundary, cost or duration changed", health, p.LastStandMultiplier, mana, p.Mana, p.LastStandEndTime.Sub(start))
		}
		until := p.LastStandEndTime
		p.LastAbilityTime = time.Now().Add(-time.Second)
		if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Last Stand Rampage"); result.Accepted || p.LastStandEndTime != until {
			t.Fatal("cooldown rejection refreshed rampage", result)
		}
	}
}
