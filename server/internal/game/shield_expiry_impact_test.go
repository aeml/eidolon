package game

import (
	"testing"
	"time"
)

func TestPaidShieldExpiryCheckedAtImpact(t *testing.T) {
	for _, runeID := range []string{"arcaneshield_reflective", "arcaneshield_explosive"} {
		for _, clock := range []string{"active", "expired", "missing"} {
			t.Run(runeID+"/"+clock, func(t *testing.T) {
				w, source, defender := abilityDefenseDuel(t, "Fighter", "Shield Slam", runeID)
				defender.ArcaneShieldAbsorbed = 50 // Existing absorbed history must not detonate on expiry.
				if clock == "expired" {
					defender.ArcaneShieldEndTime = time.Now().Add(-time.Nanosecond)
				}
				if clock == "missing" {
					defender.ArcaneShieldEndTime = time.Time{}
				}
				if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Shield Slam"); !result.Accepted {
					t.Fatal("paid strike rejected")
				}
				if clock == "active" {
					if defender.Health != 500 || defender.ArcaneShieldHP != 558 || defender.ArcaneShieldAbsorbed != 92 {
						t.Fatal("active shield positive control failed")
					}
					return
				}
				if defender.Health != 458 || source.Health != 500 || defender.ArcaneShieldActive || defender.ArcaneShieldHP != 0 || defender.ArcaneShieldAbsorbed != 0 || defender.ArcaneShieldRuneID != "" {
					t.Fatalf("expired shield still defended/retaliated: hp=%d source=%d active=%v capacity=%d absorbed=%d rune=%s", defender.Health, source.Health, defender.ArcaneShieldActive, defender.ArcaneShieldHP, defender.ArcaneShieldAbsorbed, defender.ArcaneShieldRuneID)
				}
			})
		}
	}
}

func TestPaidShieldExpiresAtExactImpactBoundary(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Fighter", "Shield Slam", "arcaneshield_reflective")
	ctx := &abilityImpactContext{world: w}
	defender.Mu.Lock()
	damage := ctx.receiveDamageLocked(source.ID, defender, 42, "physical", defender.ArcaneShieldEndTime)
	defender.Mu.Unlock()
	ctx.flush()
	if damage != 42 || defender.Health != 458 || defender.ArcaneShieldActive || source.Health != 500 {
		t.Fatal("shield remained effective at its exact expiry")
	}
}

func TestPaidMeteorComboCannotSpendExpiredShield(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Wizard", "Meteor Drop", "")
	source.UnlockedSkills = append(source.UnlockedSkills, "Arcane Shield")
	if result := w.PerformAbility(source.ID, source.X, source.Z, "", "Arcane Shield"); !result.Accepted {
		t.Fatal("caster shield rejected")
	}
	source.LastAbilityTime = time.Now().Add(-time.Second)
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Meteor Drop"); !result.Accepted {
		t.Fatal("combo meteor rejected")
	}
	combo := false
	for _, e := range w.Entities {
		if e.Type == TypeProjectile && e.OwnerID == source.ID && e.MeteorShieldExplode {
			combo = true
		}
	}
	if !combo {
		t.Fatal("ordinary two-cast sequence did not arm Arcane Barrage")
	}
	source.ArcaneShieldEndTime = time.Now().Add(-time.Second)
	advancePaidProjectileUntilHit(t, w, source, defender)
	if source.ArcaneShieldActive || source.ArcaneShieldHP != 0 || defender.ArcaneShieldAbsorbed != 52 {
		t.Fatalf("meteor consumed an expired shield for bonus damage: active=%v capacity=%d defenderAbsorbed=%d", source.ArcaneShieldActive, source.ArcaneShieldHP, defender.ArcaneShieldAbsorbed)
	}
}
