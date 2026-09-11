package game

import (
	"testing"
	"time"
)

func TestPaidRecipientSupportBuffExpiry(t *testing.T) {
	for _, kind := range []EntityType{TypePlayer, TypeNPC} {
		for _, stunned := range []bool{false, true} {
			for _, skill := range []string{"Blessing of Resolve", "Blessing of Zeal", "Divine Intervention", "Guardian Roar", "Time Warp"} {
				t.Run(string(kind)+"/"+skill+"/stunned="+map[bool]string{false: "false", true: "true"}[stunned], func(t *testing.T) {
					w, source, _, target := clericDurationFixture(t, skill)
					if skill == "Guardian Roar" {
						source.SubType = "Fighter"
					}
					if skill == "Time Warp" {
						source.SubType = "Wizard"
					}
					target.Type = kind
					target.Equipment["chest"] = Item{Stats: map[string]int{"defense": 100}}
					target.RecalculateStats()
					defense, speed, attackSpeed := target.Defense, target.Speed, target.AttackSpeed
					source.SkillRunes = map[string]string{"Divine Intervention": "divineintervention_guardian"}
					mana := source.Mana
					if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, skill); !result.Accepted || source.Mana >= mana {
						t.Fatalf("ordinary paid support cast rejected: %+v", result)
					}
					active := func() bool {
						switch skill {
						case "Blessing of Resolve":
							return target.BlessingResolveActive
						case "Blessing of Zeal":
							return target.ZealActive
						case "Guardian Roar":
							return target.GuardianRoarActive
						case "Time Warp":
							return target.TimeWarpActive
						default:
							return target.DivineInterventionActive && target.DivineInterventionGuardian
						}
					}
					if !active() {
						t.Fatal("paid cast did not apply to recipient")
					}
					if (skill == "Blessing of Resolve" || skill == "Guardian Roar") && target.Defense <= defense {
						t.Fatal("paid Resolve did not increase actual defense")
					}
					if (skill == "Blessing of Zeal" || skill == "Time Warp") && (target.Speed <= speed || target.AttackSpeed >= attackSpeed) {
						t.Fatal("paid Zeal did not improve actual speed/cadence")
					}
					target.Stunned = stunned
					target.StunEndTime = time.Now().Add(time.Minute)
					w.updateEntity(target, 0, nil, &deferredActions{})
					if !active() {
						t.Fatal("unexpired support effect cleared early")
					}
					past := time.Now().Add(-time.Second)
					target.BlessingResolveEndTime, target.ZealEndTime = past, past
					target.DivineInterventionEndTime, target.DivineInterventionGuardTime = past, past
					target.GuardianRoarEndTime, target.TimeWarpEndTime = past, past
					w.updateEntity(target, 0, nil, &deferredActions{})
					if target.BlessingResolveActive || target.ZealActive || target.DivineInterventionActive || target.DivineInterventionGuardian || target.GuardianRoarActive || target.TimeWarpActive {
						t.Fatal("expired paid support effects remain on recipient")
					}
					if target.Defense != defense || target.Speed != speed || target.AttackSpeed != attackSpeed {
						t.Fatal("expired support stats did not return to their baseline")
					}
				})
			}
		}
	}
}

func TestRecipientSupportBuffDeadlineBoundaries(t *testing.T) {
	for _, deadlineKind := range []string{"future", "exact", "missing"} {
		t.Run(deadlineKind, func(t *testing.T) {
			target := newTestPlayer("recipient-boundary", "Fighter")
			target.Equipment["chest"] = Item{Stats: map[string]int{"defense": 100}}
			target.RecalculateStats()
			defense, speed, cadence := target.Defense, target.Speed, target.AttackSpeed
			now := time.Now()
			deadline := now
			if deadlineKind == "future" {
				deadline = now.Add(time.Nanosecond)
			}
			if deadlineKind == "missing" {
				deadline = time.Time{}
			}
			target.BlessingResolveActive, target.ZealActive = true, true
			target.GuardianRoarActive, target.TimeWarpActive = true, true
			target.DivineInterventionActive, target.DivineInterventionGuardian = true, true
			target.BlessingResolveEndTime, target.ZealEndTime = deadline, deadline
			target.GuardianRoarEndTime, target.TimeWarpEndTime = deadline, deadline
			target.DivineInterventionEndTime, target.DivineInterventionGuardTime = deadline, deadline
			target.RecalculateStats()
			expireRecipientSupportBuffsLocked(target, now)
			if deadlineKind == "future" {
				if !target.BlessingResolveActive || !target.ZealActive || !target.DivineInterventionActive || !target.DivineInterventionGuardian || !target.GuardianRoarActive || !target.TimeWarpActive {
					t.Fatal("future support buff expired early")
				}
				return
			}
			if target.BlessingResolveActive || target.ZealActive || target.DivineInterventionActive || target.DivineInterventionGuardian || target.GuardianRoarActive || target.TimeWarpActive {
				t.Fatal("boundary support flags not cleared")
			}
			if !target.BlessingResolveEndTime.IsZero() || !target.ZealEndTime.IsZero() || !target.DivineInterventionEndTime.IsZero() || !target.DivineInterventionGuardTime.IsZero() || !target.GuardianRoarEndTime.IsZero() || !target.TimeWarpEndTime.IsZero() {
				t.Fatal("expired deadline retained")
			}
			expireRecipientSupportBuffsLocked(target, now.Add(time.Second))
			if target.Defense != defense || target.Speed != speed || target.AttackSpeed != cadence {
				t.Fatal("support expiry compounded stats on repeat update")
			}
		})
	}
}

func TestPaidRecipientGuardianExpiresBeforeRescue(t *testing.T) {
	w, source, _, target := clericDurationFixture(t, "Divine Intervention")
	target.Type = TypeNPC
	source.SkillRunes = map[string]string{"Divine Intervention": "divineintervention_guardian"}
	if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, "Divine Intervention"); !result.Accepted {
		t.Fatal("paid Guardian rejected")
	}
	target.DivineInterventionGuardTime = time.Now().Add(-time.Second)
	w.updateEntity(target, 0, nil, &deferredActions{})
	if target.DivineInterventionGuardian || !target.DivineInterventionActive {
		t.Fatal("short Guardian deadline changed the longer rescue window")
	}
}
