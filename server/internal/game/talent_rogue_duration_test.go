package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestRogueDurationRanksReachPaidDirectEffects(t *testing.T) {
	for _, tc := range []struct {
		skill, rune string
		base        time.Duration
		deadline    func(*Entity, *Entity) time.Time
	}{
		{"Stealth", "", 10 * time.Second, func(p, _ *Entity) time.Time { return p.StealthEndTime }},
		{"Weak Point Mark", "", 10 * time.Second, func(_, e *Entity) time.Time { return e.WeakPointEndTime }},
		{"Poison Coating", "", 15 * time.Second, func(p, _ *Entity) time.Time { return p.PoisonCoatingEndTime }},
		{"Serrated Edges", "", 10 * time.Second, func(p, _ *Entity) time.Time { return p.SerratedEdgesEndTime }},
		{"Shadow Lunge", "", 10 * time.Second, func(_, e *Entity) time.Time { return e.BleedEndTime }},
		{"Shadow Lunge", "shadowlunge_cripple", 3 * time.Second, func(_, e *Entity) time.Time { return e.SlowEndTime }},
		{"Cloak & Vanish", "", 5 * time.Second, func(p, _ *Entity) time.Time { return p.StealthEndTime }},
		{"Cloak & Vanish", "cloak_longer", 10 * time.Second, func(p, _ *Entity) time.Time { return p.StealthEndTime }},
		{"Cloak & Vanish", "cloak_swift", 3 * time.Second, func(p, _ *Entity) time.Time { return p.CloakBurstSpeedEndTime }},
		{"Smoke Bomb", "", 5 * time.Second, func(_, e *Entity) time.Time { return e.SlowEndTime }},
		{"Smoke Bomb", "", 5 * time.Second, func(_, e *Entity) time.Time { return e.AccuracyReductionEndTime }},
	} {
		for _, build := range []struct {
			rank      int
			unrelated bool
		}{{0, false}, {1, false}, {5, false}, {5, true}} {
			t.Run(fmt.Sprintf("%s/%s/rank%d/unrelated%v", tc.skill, tc.rune, build.rank, build.unrelated), func(t *testing.T) {
				w, p, target, _ := rawWoundOutgoingFixture(t, "lunge")
				p.UnlockedSkills = []string{tc.skill}
				p.CritChanceBonus = 0
				p.SkillRunes = map[string]string{tc.skill: tc.rune}
				talent := "ROG_28"
				if build.unrelated {
					talent = "ROG_30"
				}
				p.TalentRanks = map[string]int{talent: build.rank}
				mana, start := p.Mana, time.Now()
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill)
				end := time.Now()
				if !result.Accepted || p.Mana >= mana {
					t.Fatalf("paid cast failed: %+v", result)
				}
				bonus := .04 * float64(build.rank)
				if build.unrelated {
					bonus = 0
				}
				want := time.Duration(math.Round(float64(tc.base) * (1 + bonus)))
				deadline := tc.deadline(p, target)
				if deadline.Before(start.Add(want)) || deadline.After(end.Add(want)) {
					t.Fatalf("paid effect duration=%v..%v want=%v", deadline.Sub(end), deadline.Sub(start), want)
				}
				p.TalentRanks = nil
				if !tc.deadline(p, target).Equal(deadline) {
					t.Fatal("later talent change altered applied deadline")
				}
			})
		}
	}
}

func TestPaidRogueEnemyDebuffsExpire(t *testing.T) {
	for _, skill := range []string{"Weak Point Mark", "Smoke Bomb"} {
		t.Run(skill, func(t *testing.T) {
			w, p, target, _ := rawWoundOutgoingFixture(t, "lunge")
			p.UnlockedSkills = []string{skill}
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill); !result.Accepted {
				t.Fatal("paid debuff rejected")
			}
			if skill == "Weak Point Mark" && !target.WeakPointMarked || skill == "Smoke Bomb" && target.AccuracyReduction != .3 {
				t.Fatal("debuff not applied")
			}
			target.Stunned = true
			target.StunEndTime = time.Now().Add(time.Minute)
			w.updateEntity(target, 0, nil, &deferredActions{})
			if skill == "Weak Point Mark" && !target.WeakPointMarked || skill == "Smoke Bomb" && target.AccuracyReduction != .3 {
				t.Fatal("active debuff expired early")
			}
			target.WeakPointEndTime = time.Now().Add(-time.Second)
			target.AccuracyReductionEndTime = time.Now().Add(-time.Second)
			w.updateEntity(target, 0, nil, &deferredActions{})
			if target.WeakPointMarked || target.AccuracyReduction != 0 {
				t.Fatalf("expired debuff retained: mark=%v accuracy=%v", target.WeakPointMarked, target.AccuracyReduction)
			}
		})
	}
}

func TestRogueTargetDebuffDeadlineBoundary(t *testing.T) {
	now := time.Now()
	for _, remaining := range []time.Duration{time.Second, 0, -time.Second} {
		e := &Entity{WeakPointMarked: true, WeakPointEndTime: now.Add(remaining), AccuracyReduction: .3, AccuracyReductionEndTime: now.Add(remaining)}
		expireRogueTargetDebuffsLocked(e, now)
		if (e.WeakPointMarked || e.AccuracyReduction > 0) != (remaining > 0) {
			t.Fatalf("wrong deadline boundary for remaining=%v", remaining)
		}
		if remaining <= 0 && (!e.WeakPointEndTime.IsZero() || !e.AccuracyReductionEndTime.IsZero()) {
			t.Fatal("expired deadlines retained")
		}
	}
}

func TestRogueDurationRanksReachPaidOnHitEffects(t *testing.T) {
	for _, tc := range []struct {
		setup, skill, rune string
		base               time.Duration
		deadline           func(*Entity) time.Time
	}{
		{"Poison Coating", "Basic Attack", "", 8 * time.Second, func(e *Entity) time.Time { return e.PoisonEndTime }},
		{"Poison Coating", "Piercing Throw", "", 8 * time.Second, func(e *Entity) time.Time { return e.PoisonEndTime }},
		{"Serrated Edges", "Piercing Throw", "", 5 * time.Second, func(e *Entity) time.Time { return e.BleedEndTime }},
		{"Serrated Edges", "Fan of Knives", "", 5 * time.Second, func(e *Entity) time.Time { return e.BleedEndTime }},
		{"", "Piercing Throw", "piercingthrow_serrated", 5 * time.Second, func(e *Entity) time.Time { return e.BleedEndTime }},
		{"", "Fan of Knives", "fanofknives_poisoned", 5 * time.Second, func(e *Entity) time.Time { return e.PoisonEndTime }},
		{"", "Fan of Knives", "fanofknives_weighted", 3 * time.Second, func(e *Entity) time.Time { return e.SlowEndTime }},
		{"", "Tripwire", "", 3 * time.Second, func(e *Entity) time.Time { return e.RootEndTime }},
	} {
		for _, rank := range []int{0, 5} {
			t.Run(fmt.Sprintf("%s/%s/%s/rank%d", tc.setup, tc.skill, tc.rune, rank), func(t *testing.T) {
				w, p, target, _ := rawWoundOutgoingFixture(t, "lunge")
				p.UnlockedSkills = []string{tc.setup, tc.skill}
				p.TalentRanks = map[string]int{"ROG_28": rank}
				p.SkillRunes = map[string]string{tc.skill: tc.rune}
				if tc.skill == "Tripwire" {
					oldX, oldZ := target.X, target.Z
					target.X = p.X + .5
					w.Grid.Update(target, oldX, oldZ)
				}
				if tc.setup != "" {
					if result := w.PerformAbility(p.ID, p.X, p.Z, "", tc.setup); !result.Accepted {
						t.Fatal("paid status setup rejected")
					}
					p.LastAbilityTime = time.Now().Add(-time.Second)
				}
				start := time.Now()
				if tc.skill == "Basic Attack" {
					if _, accepted := w.PerformAttack(p.ID, target.ID); !accepted {
						t.Fatal("paid coated attack rejected")
					}
					w.backgroundWork.SealWhenIdle()
				} else {
					if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill); !result.Accepted {
						t.Fatal("paid delivery rejected")
					}
					advancePaidProjectileUntilHit(t, w, p, target)
				}
				end := time.Now()
				want := time.Duration(math.Round(float64(tc.base) * (1 + .04*float64(rank))))
				deadline := tc.deadline(target)
				if deadline.Before(start.Add(want)) || deadline.After(end.Add(want)) {
					t.Fatalf("on-hit duration=%v..%v want=%v", deadline.Sub(end), deadline.Sub(start), want)
				}
				p.TalentRanks = nil
				if !tc.deadline(target).Equal(deadline) {
					t.Fatal("later ranks altered applied on-hit duration")
				}
			})
		}
	}
}
