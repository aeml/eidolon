package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestPurchasedRogueUtilityMasteriesReachPaidEffects(t *testing.T) {
	for _, tc := range []struct {
		skill, talent, rune string
		base                time.Duration
		cost                int
		deadline            func(*Entity, *Entity) time.Time
	}{
		{"Weak Point Mark", "ROG_05", "", 10 * time.Second, 25, func(_, e *Entity) time.Time { return e.WeakPointEndTime }},
		{"Smoke Bomb", "ROG_19", "", 5 * time.Second, 35, func(_, e *Entity) time.Time { return e.SlowEndTime }},
		{"Smoke Bomb", "ROG_19", "", 5 * time.Second, 35, func(_, e *Entity) time.Time { return e.AccuracyReductionEndTime }},
		{"Cloak & Vanish", "ROG_25", "", 5 * time.Second, 30, func(p, _ *Entity) time.Time { return p.StealthEndTime }},
		{"Cloak & Vanish", "ROG_25", "cloak_longer", 10 * time.Second, 30, func(p, _ *Entity) time.Time { return p.StealthEndTime }},
		{"Cloak & Vanish", "ROG_25", "cloak_swift", 3 * time.Second, 30, func(p, _ *Entity) time.Time { return p.CloakBurstSpeedEndTime }},
	} {
		for _, rank := range []int{0, 1, 5} {
			for _, generic := range []int{0, 5} {
				t.Run(fmt.Sprintf("%s/%s/rank%d/generic%d", tc.skill, tc.rune, rank, generic), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("utility-owner", "Rogue")
					p.InstanceID, p.X, p.Z = "utility-mastery", 60000, 60000
					w.AddEntity(p)
					w.SetPlayerLevel(p.ID, 100)
					p.UnlockedSkills = []string{tc.skill}
					points := p.TalentPoints
					for id, ranks := range map[string]int{tc.talent: rank, "ROG_28": generic} {
						for i := 0; i < ranks; i++ {
							if _, ok, reason := w.PerformUnlockTalent(p.ID, id); !ok {
								t.Fatal(reason)
							}
						}
					}
					if p.TalentPoints != points-rank-generic || p.TalentRanks[tc.talent] != rank {
						t.Fatal("purchase accounting")
					}
					p.SkillRunes = map[string]string{tc.skill: tc.rune}
					p.Mana = p.MaxMana
					target := &Entity{ID: "utility-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
						InstanceID: p.InstanceID, X: p.X + 2, Z: p.Z, Scale: 1,
						BaseStats: Stats{Vitality: 1000}}
					// Smoke applies a slow and recalculates the target's derived stats.
					// Use a valid base-stat health budget, not synthetic current/max health.
					target.RecalculateStats()
					target.Health = target.MaxHealth
					w.AddEntity(target)
					mana, health, maxHealth, start := p.Mana, target.Health, target.MaxHealth, time.Now()
					result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill)
					end := time.Now()
					if !result.Accepted || mana-p.Mana != tc.cost || target.Health != health || target.MaxHealth != maxHealth {
						t.Fatalf("paid utility cast: %+v; mana before=%d after=%d want cost=%d; target health=%d max=%d", result, mana, p.Mana, tc.cost, target.Health, target.MaxHealth)
					}
					want := time.Duration(math.Round(float64(tc.base) * (1 + .04*float64(rank+generic))))
					deadline := tc.deadline(p, target)
					if deadline.Before(start.Add(want)) || deadline.After(end.Add(want)) {
						t.Fatalf("deadline %v..%v want %v", deadline.Sub(end), deadline.Sub(start), want)
					}
					if p.GetSkillBonus(tc.skill).SkillDamage != 0 {
						t.Fatal("utility still advertises nonexistent damage")
					}
					p.TalentRanks = nil
					if !tc.deadline(p, target).Equal(deadline) {
						t.Fatal("applied duration changed with later ranks")
					}
				})
			}
		}
	}
}
