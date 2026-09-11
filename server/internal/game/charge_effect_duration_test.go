package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestChargeImpactEffectDurationUsesPaidCastTraining(t *testing.T) {
	for _, tc := range []struct {
		name, skill, runeID string
		combo               bool
		base                time.Duration
		deadline            func(*Entity, *Entity) time.Time
	}{
		{"unstoppable armor", "Charge", "charge_unstoppable", false, 5 * time.Second, func(p, _ *Entity) time.Time { return p.RuneArmorBuffEndTime }},
		{"shattering armor break", "Shattering Charge", "", false, 5 * time.Second, func(_, target *Entity) time.Time { return target.ArmorReductionEndTime }},
		{"tremor knockdown", "Charge", "", true, 2 * time.Second, func(_, target *Entity) time.Time { return target.StunEndTime }},
	} {
		for _, rank := range []int{0, 1, 5} {
			for _, retrain := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/rank%d/retrain%v", tc.name, rank, retrain), func(t *testing.T) {
					w, p, target := directSkillWallFixture("Fighter", true)
					defer w.StopBackground()
					p.Level, p.UnlockedSkills = 100, []string{"Earthshaker", tc.skill}
					p.BaseStats = InitialPlayerStats()
					p.TalentRanks = map[string]int{"FTR_30": rank, "FTR_37": rank}
					p.SkillRunes = map[string]string{tc.skill: tc.runeID}
					p.RecalculateStats()
					p.Mana, p.Health = p.MaxMana, p.MaxHealth
					oldX := target.X
					target.X = 50025 // Beyond the opener's radius, along the open doorway.
					w.Grid.Update(target, oldX, target.Z)
					if tc.combo {
						if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Earthshaker"); !result.Accepted {
							t.Fatal("paid combo opener rejected")
						}
						p.LastAbilityTime = time.Now().Add(-time.Second) // GCD only; keep actual opener.
					}
					mana := p.Mana
					if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill); !result.Accepted || p.Mana >= mana || !p.IsCharging {
						t.Fatal("paid charge did not begin")
					}
					if !tc.deadline(p, target).IsZero() {
						t.Fatal("impact effect applied before travel")
					}
					if retrain {
						p.TalentRanks = nil
						p.RecalculateStats()
					}
					w.Update(.01)
					if !p.IsCharging || !tc.deadline(p, target).IsZero() {
						t.Fatal("effect applied before charge reached target")
					}
					var impactAt, impactDeadline time.Time
					w.OnEvent = func(kind string, payload interface{}) {
						if kind != "damage" {
							return
						}
						event := payload.(DamageEvent)
						if event.SourceID == p.ID && event.TargetID == target.ID {
							impactAt, impactDeadline = time.Now(), tc.deadline(p, target)
						}
					}
					health, start := target.Health, time.Now()
					w.Update(1)
					end := time.Now()
					if p.IsCharging || p.ChargeSkillName != "" || p.ChargeEffectDurationBonus != 0 || target.Health >= health {
						t.Fatal("ordinary travel/impact did not finish with damage")
					}
					want := time.Duration(math.Round(float64(tc.base) * (1 + .07*float64(rank))))
					deadline := tc.deadline(p, target)
					if deadline.Before(start.Add(want)) || deadline.After(end.Add(want)) {
						t.Fatalf("impact duration=%v..%v want=%v", deadline.Sub(end), deadline.Sub(start), want)
					}
					// Full-world generation can widen the outer update bracket enough
					// to hide a rank-one error. Observe this exact damage dispatch too.
					remaining := impactDeadline.Sub(impactAt)
					if impactAt.IsZero() || remaining > want || remaining < want-50*time.Millisecond {
						t.Fatalf("damage receipt duration=%v want=%v", remaining, want)
					}
					if tc.combo && p.ActiveCombo != "" {
						t.Fatal("actual combo was not consumed")
					}
					if tc.runeID != "" && p.CCImmune {
						t.Fatal("travel immunity survived impact")
					}
				})
			}
		}
	}
}

func TestChargeTremorPreservesStrongerStunAndRespectsImmunity(t *testing.T) {
	for _, immune := range []bool{false, true} {
		t.Run(fmt.Sprintf("immune%v", immune), func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", true)
			defer w.StopBackground()
			p.Level, p.UnlockedSkills = 100, []string{"Earthshaker", "Charge"}
			p.BaseStats = InitialPlayerStats()
			p.TalentRanks = map[string]int{"FTR_30": 5, "FTR_37": 5}
			p.SkillRunes = map[string]string{"Earthshaker": "earthshaker_seismic"}
			p.RecalculateStats()
			p.Mana = p.MaxMana
			target.CCImmune = immune
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Earthshaker"); !result.Accepted {
				t.Fatal("opener rejected")
			}
			initial := target.StunEndTime
			if !immune && initial.IsZero() {
				t.Fatal("Seismic opener failed to stun")
			}
			p.LastAbilityTime = time.Now().Add(-time.Second)
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Charge"); !result.Accepted {
				t.Fatal("charge rejected")
			}
			health := target.Health
			w.Update(1)
			if p.IsCharging || target.Health >= health {
				t.Fatal("charge impact missing")
			}
			if !target.StunEndTime.Equal(initial) || (immune && target.Stunned) {
				t.Fatal("Tremor shortened Seismic stun or applied control to an immune target")
			}
		})
	}
}

func TestChargeDurationSnapshotClearedByTownRecovery(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.TalentRanks = map[string]int{"FTR_30": 5, "FTR_37": 5}
	p.BaseStats = InitialPlayerStats()
	p.RecalculateStats()
	p.Mana = p.MaxMana
	if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Charge"); !result.Accepted {
		t.Fatal("charge rejected")
	}
	if p.ChargeEffectDurationBonus <= 0 {
		t.Fatal("paid training not captured")
	}
	if err := w.PerformRecall(p.ID); err != nil {
		t.Fatal(err)
	}
	if p.IsCharging || p.ChargeEffectDurationBonus != 0 || p.InstanceID != "" {
		t.Fatal("old charge training survived town recovery")
	}
}
