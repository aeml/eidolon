package game

import (
	"testing"
	"time"
)

func TestAbilityAdmissionRequiresLivingConnectedPlayerAcrossSelectableKit(t *testing.T) {
	for class, skills := range selectableAbilityContract() {
		for _, skill := range skills {
			for _, condition := range []string{"zero-health", "negative-health", "dead-state", "disconnected", "non-player"} {
				t.Run(class+"/"+skill+"/"+condition, func(t *testing.T) {
					p := newTestPlayer("unavailable-caster", class)
					p.UnlockedSkills = []string{skill}
					p.ActiveCombo, p.ActiveComboEndTime = "preserved-combo", time.Now().Add(time.Minute)
					p.SpellFocusActive, p.SpellFocusMultiplier = true, 1.2
					wantReason := "dead"
					switch condition {
					case "zero-health":
						p.Health = 0
					case "negative-health":
						p.Health = -1
					case "dead-state":
						p.State = "DEAD"
					case "disconnected":
						p.Disconnected, wantReason = true, "action_locked"
					case "non-player":
						p.Type, wantReason = TypeEnemy, "player_not_found"
					}
					health, state, comboEnd := p.Health, p.State, p.ActiveComboEndTime
					w := newPvPTestWorld(p)
					events := 0
					w.OnEvent = func(string, interface{}) { events++ }
					result := w.PerformAbility(p.ID, 2, 0, "", skill)
					if result.Accepted || result.Reason != wantReason || p.Health != health || p.Mana != 200 ||
						p.State != state || !p.LastAbilityTime.IsZero() || len(p.Cooldowns) != 0 ||
						p.LastSkillUsed != "" || !p.LastSkillTime.IsZero() || p.ActiveCombo != "preserved-combo" ||
						p.ActiveComboEndTime != comboEnd || !p.SpellFocusActive || p.SpellFocusMultiplier != 1.2 ||
						p.X != 0 || p.Y != 0 || p.Z != 0 || len(w.Entities) != 1 || events != 0 {
						t.Fatalf("unavailable caster committed an ability or changed state: %+v", result)
					}
				})
			}
		}
	}
}

func livingAttackFixture(t *testing.T) (*World, *Entity, *Entity) {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("living-attacker", "Fighter")
	p.X, p.Z, p.AttackCooldown = 200, 200, time.Hour
	target := &Entity{ID: "living-target", Type: TypeEnemy, X: 201, Z: 200,
		State: "IDLE", Health: 1000, MaxHealth: 1000}
	w.AddEntity(p)
	w.AddEntity(target)
	return w, p, target
}

func makeCombatActorUnavailable(actor *Entity, condition string) {
	switch condition {
	case "zero-health":
		actor.Health = 0
	case "negative-health":
		actor.Health = -1
	case "disconnected":
		actor.Disconnected = true
	case "dead-state":
		actor.State = "DEAD"
	}
}

func TestBasicAttackAdmissionRejectsUnavailableSourceAndTarget(t *testing.T) {
	for _, actor := range []string{"source", "target"} {
		for _, condition := range []string{"zero-health", "negative-health", "disconnected", "dead-state"} {
			t.Run(actor+"/"+condition, func(t *testing.T) {
				w, p, target := livingAttackFixture(t)
				changed := p
				if actor == "target" {
					changed = target
				}
				makeCombatActorUnavailable(changed, condition)
				health, targetHealth, state, targetState := p.Health, target.Health, p.State, target.State
				events := 0
				w.OnEvent = func(string, interface{}) { events++ }
				if _, accepted := w.PerformAttack(p.ID, target.ID); accepted || !p.LastAttackTime.IsZero() ||
					p.State != state || target.State != targetState || p.Health != health || target.Health != targetHealth || events != 0 {
					t.Fatal("unavailable attack consumed cooldown/state or emitted an attack")
				}
			})
		}
	}
}

func TestBasicAttackImpactRechecksLivingConnectedSourceAndTarget(t *testing.T) {
	for _, actor := range []string{"source", "target"} {
		for _, condition := range []string{"zero-health", "negative-health", "disconnected", "dead-state"} {
			t.Run(actor+"/"+condition, func(t *testing.T) {
				w, p, target := livingAttackFixture(t)
				if _, accepted := w.PerformAttack(p.ID, target.ID); !accepted {
					t.Fatal("valid live attack was not admitted")
				}
				changed := p
				if actor == "target" {
					changed = target
				}
				makeCombatActorUnavailable(changed, condition)
				if actor == "source" {
					p.CloakNextAttackBonus, p.StealthActive = 1, true
				}
				health, targetHealth, targetState := p.Health, target.Health, target.State
				events := 0
				w.OnEvent = func(string, interface{}) { events++ }
				// The hour-long admission callback stays pending; test the real
				// impact synchronously, then owned fixture cleanup cancels it.
				w.applyAttackImpact(p.ID, target.ID, p.InstanceID, nil, 0)
				if p.Health != health || target.Health != targetHealth || target.State != targetState || events != 0 {
					t.Fatal("unavailable actor allowed wind-up damage or duplicate death effects")
				}
				if actor == "source" && (p.CloakNextAttackBonus != 1 || !p.StealthActive) {
					t.Fatal("unavailable source consumed prepared next-hit effects")
				}
			})
		}
	}
}

func TestDirectOffensiveAbilityTargetRequiresLivingConnectedActor(t *testing.T) {
	for _, condition := range []string{"zero-health", "negative-health", "disconnected", "dead-state", "living"} {
		t.Run(condition, func(t *testing.T) {
			w, p, target := livingAttackFixture(t)
			makeCombatActorUnavailable(target, condition)
			if valid := validDirectAbilityTarget(w, p, target, 15, TypeEnemy); valid != (condition == "living") {
				t.Fatal("direct offensive targeting admitted unavailable actor or rejected live actor", valid)
			}
		})
	}
}
