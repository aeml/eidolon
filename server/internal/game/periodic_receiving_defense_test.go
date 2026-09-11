package game

import (
	"fmt"
	"testing"
	"time"
)

func TestPaidPeriodicReceivingDefenses(t *testing.T) {
	for _, tc := range []struct{ class, skill string }{
		{"Fighter", "Whirlwind"}, {"Fighter", "Charge"}, {"Fighter", "Shattering Charge"},
		{"Cleric", "Spirit Guardians"}, {"Cleric", "Avenging Seraph"},
	} {
		for _, shielded := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/shielded%v", tc.skill, shielded), func(t *testing.T) {
				w, source, defender := abilityDefenseDuel(t, tc.class, tc.skill, "arcaneshield_reflective")
				if !shielded {
					defender.ArcaneShieldActive = false
				}
				mana := source.Mana
				if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, tc.skill); !result.Accepted || source.Mana >= mana {
					t.Fatalf("paid cast failed: %+v", result)
				}
				actor := source
				actorHealth := 500
				if tc.skill == "Avenging Seraph" {
					actor = nil
					for _, e := range w.Entities {
						if e.SubType == "AvengingSeraph" && e.OwnerID == source.ID {
							actor = e
						}
					}
					if actor == nil {
						t.Fatal("paid cast spawned no seraph")
					}
					actorHealth = actor.Health
				}
				if tc.skill != "Whirlwind" {
					// Actual movement/periodic/summon update, not a damage helper.
					w.updateEntity(actor, .2, nil, &deferredActions{})
				}
				if !shielded {
					if defender.Health >= 500 || actor.Health != actorHealth {
						t.Fatal("unshielded positive control failed")
					}
					return
				}
				absorbed := defender.ArcaneShieldAbsorbed
				if defender.Health != 500 || absorbed <= 0 || defender.ArcaneShieldHP != 600-absorbed {
					t.Fatalf("periodic hit bypassed shield: hp=%d shield=%d absorbed=%d", defender.Health, defender.ArcaneShieldHP, absorbed)
				}
				if actor.Health != actorHealth-absorbed*30/100 {
					t.Fatalf("reflection missed actual actor: hp=%d absorbed=%d", actor.Health, absorbed)
				}
				if actor != source && source.Health != 500 {
					t.Fatal("summon reflection damaged owner instead of visible attacker")
				}
			})
		}
	}
}

func TestWhirlwindReflectedDeathSurvivesCastBookkeeping(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Fighter", "Whirlwind", "arcaneshield_reflective")
	source.Health = 1
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Whirlwind"); !result.Accepted {
		t.Fatal("paid spin rejected")
	}
	if source.Health != 0 || source.State != "DEAD" || source.WhirlwindActive {
		t.Fatalf("reflected death overwritten: hp=%d state=%s active=%v", source.Health, source.State, source.WhirlwindActive)
	}
}

func TestWhirlwindLaterReflectedPulseStopsCatchup(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Fighter", "Whirlwind", "arcaneshield_reflective")
	source.SkillRunes = map[string]string{"Whirlwind": "whirlwind_extended"}
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Whirlwind"); !result.Accepted {
		t.Fatal("paid extended spin rejected")
	}
	before := defender.ArcaneShieldHP
	start := source.WhirlwindStartTime
	source.Health = 1
	w.updateWhirlwind(source, start.Add(1500*time.Millisecond), nil)
	if source.Health != 0 || source.State != "DEAD" || source.WhirlwindActive {
		t.Fatal("later reflection did not end spin")
	}
	// Raw pulses alternate19/20; the next20 becomes13 after PvP scaling. Only the next
	// due pulse may land, not the two later pulses after the caster dies.
	if before-defender.ArcaneShieldHP != 13 {
		t.Fatalf("dead caster continued catchup pulses: absorbed=%d", before-defender.ArcaneShieldHP)
	}
}

func TestWhirlwindReflectedDeathStopsSameFrameHealing(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Fighter", "Whirlwind", "arcaneshield_reflective")
	healer := newTestPlayer("renewal-before-reflection", "Cleric")
	healer.X, healer.Z, healer.InstanceID = source.X, source.Z, source.InstanceID
	healer.UnlockedSkills = []string{"Healing Light"}
	healer.SkillRunes = map[string]string{"Healing Light": "healinglight_renewal"}
	w.AddEntity(healer)
	if result := w.PerformAbility(healer.ID, source.X, source.Z, source.ID, "Healing Light"); !result.Accepted || !source.HealingLightHoTActive {
		t.Fatal("paid pre-reflection Renewal rejected")
	}
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Whirlwind"); !result.Accepted {
		t.Fatal("paid spin rejected")
	}
	// Prepare a due later pulse and an already-running Renewal effect. Healing
	// may not revive a dead caster after the pulse's reflected damage resolves.
	source.WhirlwindStartTime = time.Now().Add(-600 * time.Millisecond)
	source.Health = 1
	source.LastHealingLightHoTTick = time.Now().Add(-time.Second)
	w.updateEntity(source, .01, nil, &deferredActions{})
	if source.Health != 0 || source.State != "DEAD" {
		t.Fatalf("same-frame healing followed death: hp=%d state=%s", source.Health, source.State)
	}
	w.updateEntity(source, .01, nil, &deferredActions{})
	if source.Health != 0 || source.State != "DEAD" {
		t.Fatal("next update healed a dead character")
	}
}

func TestChargeReflectedDeathSurvivesLandingCleanup(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Fighter", "Charge", "arcaneshield_reflective")
	source.Health = 1
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Charge"); !result.Accepted {
		t.Fatal("paid charge rejected")
	}
	w.updateEntity(source, .2, nil, &deferredActions{})
	if source.Health != 0 || source.State != "DEAD" || source.IsCharging || defender.Health != 500 || defender.ArcaneShieldAbsorbed != 63 {
		t.Fatalf("charge landing overwrote reflection: hp=%d state=%s charging=%v absorbed=%d", source.Health, source.State, source.IsCharging, defender.ArcaneShieldAbsorbed)
	}
}

func TestSeraphReflectedDeathRemovesSummonNotOwner(t *testing.T) {
	w, source, defender := abilityDefenseDuel(t, "Cleric", "Avenging Seraph", "arcaneshield_reflective")
	if result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, "Avenging Seraph"); !result.Accepted {
		t.Fatal("paid summon rejected")
	}
	var summon *Entity
	for _, e := range w.Entities {
		if e.SubType == "AvengingSeraph" && e.OwnerID == source.ID {
			summon = e
		}
	}
	if summon == nil {
		t.Fatal("summon missing")
	}
	summon.Health = 1
	w.updateEntity(summon, .01, nil, &deferredActions{})
	if summon.Health != 0 || summon.State != "DEAD" || source.Health != 500 || defender.ArcaneShieldAbsorbed != 45 {
		t.Fatal("reflection killed the wrong actor or was not applied")
	}
	deferred := &deferredActions{}
	w.updateEntity(summon, .01, nil, deferred)
	if len(deferred.removals) != 1 || deferred.removals[0] != summon.ID {
		t.Fatal("dead summon not removed by ordinary lifecycle")
	}
}
