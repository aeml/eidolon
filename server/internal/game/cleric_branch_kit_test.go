package game

import (
	"slices"
	"testing"
	"time"
)

func TestEveryClericComboFitsALearnedBranch(t *testing.T) {
	covered := map[string]bool{}
	for _, combo := range clericCombos {
		found := false
		for _, branch := range []string{"A", "B", "C"} {
			skills := getSkillsForBranch("Cleric", branch)
			if slices.Contains(skills, combo.FirstSkill) && slices.Contains(skills, combo.SecondSkill) {
				found, covered[branch] = true, true
			}
		}
		if !found {
			t.Fatal("unreachable combo", combo)
		}
	}
	if len(covered) != 3 {
		t.Fatal("missing branch", covered)
	}
}

func TestLearnedClericBranchesDeliverAndConsumeCombos(t *testing.T) {
	for _, tc := range []struct{ branch, first, second string }{
		{"A", "Healing Light", "Guardian Embrace"},
		{"B", "Consecrated Ground", "Radiant Strike"},
		{"C", "Blessing of Zeal", "Spirit Guardians"},
	} {
		t.Run(tc.branch, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			p := newTestPlayer("cleric-kit", "Cleric")
			p.Level, p.X, p.Z = 40, 60000, 60000
			w.AddEntity(p)
			w.PerformSelectBranch(p.ID, tc.branch)
			if tc.branch == "C" {
				p.Cooldowns["Spirit Guardians"] = time.Now().Add(time.Minute)
			}
			target := &Entity{ID: "kit-target", Type: TypeEnemy, X: p.X, Z: p.Z + 2,
				State: "IDLE", Health: 10000, MaxHealth: 10000, BaseStats: Stats{Vitality: 1000}, CCImmune: true}
			w.AddEntity(target)
			if r := w.PerformAbility(p.ID, p.X, p.Z, "", tc.first); !r.Accepted {
				t.Fatal(r)
			}
			if tc.branch == "C" && p.Cooldowns["Spirit Guardians"].After(time.Now()) {
				t.Fatal("Zeal did not rearm own Guardians")
			}
			for i := 0; i < 2; i++ {
				p.LastAbilityTime = time.Now().Add(-time.Second)
				p.Cooldowns[tc.second] = time.Time{}
				p.InvulnerableEndTime = time.Time{}
				p.Damage, p.Stats.Wisdom, p.CritChanceBonus = 50, 25, 0
				hp, mana := target.Health, p.Mana
				if r := w.PerformAbility(p.ID, target.X, target.Z, "", tc.second); !r.Accepted {
					t.Fatal(r)
				}
				if p.ActiveCombo != "" || p.Mana >= mana || !p.Cooldowns[tc.second].After(time.Now()) {
					t.Fatal("combo cost/cooldown/consumption wrong")
				}
				switch tc.branch {
				case "A":
					if p.InvulnerableEndTime.After(time.Now()) != (i == 0) || target.InvulnerableEndTime.After(time.Now()) {
						t.Fatal("caster-only Sanctuary not consumed once")
					}
				case "B":
					want := 100
					if i == 0 {
						want = 200
					}
					if hp-target.Health != want || target.MarkWeakness {
						t.Fatal("Holy Fury did not work without a mark", hp-target.Health, want)
					}
				case "C":
					if p.SpiritsBoosted != (i == 0) {
						t.Fatal("Divine Storm not consumed once")
					}
					want := 16.0
					if i == 0 {
						want = 20
					}
					if p.SpiritRadius != want {
						t.Fatal("wrong spirit footprint", p.SpiritRadius)
					}
				}
			}
		})
	}
}

func TestPurifyingPulseHonorsCoverImmunityAndExistingSlow(t *testing.T) {
	for _, mode := range []string{"ordinary", "wall", "immune", "existing"} {
		t.Run(mode, func(t *testing.T) {
			w, p, target := directSkillWallFixture("Cleric", mode != "wall")
			t.Cleanup(w.StopBackground)
			p.Level = 30
			w.PerformSelectBranch(p.ID, "A")
			target.CCImmune = mode == "immune"
			end := time.Now().Add(9 * time.Second)
			if mode == "existing" {
				target.Slowed, target.SlowFactor, target.SlowEndTime = true, .6, end
			}
			p.Poisoned, p.PoisonDamage = true, 10
			hp := target.Health
			if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Purifying Wave"); !r.Accepted {
				t.Fatal(r)
			}
			if p.Poisoned || (target.Health < hp) != (mode != "wall") {
				t.Fatal("cleanse or hostile cover wrong", hp, target.Health)
			}
			if target.Slowed != (mode == "ordinary" || mode == "existing") {
				t.Fatal("slow ignored cover/immunity")
			}
			if mode == "ordinary" && (target.SlowFactor != .3 || time.Until(target.SlowEndTime) > 2*time.Second) {
				t.Fatal("wrong pulse slow")
			}
			if mode == "existing" && (target.SlowFactor != .6 || target.SlowEndTime != end) {
				t.Fatal("existing slow overwritten")
			}
		})
	}
}
