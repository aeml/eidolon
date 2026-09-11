package game

import (
	"testing"
	"time"
)

func abilityDefenseDuel(t *testing.T, class, skill, shieldRune string) (*World, *Entity, *Entity) {
	t.Helper()
	source, defender := newTestPlayer("reaction-caster", class), newTestPlayer("reaction-defender", "Wizard")
	source.Level, defender.Level = 100, 100
	source.UnlockedSkills, defender.UnlockedSkills = []string{skill}, []string{"Arcane Shield"}
	source.Stats.Strength, source.Stats.Intelligence, source.Stats.Wisdom = 10, 10, 10
	defender.Stats.Intelligence = 100
	defender.SkillRunes = map[string]string{"Arcane Shield": shieldRune}
	w := newPvPTestWorld(source, defender)
	t.Cleanup(w.StopBackground)
	challenge, err := w.RequestDuel(source.ID, defender.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.RespondDuel(defender.ID, challenge.RequesterID, true); err != nil {
		t.Fatal(err)
	}
	for i, p := range []*Entity{source, defender} {
		oldX, oldZ := p.X, p.Z
		p.X, p.Z = float64(i*2), 0
		p.InvulnerableEndTime = time.Now().Add(-time.Second)
		w.Grid.Update(p, oldX, oldZ)
	}
	if result := w.PerformAbility(defender.ID, defender.X, defender.Z, "", "Arcane Shield"); !result.Accepted || defender.ArcaneShieldHP != 600 {
		t.Fatal("paid shield rejected")
	}
	return w, source, defender
}

func TestImmediateAbilityReflectionDeathSurvivesCastBookkeeping(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Wizard", "Flame Whip", "arcaneshield_reflective")
	source.Health = 1
	result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Flame Whip")
	if !result.Accepted || result.CooldownRemaining <= 0 {
		t.Fatal("ordinary reflected cast not committed")
	}
	if source.Health > 0 || source.State != "DEAD" {
		t.Fatalf("cast bookkeeping overwrote reflected death: hp=%d state=%s", source.Health, source.State)
	}
	if defender.Health != 500 || defender.ArcaneShieldAbsorbed != 29 {
		t.Fatal("incoming strike was not absorbed exactly once")
	}
}

func TestImmediateFortifyDoesNotCloneAbsorbedDamage(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Fighter", "Shield Slam", "")
	source.SkillRunes = map[string]string{"Shield Slam": "shieldslam_fortify"}
	result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Shield Slam")
	if !result.Accepted || defender.ArcaneShieldAbsorbed != 42 || defender.Health != 500 {
		t.Fatal("shielded strike failed")
	}
	if source.ArcaneShieldActive || source.ArcaneShieldHP != 0 {
		t.Fatal("Fortify earned a shield from fully absorbed damage")
	}
}

func TestImpactContextReflectsAgainstLiveAttackerNotSnapshot(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Fighter", "Shield Slam", "arcaneshield_reflective")
	source.Mu.RLock()
	snapshot := snapshotCombatAttackerLocked(source)
	source.Mu.RUnlock()
	ctx := &abilityImpactContext{world: w, worldLocked: false}
	defender.Mu.Lock()
	damage := ctx.damage(snapshot, defender, 65, "physical", "Shield Slam")
	defender.Mu.Unlock()
	if damage != 0 || source.Health != 500 {
		t.Fatal("reaction ran before lock-free flush")
	}
	ctx.flush()
	if source.Health != 488 || snapshot.Health != 500 {
		t.Fatalf("reflection affected wrong attacker: live=%d snapshot=%d", source.Health, snapshot.Health)
	}
	ctx.flush()
	if source.Health != 488 {
		t.Fatal("reaction applied twice")
	}
}

func TestImmediateAbilityDefenseOrdering(t *testing.T) {
	for _, tc := range []struct {
		name                                  string
		capacity, hpLoss, absorbed, reflected int
		configure                             func(*Entity)
	}{
		{"partial", 20, 22, 0, 6, nil},
		{"sanctuary", 600, 0, 33, 9, func(p *Entity) {
			p.SanctuaryDamageReduction = true
			p.SanctuaryEndTime = time.Now().Add(time.Minute)
		}},
		{"strongest sanctuary then guardian", 600, 0, 14, 4, func(p *Entity) {
			p.SanctuaryDamageReduction = true
			p.SanctuaryEndTime = time.Now().Add(time.Minute)
			p.ConsecratedSanctuaryEndTime = time.Now().Add(time.Minute)
			p.DivineInterventionGuardian = true
			p.DivineInterventionGuardTime = time.Now().Add(time.Minute)
		}},
		{"invulnerable", 600, 0, 0, 0, func(p *Entity) {
			p.InvulnerableEndTime = time.Now().Add(time.Minute)
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w, source, defender := abilityDefenseDuel(t, "Fighter", "Shield Slam", "arcaneshield_reflective")
			// Remaining-capacity fixture after an ordinary paid shield cast.
			defender.ArcaneShieldHP = tc.capacity
			if tc.configure != nil {
				tc.configure(defender)
			}
			if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Shield Slam"); !result.Accepted {
				t.Fatal("paid attack rejected")
			}
			if defender.Health != 500-tc.hpLoss || defender.ArcaneShieldAbsorbed != tc.absorbed || source.Health != 500-tc.reflected {
				t.Fatalf("wrong reduction/absorption/reflection: hp=%d absorbed=%d casterHP=%d", defender.Health, defender.ArcaneShieldAbsorbed, source.Health)
			}
			if tc.hpLoss > 0 && (defender.ArcaneShieldActive || defender.ArcaneShieldHP != 0) {
				t.Fatal("depleted shield retained capacity")
			}
		})
	}
}
