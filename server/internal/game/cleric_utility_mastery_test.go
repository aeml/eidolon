package game

import (
	"math"
	"reflect"
	"testing"
	"time"
)

// Actual paid casts, not only the talent definition: the advertised power
// benefit must reach the buff/debuff recipient without changing its identity.
func TestClericUtilityMasteryImprovesEffect(t *testing.T) {
	for _, tc := range []struct {
		skill, talent string
		cost          int
	}{
		{"Blessing of Resolve", "CLR_19", 35},
		{"Blessing of Zeal", "CLR_21", 35},
		{"Mark of Weakness", "CLR_23", 30},
	} {
		t.Run(tc.skill, func(t *testing.T) {
			type effect struct {
				defense                 int
				speed, attack, weakness float64
			}
			var outcomes [3]effect
			for index, rank := range []int{0, 1, 5} {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("utility-caster", "Cleric")
				p.Level, p.InstanceID, p.X, p.Z = 100, "utility-mastery", 60000, 60000
				p.BaseStats = InitialPlayerStats()
				p.TalentRanks = map[string]int{tc.talent: rank}
				p.UnlockedSkills = []string{tc.skill}
				p.RecalculateStats()
				p.Mana = p.MaxMana
				w.AddEntity(p)
				target := newTestPlayer("utility-recipient", "Fighter")
				target.BaseStats = InitialPlayerStats()
				target.Equipment["chest"] = Item{Stats: map[string]int{"defense": 100}}
				target.RecalculateStats()
				target.InstanceID, target.X, target.Z = p.InstanceID, p.X+2, p.Z
				if tc.skill == "Mark of Weakness" {
					target.Type = TypeEnemy
				}
				w.AddEntity(target)
				beforeDefense, beforeSpeed, beforeAttack := target.Defense, target.Speed, target.AttackSpeed
				power := float64(25+rank) / 25
				mana := p.Mana
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill)
				if !result.Accepted || p.Mana != mana-tc.cost || result.CooldownRemaining <= 0 {
					t.Fatalf("rank%d paid cast failed: %+v mana%d before%d", rank, result, p.Mana, mana)
				}
				switch tc.skill {
				case "Blessing of Resolve":
					if !target.BlessingResolveActive || target.Defense != int(float64(beforeDefense)*(1+.2*power)) {
						t.Fatal("positive defense control failed")
					}
				case "Blessing of Zeal":
					if !target.ZealActive || math.Abs(target.Speed-beforeSpeed*(1+.2*power)) > 1e-9 || math.Abs(target.AttackSpeed-beforeAttack/(1+.3*power)) > 1e-9 {
						t.Fatal("positive haste control failed")
					}
				case "Mark of Weakness":
					if !target.MarkWeakness || math.Abs(target.MarkWeaknessFactor-.2*power) > 1e-9 {
						t.Fatal("positive weakness control failed")
					}
				}
				outcomes[index] = effect{target.Defense, target.Speed, target.AttackSpeed, target.MarkWeaknessFactor}
			}
			base, trained := outcomes[0], outcomes[2]
			improved := trained.defense > base.defense || trained.speed > base.speed || trained.attack < base.attack || trained.weakness > base.weakness
			if !improved {
				t.Fatalf("five Mastery ranks have no stronger effect: baseline%+v trained%+v", base, trained)
			}
		})
	}
}

func TestClericUtilityPowerBoundsAndSavedRanks(t *testing.T) {
	for _, tc := range []struct{ skill, id string }{
		{"Blessing of Resolve", "CLR_19"}, {"Blessing of Zeal", "CLR_21"}, {"Mark of Weakness", "CLR_23"},
	} {
		for _, rank := range []int{-1, 0, 1, 5, 99} {
			caster := &Entity{SubType: "Cleric", TalentRanks: map[string]int{tc.id: rank, "CLR_31": 5, "CLR_038": 5}}
			before := map[string]int{tc.id: rank, "CLR_31": 5, "CLR_038": 5}
			want := float64(25+max(0, min(5, rank))) / 25
			if got := clericUtilityPowerAtCast(caster, tc.skill); got != want {
				t.Errorf("%s rank%d: power%v want%v", tc.skill, rank, got, want)
			}
			if !reflect.DeepEqual(caster.TalentRanks, before) {
				t.Fatal("cast mutated saved ranks")
			}
			caster.SubType = "Fighter"
			if clericUtilityPowerAtCast(caster, tc.skill) != 1 {
				t.Fatal("foreign-class ranks granted power")
			}
		}
	}
	if clericUtilityPowerAtCast(nil, "Blessing of Resolve") != 1 || clericUtilityPowerAtCast(&Entity{}, "Healing Light") != 1 {
		t.Fatal("missing caster/unknown skill fallback changed")
	}
	for _, stored := range []float64{0, -1, .99, 1.21, 100, math.NaN(), math.Inf(1), math.Inf(-1)} {
		if activeClericUtilityPower(true, stored) != 1 || activeClericUtilityPower(false, stored) != 0 {
			t.Errorf("unsafe stored power%v escaped fallback", stored)
		}
	}
}

func TestClericUtilityPurchasedPowerRecipientsCopiesAndExpiry(t *testing.T) {
	for _, tc := range []struct {
		skill, id string
		seconds   float64
	}{
		{"Blessing of Resolve", "CLR_19", 20}, {"Blessing of Zeal", "CLR_21", 8}, {"Mark of Weakness", "CLR_23", 10},
	} {
		t.Run(tc.skill, func(t *testing.T) {
			w, caster, enemy := directSkillWallFixture("Cleric", true)
			defer w.StopBackground()
			caster.Level, caster.UnlockedSkills = 100, []string{tc.skill}
			caster.BaseStats, caster.TalentRanks = InitialPlayerStats(), nil
			caster.RecalculateStats()
			caster.recomputeTalentPoints()
			points := caster.TalentPoints
			for rank := 1; rank <= 5; rank++ {
				if _, ok, reason := w.PerformUnlockTalent(caster.ID, tc.id); !ok {
					t.Fatal(reason)
				}
				if caster.TalentRanks[tc.id] != rank || caster.TalentPoints != points-rank {
					t.Fatal("rank identity or purchase cost changed")
				}
			}
			if _, ok, _ := w.PerformUnlockTalent(caster.ID, tc.id); ok || caster.TalentPoints != points-5 {
				t.Fatal("sixth rank accepted or charged")
			}
			target := newTestPlayer("blessing-recipient", "Fighter")
			target.InstanceID, target.X, target.Z = caster.InstanceID, caster.X+1, caster.Z
			target.BaseStats = InitialPlayerStats()
			target.Equipment["chest"] = Item{Stats: map[string]int{"defense": 1000}}
			target.RecalculateStats()
			w.AddEntity(target)
			if tc.skill == "Mark of Weakness" {
				target = enemy
				target.RecalculateStats()
			}
			defense, speed, attack := target.Defense, target.Speed, target.AttackSpeed
			cast := func() {
				caster.LastAbilityTime = time.Now().Add(-time.Second)
				delete(caster.Cooldowns, tc.skill)
				caster.Mana = caster.MaxMana // Independent paid casts in a unit fixture.
				before := caster.Mana
				if r := w.PerformAbility(caster.ID, target.X, target.Z, target.ID, tc.skill); !r.Accepted || caster.Mana >= before {
					t.Fatalf("purchased cast failed: %+v", r)
				}
			}
			assertEffect := func(e *Entity, power float64) {
				t.Helper()
				switch tc.skill {
				case "Blessing of Resolve":
					if e.ActiveBlessingResolvePower() != power || e.Defense != int(float64(defense)*(1+.2*power)) {
						t.Fatalf("Resolve power%v defense%d", e.ActiveBlessingResolvePower(), e.Defense)
					}
				case "Blessing of Zeal":
					if e.ActiveZealPower() != power || math.Abs(e.Speed-speed*(1+.2*power)) > 1e-9 || math.Abs(e.AttackSpeed-attack/(1+.3*power)) > 1e-9 {
						t.Fatal("Zeal movement/cadence did not use captured power")
					}
					// The compact broadcast copy intentionally excludes the internal timer.
					if e == target && e.AttackCooldown != time.Duration(e.AttackSpeed*float64(time.Second)) {
						t.Fatal("actual attack timer diverged from the displayed cadence")
					}
				case "Mark of Weakness":
					if !e.MarkWeakness || math.Abs(e.MarkWeaknessFactor-.2*power) > 1e-9 {
						t.Fatal("Mark did not capture purchased vulnerability")
					}
					attacker := &Entity{SubType: "Fighter"}
					if damage, critical := CalculateFinalDamage(attacker, e, 1000, "physical"); critical || damage != int(1000*(1+.2*power)) {
						t.Fatalf("actual Mark damage%d critical%v", damage, critical)
					}
				}
			}
			start := time.Now()
			cast()
			deadline := target.BlessingResolveEndTime
			if tc.skill == "Blessing of Zeal" {
				deadline = target.ZealEndTime
			}
			if tc.skill == "Mark of Weakness" {
				deadline = target.MarkWeaknessEndTime
			}
			if math.Abs(deadline.Sub(start).Seconds()-tc.seconds) > .2 {
				t.Fatal("Mastery changed duration")
			}
			assertEffect(target, 1.2)
			cast()
			assertEffect(target, 1.2) // Refresh must not compound.
			caster.TalentRanks = nil
			target.RecalculateStats()
			assertEffect(target, 1.2) // Later source changes cannot rewrite the recipient.
			for _, copy := range []*Entity{w.GetEntityCopy(target.ID), w.copyEntity(target)} {
				assertEffect(copy, 1.2)
				if !copy.ZealEndTime.Equal(target.ZealEndTime) || !copy.BlessingResolveEndTime.Equal(target.BlessingResolveEndTime) || !copy.MarkWeaknessEndTime.Equal(target.MarkWeaknessEndTime) {
					t.Fatal("copy dropped deadlines")
				}
			}
			cast()
			assertEffect(target, 1) // Last accepted caster replaces potency, no permanent stacking.
			future := time.Now().Add(time.Minute)
			expireRecipientSupportBuffsLocked(target, future)
			expireTargetDebuffsLocked(target, future)
			if target.BlessingResolveActive || target.ZealActive || target.MarkWeakness || target.BlessingResolvePower != 0 || target.ZealPower != 0 || target.MarkWeaknessFactor != 0 {
				t.Fatal("expiry retained captured strength")
			}
			if target.Defense != defense || target.Speed != speed || target.AttackSpeed != attack {
				t.Fatal("expiry failed to restore base stats")
			}
		})
	}
}
