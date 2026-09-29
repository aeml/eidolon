package game

import (
	"math"
	"slices"
	"testing"
	"time"
)

func TestLearnedAssassinMarkEarnsAmbushWithoutCloak(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("assassin-mark", "Rogue")
	p.Level = 40
	w.AddEntity(p)
	w.PerformSelectBranch(p.ID, "A")
	p.Damage, p.CritChanceBonus = 50, 0
	target := &Entity{ID: "ambush-target", Type: TypeEnemy, X: p.X + 2, Z: p.Z, Rotation: math.Pi,
		State: "IDLE", Health: 10000, MaxHealth: 10000}
	w.AddEntity(target)
	if r := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Weak Point Mark"); !r.Accepted {
		t.Fatal(r)
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	if r := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Backstab"); !r.Accepted {
		t.Fatal(r)
	}
	if target.Health != 9850 || p.ActiveCombo != "" {
		t.Fatal("learned Ambush did not deliver guaranteed critical", target.Health)
	}
	if slices.Contains(p.UnlockedSkills, "Cloak & Vanish") {
		t.Fatal("cross-branch unlock granted")
	}
}

func TestEveryRogueComboBelongsToALearnedBranch(t *testing.T) {
	covered := map[string]bool{}
	for _, combo := range rogueCombos {
		found := false
		for _, branch := range []string{"A", "B", "C"} {
			skills := getSkillsForBranch("Rogue", branch)
			if slices.Contains(skills, combo.FirstSkill) && slices.Contains(skills, combo.SecondSkill) {
				found, covered[branch] = true, true
			}
		}
		if !found {
			t.Fatal("cross-branch combo", combo)
		}
	}
	if len(covered) != 3 {
		t.Fatal("branch missing combo", covered)
	}
}

func TestLearnedTricksterVenomTrapClampsPlacementAndConsumesOnce(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("trickster-trap", "Rogue")
	p.Level = 40
	w.AddEntity(p)
	w.PerformSelectBranch(p.ID, "C")
	if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Poison Coating"); !r.Accepted {
		t.Fatal(r)
	}
	for i := 0; i < 2; i++ {
		p.LastAbilityTime = time.Now().Add(-time.Second)
		p.Cooldowns["Tripwire"] = time.Time{}
		mana := p.Mana
		if r := w.PerformAbility(p.ID, p.X+100, p.Z, "", "Tripwire"); !r.Accepted {
			t.Fatal(r)
		}
		want := 20 + p.Stats.Dexterity
		if i == 0 {
			want *= 2
		}
		found := false
		for id, trap := range w.Entities {
			if trap.OwnerID != p.ID || trap.SubType != "Tripwire" {
				continue
			}
			found = true
			if trap.X != p.X+6 || trap.Z != p.Z || trap.Damage != want || p.ActiveCombo != "" || p.Mana != mana-25 {
				t.Fatal("wrong placed trap", trap.X, trap.Damage, want)
			}
			w.Grid.Remove(trap)
			delete(w.Entities, id)
		}
		if !found {
			t.Fatal("no trap created")
		}
	}
}

func TestLearnedThrowingFanCreatesSpacingWithoutReplacingControl(t *testing.T) {
	for _, mode := range []string{"coated", "bare", "immune", "existing", "weighted"} {
		t.Run(mode, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			p := newTestPlayer("throwing-fan", "Rogue")
			p.Level, p.X, p.Z = 40, 60000, 60000
			w.AddEntity(p)
			w.PerformSelectBranch(p.ID, "B")
			target := &Entity{ID: "fan-target", Type: TypeEnemy, SubType: "Skeleton", X: p.X + 6, Z: p.Z,
				State: "IDLE", Scale: 1, Health: 10000, MaxHealth: 10000, CCImmune: mode == "immune"}
			target.BaseStats.Vitality = 1000
			end := time.Now().Add(9 * time.Second)
			if mode == "existing" {
				target.Slowed, target.SlowFactor, target.SlowEndTime = true, .6, end
			}
			if mode == "weighted" {
				p.SkillRunes = map[string]string{"Fan of Knives": "fanofknives_weighted"}
			}
			w.AddEntity(target)
			if mode != "bare" {
				if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Serrated Edges"); !r.Accepted {
					t.Fatal(r)
				}
			}
			p.LastAbilityTime = time.Now().Add(-time.Second)
			if r := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Fan of Knives"); !r.Accepted {
				t.Fatal(r)
			}
			for step := 0; step < 30 && target.Health == target.MaxHealth; step++ {
				for _, e := range w.Entities {
					if e.Type == TypeProjectile && e.OwnerID == p.ID {
						w.updateEntity(e, .05, nil, &deferredActions{})
					}
				}
			}
			if target.Health == target.MaxHealth {
				t.Fatal("Fan failed to hit")
			}
			want := map[string]float64{"coated": .2, "existing": .6, "weighted": .3}[mode]
			if target.Slowed != (want > 0) || (want > 0 && target.SlowFactor != want) {
				t.Fatal("wrong slow", target.Slowed, target.SlowFactor, want)
			}
			if mode == "existing" && target.SlowEndTime != end {
				t.Fatal("existing control refreshed")
			}
			if mode == "coated" || mode == "weighted" {
				wantDuration := 2 * time.Second
				if mode == "weighted" {
					wantDuration = 3 * time.Second
				}
				if remaining := time.Until(target.SlowEndTime); remaining < wantDuration-200*time.Millisecond || remaining > wantDuration {
					t.Fatal("wrong duration", remaining)
				}
			}
		})
	}
}
