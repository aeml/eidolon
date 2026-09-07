package game

import (
	"math"
	"math/rand"
	"os"
	"testing"
)

// This isolated diagnostic process uses a fixed production RNG roll to compare
// actual casts, not a statistical sample or a replacement damage implementation.
// No parallel subtests: reseeding the process-global RNG is deliberate here.
func TestTalentedCriticalChanceActualCasts(t *testing.T) {
	debug := os.Getenv("GODEBUG")
	if debug != "" {
		debug += ","
	}
	t.Setenv("GODEBUG", debug+"randseednop=0")
	const equipmentCrit = .55
	for _, tc := range []struct{ class, skill, talent string }{
		{"Rogue", "Backstab", "ROG_04"},
		{"Rogue", "Backstab", "ROG_32"},
		{"Wizard", "Flame Whip", "WIZ_39"},
		{"Fighter", "Shield Slam", "FTR_39"},
	} {
		t.Run(tc.talent+"/"+tc.skill, func(t *testing.T) {
			damage := make(map[string]int)
			for _, build := range []struct {
				name      string
				rank      int
				equipment float64
			}{
				{"untrained", 0, equipmentCrit},
				{"trained", 5, equipmentCrit},
				{"equipment-control", 0, .65},
			} {
				w := newTestWorld()
				p := newTestPlayer("critical-probe-caster", tc.class)
				p.InstanceID, p.Level = "qa-critical-consumer", 100
				p.TalentRanks = map[string]int{tc.talent: build.rank}
				p.UnlockedSkills = []string{tc.skill}
				p.RecalculateStats()
				p.Mana, p.Damage, p.CritChanceBonus = p.MaxMana, 100, build.equipment
				p.Rotation = math.Pi // Avoid Backstab's independent behind-target bonus.
				target := newTestPlayer("critical-probe-target", "Skeleton")
				target.Type, target.InstanceID, target.X = TypeEnemy, p.InstanceID, 2
				target.Health, target.MaxHealth, target.Defense = 10000, 10000, 0
				w.AddEntity(p)
				w.AddEntity(target)
				bonus := p.GetSkillBonus(tc.skill).SkillCritChance
				rand.Seed(1)
				roll := rand.Float64()
				wantCrit := build.name != "untrained"
				if (roll < build.equipment+bonus) != wantCrit {
					t.Fatalf("invalid paired fixture: roll=%v equipment=%v rank=%d bonus=%v", roll, build.equipment, build.rank, bonus)
				}
				beforeHP, beforeMana := target.Health, p.Mana
				rand.Seed(1)
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill)
				damage[build.name] = beforeHP - target.Health
				if !result.Accepted || damage[build.name] <= 0 || p.Mana >= beforeMana {
					t.Fatalf("ordinary paid cast failed: %+v damage=%d mana=%d before=%d", result, damage[build.name], p.Mana, beforeMana)
				}
				t.Logf("%s rank=%d roll=%.6f equipment=%.2f skillBonus=%.2f actualDamage=%d", build.name, build.rank, roll, build.equipment, bonus, damage[build.name])
			}
			if damage["equipment-control"] != 2*damage["untrained"] {
				t.Fatalf("equipment-only critical control failed: %v", damage)
			}
			if damage["trained"] != 2*damage["untrained"] {
				t.Errorf("fixed roll crosses only trained critical threshold: rank0=%d rank5=%d; want trained damage %d", damage["untrained"], damage["trained"], 2*damage["untrained"])
			}
		})
	}
}
