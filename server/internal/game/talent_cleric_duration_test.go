package game

import (
	"math"
	"testing"
	"time"
)

func clericDurationFixture(t *testing.T, skill string) (*World, *Entity, *Entity, *Entity) {
	t.Helper()
	w, source, enemy, _ := rawWoundOutgoingFixture(t, "lunge")
	source.SubType, source.UnlockedSkills, source.CritChanceBonus = "Cleric", []string{skill}, 0
	source.Stats.Wisdom = 50
	ally := newTestPlayer("duration-friendly", "Fighter")
	ally.InstanceID, ally.X, ally.Z = source.InstanceID, source.X, source.Z+1
	ally.MaxHealth, ally.Health = 10000, 100
	w.AddEntity(ally)
	return w, source, enemy, ally
}

func TestClericDurationRanksReachPaidEffects(t *testing.T) {
	for _, tc := range []struct {
		skill, talent, rune string
		base                time.Duration
		friendly            bool
		deadline            func(*World, *Entity, *Entity, *Entity) time.Time
	}{
		{"Spirit Guardians", "CLR_02", "", 8 * time.Second, false, func(_ *World, p, _, _ *Entity) time.Time { return p.SpiritEndTime }},
		{"Spirit Guardians Boost", "CLR_16", "", 10 * time.Second, false, func(_ *World, p, _, _ *Entity) time.Time { return p.SpiritEndTime }},
		{"Guardian Embrace", "CLR_06", "", 10 * time.Second, false, func(_ *World, p, _, _ *Entity) time.Time { return p.GuardianEmbraceEndTime }},
		{"Divine Intervention", "CLR_10", "", 10 * time.Second, true, func(_ *World, _, _, a *Entity) time.Time { return a.DivineInterventionEndTime }},
		{"Divine Intervention", "CLR_10", "divineintervention_guardian", 5 * time.Second, true, func(_ *World, _, _, a *Entity) time.Time { return a.DivineInterventionGuardTime }},
		{"Blessing of Resolve", "CLR_20", "", 20 * time.Second, false, func(_ *World, p, _, _ *Entity) time.Time { return p.BlessingResolveEndTime }},
		{"Blessing of Zeal", "CLR_22", "", 8 * time.Second, false, func(_ *World, p, _, _ *Entity) time.Time { return p.ZealEndTime }},
		{"Mark of Weakness", "CLR_24", "", 10 * time.Second, false, func(_ *World, _, e, _ *Entity) time.Time { return e.MarkWeaknessEndTime }},
		{"Heaven's Trumpet", "CLR_26", "", 3 * time.Second, false, func(_ *World, _, e, _ *Entity) time.Time { return e.StunEndTime }},
		{"Heaven's Trumpet", "CLR_26", "", 5 * time.Second, false, func(_ *World, _, e, _ *Entity) time.Time { return e.MarkWeaknessEndTime }},
		{"Healing Light", "CLR_04", "healinglight_renewal", 5 * time.Second, true, func(_ *World, _, _, a *Entity) time.Time { return a.HealingLightHoTEndTime }},
		{"Radiant Strike", "CLR_12", "radiantstrike_chains", 2 * time.Second, false, func(_ *World, _, e, _ *Entity) time.Time { return e.RootEndTime }},
		{"Consecrated Ground", "CLR_14", "", 8 * time.Second, false, clericZoneDeadline},
		{"Consecrated Ground", "CLR_14", "consecratedground_lingering", 16 * time.Second, false, clericZoneDeadline},
		{"Avenging Seraph", "CLR_18", "", 15 * time.Second, false, func(w *World, p, _, _ *Entity) time.Time {
			for _, e := range w.Entities {
				if e.SubType == "AvengingSeraph" && e.OwnerID == p.ID {
					return e.CreatedAt.Add(e.SummonDuration)
				}
			}
			return time.Time{}
		}},
	} {
		for _, build := range []string{"baseline", "skill", "generic", "combined", "unrelated"} {
			t.Run(tc.skill+"/"+tc.rune+"/"+build, func(t *testing.T) {
				w, p, enemy, ally := clericDurationFixture(t, tc.skill)
				p.TalentRanks = map[string]int{}
				bonus := 0.0
				if build == "skill" || build == "combined" {
					p.TalentRanks[tc.talent] = 5
					bonus += .1
				}
				if build == "generic" || build == "combined" {
					p.TalentRanks["CLR_30"], p.TalentRanks["CLR_33"], p.TalentRanks["CLR_39"] = 5, 5, 5
					bonus += .45
				}
				if build == "unrelated" {
					p.TalentRanks["CLR_08"] = 5
				}
				p.SkillRunes = map[string]string{tc.skill: tc.rune}
				aim := enemy
				if tc.friendly {
					aim = ally
				}
				mana, start := p.Mana, time.Now()
				if result := w.PerformAbility(p.ID, aim.X, aim.Z, aim.ID, tc.skill); !result.Accepted || p.Mana >= mana {
					t.Fatalf("ordinary paid cast failed: %+v", result)
				}
				end := time.Now()
				want := time.Duration(math.Round(float64(tc.base) * (1 + bonus)))
				deadline := tc.deadline(w, p, enemy, ally)
				if deadline.Before(start.Add(want)) || deadline.After(end.Add(want)) {
					t.Fatalf("actual duration=%v..%v want=%v", deadline.Sub(end), deadline.Sub(start), want)
				}
				p.TalentRanks = nil
				if !tc.deadline(w, p, enemy, ally).Equal(deadline) {
					t.Fatal("later ranks changed applied duration")
				}
			})
		}
	}
}

func clericZoneDeadline(w *World, p, _, _ *Entity) time.Time {
	for _, e := range w.Entities {
		if e.Type == TypeProjectile && e.SubType == "ZoneHoly" && e.OwnerID == p.ID {
			return e.ConsecratedGroundEndTime
		}
	}
	return time.Time{}
}

func TestClericRenewalDurationProducesAdditionalSnapshotTicks(t *testing.T) {
	w, p, _, ally := clericDurationFixture(t, "Healing Light")
	p.TalentRanks = map[string]int{"CLR_04": 5, "CLR_30": 5, "CLR_33": 5, "CLR_39": 5}
	p.SkillRunes = map[string]string{"Healing Light": "healinglight_renewal"}
	if result := w.PerformAbility(p.ID, ally.X, ally.Z, ally.ID, "Healing Light"); !result.Accepted {
		t.Fatal("paid Renewal rejected")
	}
	if ally.HealingLightHoTTicksRemaining != 7 {
		t.Fatalf("extended7.75s Renewal allocated%d whole ticks, want7", ally.HealingLightHoTTicksRemaining)
	}
	amount, before := ally.HealingLightHoTAmount, ally.Health
	p.TalentRanks = nil
	for tick := 0; tick < 7; tick++ {
		ally.LastHealingLightHoTTick = time.Now().Add(-time.Second)
		w.updateEntity(ally, 0, nil, &deferredActions{})
		if ally.Health != before+(tick+1)*amount {
			t.Fatal("extended Renewal skipped or recalculated its actual tick")
		}
	}
	if ally.HealingLightHoTActive || ally.HealingLightHoTTicksRemaining != 0 {
		t.Fatal("Renewal retained an extra tick")
	}
	ally.LastHealingLightHoTTick = time.Now().Add(-time.Second)
	w.updateEntity(ally, 0, nil, &deferredActions{})
	if ally.Health != before+7*amount {
		t.Fatal("Renewal healed past its tick budget")
	}
}

func TestClericDurationPreservesExplicitPersistentQAOverride(t *testing.T) {
	for _, skill := range []string{"Spirit Guardians", "Spirit Guardians Boost"} {
		w, p, enemy, _ := clericDurationFixture(t, skill)
		p.TalentRanks = map[string]int{"CLR_02": 5, "CLR_16": 5, "CLR_30": 5, "CLR_33": 5, "CLR_39": 5}
		p.QAPersistentDuration = 30 * time.Second
		start := time.Now()
		if result := w.PerformAbility(p.ID, enemy.X, enemy.Z, enemy.ID, skill); !result.Accepted {
			t.Fatal("paid persistent fixture rejected")
		}
		if p.SpiritEndTime.Before(start.Add(30*time.Second)) || p.SpiritEndTime.After(time.Now().Add(30*time.Second)) || p.QAPersistentDuration != 0 {
			t.Fatal("explicit QA lifetime was multiplied or not consumed")
		}
	}
}

func TestClericBlessingsShareCasterTrainedDeadline(t *testing.T) {
	for _, skill := range []string{"Blessing of Resolve", "Blessing of Zeal"} {
		w, p, enemy, ally := clericDurationFixture(t, skill)
		p.TalentRanks = map[string]int{"CLR_20": 5, "CLR_22": 5, "CLR_30": 5, "CLR_33": 5, "CLR_39": 5}
		if result := w.PerformAbility(p.ID, enemy.X, enemy.Z, enemy.ID, skill); !result.Accepted {
			t.Fatal("paid party buff rejected")
		}
		caster, recipient := p.BlessingResolveEndTime, ally.BlessingResolveEndTime
		if skill == "Blessing of Zeal" {
			caster, recipient = p.ZealEndTime, ally.ZealEndTime
		}
		if caster.IsZero() || !caster.Equal(recipient) {
			t.Fatal("untrained ally did not inherit caster deadline")
		}
	}
}
