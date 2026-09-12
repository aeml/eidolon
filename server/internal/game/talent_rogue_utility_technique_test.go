package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestPurchasedRogueUtilityTechniquesReachPaidCasts(t *testing.T) {
	for _, tc := range []struct {
		skill, talent      string
		cost               int
		cooldown, duration time.Duration
		deadline           func(*Entity, *Entity) time.Time
	}{
		{"Weak Point Mark", "ROG_06", 25, 12 * time.Second, 10 * time.Second, func(_, e *Entity) time.Time { return e.WeakPointEndTime }},
		{"Serrated Edges", "ROG_14", 30, 20 * time.Second, 10 * time.Second, func(p, _ *Entity) time.Time { return p.SerratedEdgesEndTime }},
		{"Smoke Bomb", "ROG_20", 35, 20 * time.Second, 5 * time.Second, func(_, e *Entity) time.Time { return e.SlowEndTime }},
		{"Cloak & Vanish", "ROG_26", 30, 30 * time.Second, 5 * time.Second, func(p, _ *Entity) time.Time { return p.StealthEndTime }},
	} {
		for _, rank := range []int{0, 1, 5} {
			for _, sufficient := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/rank%d/sufficient%t", tc.skill, rank, sufficient), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("technique-owner", "Rogue")
					p.InstanceID, p.X, p.Z = "utility-technique", 60000, 60000
					w.AddEntity(p)
					w.SetPlayerLevel(p.ID, 100)
					p.UnlockedSkills = []string{tc.skill}
					points := p.TalentPoints
					for i := 0; i < rank; i++ {
						if _, ok, reason := w.PerformUnlockTalent(p.ID, tc.talent); !ok {
							t.Fatal(reason)
						}
					}
					if p.TalentPoints != points-rank || p.TalentRanks[tc.talent] != rank {
						t.Fatal("purchase accounting changed")
					}
					// Cloak recalculates derived stats while applying stealth. Keep
					// a lawful stat fixture, including its existing global CDR.
					p.RecalculateStats()
					globalCDR := p.CooldownReduction
					cost := int(math.Floor(float64(tc.cost)*(1-.02*float64(rank)) + 1e-9))
					p.Mana = cost
					if !sufficient {
						p.Mana--
					}
					available := p.Mana
					target := &Entity{ID: "technique-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
						InstanceID: p.InstanceID, X: p.X + 2, Z: p.Z, Scale: 1, BaseStats: Stats{Vitality: 1000}}
					target.RecalculateStats()
					target.Health = target.MaxHealth
					w.AddEntity(target)
					health, start := target.Health, time.Now()
					result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill)
					end := time.Now()
					if result.Accepted != sufficient {
						t.Fatalf("rank%d mana%d: %+v", rank, available, result)
					}
					if target.Health != health {
						t.Fatal("utility dealt damage")
					}
					if sufficient {
						wantCooldown := tc.cooldown.Seconds() * (1 - globalCDR) * (1 - .03*float64(rank))
						if p.Mana != 0 || math.Abs(result.CooldownRemaining-wantCooldown) > 1e-6 {
							t.Fatalf("paid cast: %+v; want cooldown %v", result, wantCooldown)
						}
						deadline := tc.deadline(p, target)
						if deadline.Before(start.Add(tc.duration)) || deadline.After(end.Add(tc.duration)) {
							t.Fatal("Technique changed effect duration")
						}
						p.Mana = p.MaxMana
						if retry := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill); retry.Accepted || p.Mana != p.MaxMana {
							t.Fatal("cooldown rejection changed")
						}
					} else if p.Mana != available || !tc.deadline(p, target).IsZero() {
						t.Fatal("rejected cast changed mana or effect")
					}
					if p.GetSkillBonus(tc.skill).SkillCritChance != 0 {
						t.Fatal("utility still grants unusable critical chance")
					}
				})
			}
		}
	}
}

func TestRogueUtilityTechniqueEconomyStaysScopedAndPreservesEquipmentRounding(t *testing.T) {
	p := newTestPlayer("utility-economy", "Rogue")
	p.ActiveUniqueEffects = []string{"efficient"}
	p.TalentRanks = map[string]int{"ROG_06": 5, "WIZ_27": 5}
	if got := resolveAbilityManaCost(p, "Weak Point Mark", 25); got != 19 {
		t.Fatalf("equipment then Technique = %d want19", got)
	}
	if got := resolveAbilityManaCost(p, "Smoke Bomb", 35); got != 31 {
		t.Fatalf("unrelated skill = %d want31", got)
	}
	p.SubType = "Fighter"
	if got := resolveAbilityManaCost(p, "Weak Point Mark", 25); got != 22 {
		t.Fatalf("other class = %d want22", got)
	}
}
