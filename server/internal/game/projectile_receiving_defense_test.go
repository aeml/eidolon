package game

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

// Exercise the actual paid cast's projectiles through their normal per-entity
// update. Only pending wall-clock impact/tick deadlines are advanced; geometry,
// projectile identity, movement, owner and damage remain those of the cast.
func advancePaidProjectileUntilHit(t *testing.T, w *World, source, defender *Entity) {
	t.Helper()
	var projectiles []*Entity
	for _, e := range w.Entities {
		if e.Type == TypeProjectile && e.OwnerID == source.ID {
			if !e.ProjectileActivationTime.IsZero() {
				e.ProjectileActivationTime = time.Now().Add(-time.Second)
			}
			if e.SubType == "Meteor" || strings.HasPrefix(e.SubType, "Zone") {
				e.LastAttackTime = time.Now().Add(-2 * time.Second)
			}
			projectiles = append(projectiles, e)
		}
	}
	if len(projectiles) == 0 {
		t.Fatal("paid cast spawned no projectiles")
	}
	hit := false
	w.OnEvent = func(event string, payload interface{}) {
		if damage, ok := payload.(DamageEvent); event == "damage" && ok && damage.TargetID == defender.ID && damage.SourceID == source.ID {
			hit = true
		}
	}
	removed := make(map[string]bool)
	for step := 0; step < 100 && !hit; step++ {
		for _, projectile := range projectiles {
			if removed[projectile.ID] {
				continue
			}
			deferred := &deferredActions{}
			w.updateEntity(projectile, .02, nil, deferred)
			for _, id := range deferred.removals {
				removed[id] = true
			}
			if hit {
				break
			}
		}
	}
	if !hit {
		t.Fatal("normal projectile updates never reached defender")
	}
}

func TestPaidProjectileReceivingDefenses(t *testing.T) {
	for _, attack := range []struct{ class, skill string }{
		{"Wizard", "Fireball"}, {"Wizard", "Arcane Missiles"},
		{"Wizard", "Meteor Drop"}, {"Wizard", "Inferno Cataclysm"},
		{"Rogue", "Piercing Throw"}, {"Rogue", "Fan of Knives"},
		{"Rogue", "Explosive Trap"}, {"Cleric", "Consecrated Ground"},
	} {
		for _, shielded := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/shielded%v", attack.skill, shielded), func(t *testing.T) {
				w, source, defender := abilityDefenseDuel(t, attack.class, attack.skill, "arcaneshield_reflective")
				if attack.skill == "Explosive Trap" {
					oldX := defender.X
					defender.X = source.X + 1 // Stand in the trap's real trigger radius.
					w.Grid.Update(defender, oldX, defender.Z)
				}
				if !shielded {
					defender.ArcaneShieldActive = false
				}
				mana := source.Mana
				if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, attack.skill); !result.Accepted || source.Mana >= mana {
					t.Fatalf("paid cast failed: %+v", result)
				}
				advancePaidProjectileUntilHit(t, w, source, defender)
				if !shielded {
					if defender.Health >= 500 || source.Health != 500 {
						t.Fatal("unshielded control damage/reflection wrong")
					}
					return
				}
				absorbed := defender.ArcaneShieldAbsorbed
				if defender.Health != 500 || absorbed <= 0 || defender.ArcaneShieldHP != 600-absorbed {
					t.Fatalf("projectile bypassed receiving shield: hp=%d shield=%d absorbed=%d", defender.Health, defender.ArcaneShieldHP, absorbed)
				}
				if want := 500 - absorbed*30/100; source.Health != want {
					t.Fatalf("reflection missed live owner: hp=%d want=%d", source.Health, want)
				}
			})
		}
	}
}

func TestPaidFireballSplashConsumesOnlyItsOwnShieldBudget(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Wizard", "Fireball", "arcaneshield_reflective")
	oldZ := defender.Z
	defender.Z = 4 // Inside splash but outside the direct projectile collision.
	w.Grid.Update(defender, defender.X, oldZ)
	direct := &Entity{ID: "direct-monster", Type: TypeEnemy, X: 2, InstanceID: source.InstanceID,
		Health: 1000, MaxHealth: 1000, State: "IDLE"}
	w.AddEntity(direct)
	if result := w.PerformAbility(source.ID, direct.X, direct.Z, direct.ID, "Fireball"); !result.Accepted {
		t.Fatal("paid fireball rejected")
	}
	advancePaidProjectileUntilHit(t, w, source, defender)
	if direct.Health != 960 || defender.Health != 500 || defender.ArcaneShieldHP != 590 || defender.ArcaneShieldAbsorbed != 10 || source.Health != 497 {
		t.Fatalf("direct/splash/reflect budgets wrong: direct=%d defender=%d capacity=%d absorbed=%d caster=%d", direct.Health, defender.Health, defender.ArcaneShieldHP, defender.ArcaneShieldAbsorbed, source.Health)
	}
}

func TestPaidZonesPreservePartyAndNeutralSafety(t *testing.T) {
	for _, skill := range []string{"Inferno Cataclysm", "Consecrated Ground"} {
		t.Run(skill, func(t *testing.T) {
			class := "Wizard"
			if skill == "Consecrated Ground" {
				class = "Cleric"
			}
			w, source, defender := abilityDefenseDuel(t, class, skill, "")
			source.PartyID = "zone-party"
			friend, neutral := newTestPlayer("party-friend", "Fighter"), newTestPlayer("neutral-bystander", "Fighter")
			for _, p := range []*Entity{friend, neutral} {
				p.X, p.Z, p.InstanceID = defender.X, defender.Z, source.InstanceID
				w.AddEntity(p)
			}
			friend.PartyID = source.PartyID
			if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, skill); !result.Accepted {
				t.Fatal("paid zone cast rejected")
			}
			advancePaidProjectileUntilHit(t, w, source, defender)
			if defender.ArcaneShieldAbsorbed <= 0 {
				t.Fatal("positive hostile control did not absorb damage")
			}
			if friend.Health != 500 || neutral.Health != 500 || source.Health != 500 {
				t.Fatal("zone hurt a party member, neutral or caster")
			}
		})
	}
}

func TestPaidProjectileReflectionCanKillLiveCaster(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Wizard", "Fireball", "arcaneshield_reflective")
	source.Health = 1
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Fireball"); !result.Accepted {
		t.Fatal("paid fireball rejected")
	}
	advancePaidProjectileUntilHit(t, w, source, defender)
	if source.Health != 0 || source.State != "DEAD" || defender.Health != 500 || defender.ArcaneShieldAbsorbed != 26 {
		t.Fatalf("live reflection/death not applied: caster=%d/%s defender=%d absorbed=%d", source.Health, source.State, defender.Health, defender.ArcaneShieldAbsorbed)
	}
}

func TestSimultaneousPaidProjectilesReflectWithoutActorLockInversion(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Wizard", "Fireball", "arcaneshield_reflective")
	source.UnlockedSkills = append(source.UnlockedSkills, "Arcane Shield")
	defender.UnlockedSkills = append(defender.UnlockedSkills, "Fireball")
	source.SkillRunes = map[string]string{"Arcane Shield": "arcaneshield_reflective"}
	source.Stats.Intelligence = 100
	if result := w.PerformAbility(source.ID, source.X, source.Z, "", "Arcane Shield"); !result.Accepted {
		t.Fatal("second paid shield rejected")
	}
	for _, p := range []*Entity{source, defender} {
		p.LastAbilityTime = time.Now().Add(-time.Second) // Expire only GCD between real casts.
	}
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Fireball"); !result.Accepted {
		t.Fatal("first paid projectile rejected")
	}
	if result := w.PerformAbility(defender.ID, source.X, source.Z, source.ID, "Fireball"); !result.Accepted {
		t.Fatal("second paid projectile rejected")
	}
	// Use the real parallel World.Update, not serial damage-helper calls.
	for i := 0; i < 12; i++ {
		w.Update(.02)
	}
	for _, p := range []*Entity{source, defender} {
		if p.ArcaneShieldAbsorbed <= 0 || p.ArcaneShieldHP != 600-p.ArcaneShieldAbsorbed || p.Health >= 500 || p.State == "DEAD" {
			t.Fatalf("simultaneous shield/reflection failed for %s: hp=%d shield=%d absorbed=%d", p.ID, p.Health, p.ArcaneShieldHP, p.ArcaneShieldAbsorbed)
		}
	}
}
