package game

import (
	"testing"
	"time"
)

func TestPaidStatusTicksRespectReceivingShield(t *testing.T) {
	for _, skill := range []string{"Shadow Strike", "Poison Coating"} {
		t.Run(skill, func(t *testing.T) {
			w, source, defender := abilityDefenseDuel(t, "Rogue", skill, "arcaneshield_reflective")
			if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, skill); !result.Accepted {
				t.Fatal("paid status skill rejected")
			}
			if skill == "Poison Coating" {
				source.AttackCooldown = 100 * time.Millisecond
				if _, accepted := w.PerformAttack(source.ID, defender.ID); !accepted {
					t.Fatal("coated attack rejected")
				}
				w.backgroundWork.SealWhenIdle()
			}
			damage := defender.BleedDamage
			if skill == "Poison Coating" {
				damage = defender.PoisonDamage
			}
			if damage <= 0 || (!defender.Bleeding && !defender.Poisoned) {
				t.Fatal("ordinary attack did not apply a wound")
			}
			health, capacity, absorbed, sourceHP := defender.Health, defender.ArcaneShieldHP, defender.ArcaneShieldAbsorbed, source.Health
			// Changing the source after application cannot reroll or magnify the
			// stored wound. Receiving modifiers alone are evaluated at tick time.
			source.Damage, source.CritChanceBonus, source.PoisonDamageBonus = 10000, 1, 4
			// Ticks consume the wound's stored budget without rerolling its hit.
			w.updateEntity(defender, .01, nil, &deferredActions{})
			if defender.Health != health || defender.ArcaneShieldHP != capacity-damage || defender.ArcaneShieldAbsorbed != absorbed+damage || source.Health != sourceHP-damage*30/100 {
				t.Fatalf("status bypassed shield/reflect: hp=%d/%d capacity=%d/%d source=%d/%d", defender.Health, health, defender.ArcaneShieldHP, capacity-damage, source.Health, sourceHP-damage*30/100)
			}
			capacity, sourceHP = defender.ArcaneShieldHP, source.Health
			w.updateEntity(defender, .01, nil, &deferredActions{})
			if defender.ArcaneShieldHP != capacity || source.Health != sourceHP {
				t.Fatal("early update repeated a status tick")
			}
		})
	}
}

func TestPaidBleedReceivingReductionsAndPartialAbsorption(t *testing.T) {
	for _, tc := range []struct {
		name               string
		incoming, capacity int
		configure          func(*Entity)
	}{
		{"partial", 6, 3, nil},
		{"sanctuary", 4, 100, func(p *Entity) { p.SanctuaryDamageReduction = true; p.SanctuaryEndTime = time.Now().Add(time.Minute) }},
		{"guardian", 3, 100, func(p *Entity) {
			p.DivineInterventionGuardian = true
			p.DivineInterventionGuardTime = time.Now().Add(time.Minute)
		}},
		{"invulnerable", 0, 100, func(p *Entity) { p.InvulnerableEndTime = time.Now().Add(time.Minute) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w, source, defender := abilityDefenseDuel(t, "Rogue", "Shadow Strike", "arcaneshield_reflective")
			if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Shadow Strike"); !result.Accepted || defender.BleedDamage != 6 {
				t.Fatal("paid bleed setup failed")
			}
			defender.ArcaneShieldHP = tc.capacity
			if tc.configure != nil {
				tc.configure(defender)
			}
			health, sourceHP := defender.Health, source.Health
			w.updateEntity(defender, .01, nil, &deferredActions{})
			absorbed := min(tc.incoming, tc.capacity)
			if defender.Health != health-(tc.incoming-absorbed) || defender.ArcaneShieldHP != tc.capacity-absorbed || source.Health != sourceHP-absorbed*30/100 {
				t.Fatalf("wrong receiving order: health=%d capacity=%d source=%d", defender.Health, defender.ArcaneShieldHP, source.Health)
			}
		})
	}
}

func TestPaidBleedReflectionKillsLiveSource(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Rogue", "Shadow Strike", "arcaneshield_reflective")
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Shadow Strike"); !result.Accepted {
		t.Fatal("paid wound rejected")
	}
	source.Health = 1
	w.updateEntity(defender, .01, nil, &deferredActions{})
	if source.Health != 0 || source.State != "DEAD" || defender.Health != 500 {
		t.Fatal("tick reflection did not resolve ordinary live-source death")
	}
}

func TestParallelWoundsAndPaidShieldsDoNotInvertActorLocks(t *testing.T) {
	w, first, second := abilityDefenseDuel(t, "Wizard", "Arcane Shield", "arcaneshield_reflective")
	first.Stats.Intelligence = 100
	first.SkillRunes = map[string]string{"Arcane Shield": "arcaneshield_reflective"}
	if result := w.PerformAbility(first.ID, first.X, first.Z, "", "Arcane Shield"); !result.Accepted {
		t.Fatal("second real shield rejected")
	}
	// Prepared opposing wounds isolate simultaneous lock ownership; shield
	// creation and the parallel update remain ordinary production paths.
	first.Bleeding, first.BleedDamage, first.BleedSourceID = true, 10, second.ID
	first.BleedEndTime = time.Now().Add(time.Minute)
	second.Poisoned, second.PoisonDamage, second.PoisonSourceID = true, 8, first.ID
	second.PoisonEndTime = time.Now().Add(time.Minute)
	w.Update(.01)
	if first.Health != 498 || second.Health != 497 || first.ArcaneShieldHP != 590 || second.ArcaneShieldHP != 592 {
		t.Fatalf("parallel wound/reflection budgets wrong: health=%d/%d shield=%d/%d", first.Health, second.Health, first.ArcaneShieldHP, second.ArcaneShieldHP)
	}
}
