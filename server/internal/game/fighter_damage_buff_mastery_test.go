package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestFighterDamageBuffMasteryReachesRealImpact(t *testing.T) {
	for _, tc := range []struct {
		skill, talent           string
		base, seconds, cooldown float64
	}{
		{"Berserker Edge", "FTR_19", 1.5, 15, 45},
		{"Last Stand Rampage", "FTR_25", 3, 10, 120},
	} {
		for _, rank := range []int{0, 1, 5, 99, -1} {
			for _, generic := range []int{0, 5} {
				t.Run(fmt.Sprintf("%s/rank%d/general%d", tc.skill, rank, generic), func(t *testing.T) {
					w, p, enemy := directSkillWallFixture("Fighter", true)
					defer w.StopBackground()
					p.Level, p.UnlockedSkills = 100, []string{tc.skill}
					p.BaseStats = InitialPlayerStats()
					p.BaseStats.Strength = 100
					p.TalentRanks = map[string]int{tc.talent: rank, "FTR_36": 5, "FTR_38": generic}
					p.RecalculateStats()
					p.Health, p.Mana = p.MaxHealth/4, p.MaxMana
					baseDamage, defense, mana := p.Damage, p.Defense, p.Mana
					start := time.Now()
					result := w.PerformAbility(p.ID, p.X, p.Z, "", tc.skill)
					if !result.Accepted || p.Mana != mana {
						t.Fatalf("zero-mana buff admission changed: %+v", result)
					}
					want := baseDamage * int(tc.base*100) * (25 + max(0, min(5, rank))) / 2500
					if p.Damage != want {
						t.Errorf("buffed Damage=%d want=%d", p.Damage, want)
					}
					wantDefense := defense
					deadline := p.LastStandEndTime
					if tc.skill == "Berserker Edge" {
						wantDefense = int(float64(defense) * .8)
						deadline = p.BerserkerModeEndTime
					}
					if p.Defense != wantDefense || math.Abs(deadline.Sub(start).Seconds()-tc.seconds) > .1 || math.Abs(p.Cooldowns[tc.skill].Sub(start).Seconds()-tc.cooldown*(1-p.CooldownReduction)) > .1 {
						t.Error("Mastery changed defense, duration or cooldown")
					}
					// Retain generic training; change only named ranks after the cast.
					p.TalentRanks = map[string]int{tc.talent: 5 - max(0, min(5, rank)), "FTR_36": 5, "FTR_38": generic}
					p.RecalculateStats()
					if p.Damage != want {
						t.Error("later training rewrote a committed buff")
					}
					enemy.Health, enemy.MaxHealth, enemy.Defense = 10000, 10000, 0
					// Exercise the real post-wind-up impact consumer, not a duplicate damage formula.
					w.applyAttackImpact(p.ID, enemy.ID, p.InstanceID, w.dungeonWalkRectsSnapshot(p.InstanceID), 0)
					if 10000-enemy.Health != want {
						t.Errorf("actual basic impact=%d want=%d", 10000-enemy.Health, want)
					}
					p.BerserkerModeEndTime, p.LastStandEndTime = time.Now().Add(-time.Millisecond), time.Now().Add(-time.Millisecond)
					w.updateEntity(p, 0, nil, &deferredActions{})
					if p.BerserkerModeActive || p.LastStandActive || p.BerserkerModeMultiplier != 0 || p.LastStandMultiplier != 0 || p.Damage != baseDamage || p.Defense != defense {
						t.Error("expiry did not restore ordinary stats")
					}
				})
			}
		}
	}
}

func TestFighterDamageBuffMasteryPurchasesCopiesAndRefresh(t *testing.T) {
	w, p, _ := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Berserker Edge", "Last Stand Rampage"}
	p.TalentRanks = nil
	p.recomputeTalentPoints()
	points := p.TalentPoints
	for _, id := range []string{"FTR_19", "FTR_25"} {
		for rank := 1; rank <= 5; rank++ {
			if _, ok, reason := w.PerformUnlockTalent(p.ID, id); !ok {
				t.Fatal(reason)
			}
			points--
			if p.TalentRanks[id] != rank || p.TalentPoints != points {
				t.Fatal("purchase identity or point cost changed")
			}
		}
		if _, ok, _ := w.PerformUnlockTalent(p.ID, id); ok || p.TalentPoints != points {
			t.Fatal("sixth purchase spent points")
		}
	}
	p.Health = p.MaxHealth / 4
	base := p.Damage
	cast := func(skill string) {
		p.LastAbilityTime = time.Now().Add(-time.Second)
		delete(p.Cooldowns, skill) // Separate admitted casts; no timer/resource grant in production.
		if r := w.PerformAbility(p.ID, p.X, p.Z, "", skill); !r.Accepted {
			t.Fatalf("%s: %+v", skill, r)
		}
	}
	cast("Berserker Edge")
	wantBerserker := base * 180 / 100
	if p.Damage != wantBerserker {
		t.Fatal("purchased Berserker ranks did not reach stats")
	}
	cast("Berserker Edge")
	if p.Damage != wantBerserker {
		t.Fatal("recast stacked the same buff twice")
	}
	cast("Last Stand Rampage")
	if p.Damage != wantBerserker*360/100 {
		t.Fatal("independent buff composition changed")
	}
	for _, copy := range []*Entity{w.GetEntityCopy(p.ID), w.copyEntity(p)} {
		if !copy.BerserkerModeActive || !copy.LastStandActive || copy.BerserkerModeMultiplier != 1.8 || copy.LastStandMultiplier != 3.6 ||
			!copy.BerserkerModeEndTime.Equal(p.BerserkerModeEndTime) || !copy.LastStandEndTime.Equal(p.LastStandEndTime) {
			t.Fatal("copy lost active cast strength/deadlines")
		}
	}
	// A newly admitted untrained cast replaces, rather than compounds, the old strength.
	p.TalentRanks = nil
	cast("Berserker Edge")
	if p.BerserkerModeMultiplier != 1.5 || p.LastStandMultiplier != 3.6 || p.Damage != (base*150/100)*360/100 {
		t.Fatal("replacement or independent snapshot strength changed")
	}
}

func TestFighterDamageBuffLegacyAndInvalidStrengthBounds(t *testing.T) {
	for _, stored := range []float64{0, -1, math.Inf(1), math.NaN(), 100} {
		p := &Entity{BerserkerModeActive: true, LastStandActive: true, BerserkerModeMultiplier: stored, LastStandMultiplier: stored}
		if p.ActiveBerserkerModeMultiplier() != 1.5 || p.ActiveLastStandMultiplier() != 3 {
			t.Errorf("unsafe or legacy strength %v escaped fallback", stored)
		}
		p.BerserkerModeActive, p.LastStandActive = false, false
		if p.ActiveBerserkerModeMultiplier() != 1 || p.ActiveLastStandMultiplier() != 1 {
			t.Fatal("inactive stored value granted a buff")
		}
	}
}

func TestFighterDamageBuffPurgeClearsStoredBerserkerStrength(t *testing.T) {
	w, p, enemy := directSkillWallFixture("Cleric", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Radiant Strike"}
	p.SkillRunes = map[string]string{"Radiant Strike": "radiantstrike_purge"}
	p.BaseStats = InitialPlayerStats()
	p.BaseStats.Wisdom = 100 // A zero-stat fixture cannot prove the damaging purge hit.
	p.RecalculateStats()
	p.Mana = p.MaxMana
	oldX, oldZ := enemy.X, enemy.Z
	enemy.X, enemy.Z = p.X+1, p.Z
	w.Grid.Update(enemy, oldX, oldZ)
	enemy.Health, enemy.MaxHealth = 10000, 10000
	enemy.BerserkerModeActive, enemy.BerserkerModeMultiplier = true, 1.8
	enemy.BerserkerModeEndTime = time.Now().Add(time.Minute)
	if r := w.PerformAbility(p.ID, enemy.X, enemy.Z, enemy.ID, "Radiant Strike"); !r.Accepted {
		t.Fatal("ordinary purge strike rejected")
	}
	if enemy.Health >= 10000 {
		t.Fatal("purge fixture was not hit")
	}
	if enemy.BerserkerModeActive || enemy.BerserkerModeMultiplier != 0 || !enemy.BerserkerModeEndTime.IsZero() {
		t.Fatal("purge retained paid buff strength")
	}
}

func TestFighterDamageBuffLastStandHealthGateDoesNotGrantStrength(t *testing.T) {
	w, p, _ := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Last Stand Rampage"}
	p.TalentRanks = map[string]int{"FTR_25": 5}
	p.RecalculateStats()
	p.Health = p.MaxHealth
	damage := p.Damage
	if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Last Stand Rampage"); r.Accepted {
		t.Fatal("healthy character bypassed Last Stand gate")
	}
	if p.LastStandActive || p.LastStandMultiplier != 0 || p.Damage != damage || !p.Cooldowns["Last Stand Rampage"].IsZero() {
		t.Fatal("rejected cast granted strength or spent cooldown")
	}
}

func TestBerserkerMasteryPartyUsesCasterStrength(t *testing.T) {
	for _, rank := range []int{0, 5} {
		t.Run(fmt.Sprint(rank), func(t *testing.T) {
			w, p, _ := directSkillWallFixture("Fighter", true)
			defer w.StopBackground()
			p.Level, p.UnlockedSkills = 100, []string{"Berserker Edge"}
			p.TalentRanks = map[string]int{"FTR_19": rank}
			p.RecalculateStats()
			party := w.CreateParty(p.ID)
			if party == nil {
				t.Fatal("party creation failed")
			}
			members := make([]*Entity, 0, 4)
			baseDamage := make([]int, 0, 4)
			for _, placement := range []string{"near", "far", "other-instance", "dead"} {
				ally := newTestPlayer("damage-buff-"+placement, "Fighter")
				ally.BaseStats.Strength = 100
				ally.TalentRanks = map[string]int{"FTR_19": 5 - rank}
				ally.RecalculateStats()
				ally.X, ally.Z, ally.InstanceID = p.X, p.Z, p.InstanceID
				if placement == "far" {
					ally.X += 100
				}
				if placement == "other-instance" {
					ally.InstanceID = "other-buff-room"
				}
				if placement == "dead" {
					ally.State = "DEAD"
				}
				w.AddEntity(ally)
				if err := w.JoinParty(party.ID, ally.ID); err != nil {
					t.Fatal(err)
				}
				members = append(members, ally)
				baseDamage = append(baseDamage, ally.Damage)
			}
			if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Berserker Edge"); !r.Accepted {
				t.Fatal("party buff rejected")
			}
			for i, member := range members {
				want := baseDamage[i]
				if i == 0 {
					want = want * 150 * (25 + rank) / 2500
				}
				if member.Damage != want || member.BerserkerModeActive != (i == 0) {
					t.Errorf("recipient %s damage=%d want=%d active=%v", member.ID, member.Damage, want, member.BerserkerModeActive)
				}
			}
			if !members[0].BerserkerModeEndTime.Equal(p.BerserkerModeEndTime) {
				t.Fatal("party duration changed")
			}
		})
	}
}
