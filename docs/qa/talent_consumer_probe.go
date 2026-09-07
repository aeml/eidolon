package game

// Diagnostic overlay only: these paired casts expose remaining consumers.
// Run with scripts/audit-talent-consumers.mjs; they are not silently skipped
// tests in the passing release suite. Promote them when implementing each fix.

import (
	"fmt"
	"testing"
)

// Healing, Wizard status durations, Teleport, Purifying Wave, Guardian
// Embrace, holy ground, both Blessings and Trumpet have ordinary consumer tests.
// Spirit Guardians and its Boost still need their real periodic area repaired.
func TestPendingTalentSpiritAreas(t *testing.T) {
	for _, skill := range []string{"Spirit Guardians", "Spirit Guardians Boost"} {
		for _, expanded := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/expanded%v", skill, expanded), func(t *testing.T) {
				for _, rank := range []int{0, 5} {
					w := newTestWorld()
					p := newTestPlayer("probe-area", "Cleric")
					p.InstanceID = "qa-spirit-area-probe"
					p.Level = 100
					p.Stats.Wisdom = 10
					p.TalentRanks["CLR_34"] = rank
					p.UnlockedSkills = []string{skill}
					radius := 16.0
					if skill == "Spirit Guardians Boost" {
						radius = 20
					}
					if expanded {
						radius *= 1.5
						p.SkillRunes = map[string]string{"Spirit Guardians": "spirits_expanded"}
					}
					target := newTestPlayer("probe-enemy", "Wizard")
					target.InstanceID, target.Type = p.InstanceID, TypeEnemy
					target.X = radius*1.10 + 1.25
					target.Radius = 1.25
					w.AddEntity(p)
					w.AddEntity(target)
					result := w.PerformAbility(p.ID, 0, 0, "", skill)
					before := target.Health
					w.updateEntity(p, 0, nil, &deferredActions{})
					applied := target.Health < before
					if !result.Accepted || applied != (rank > 0) {
						t.Errorf("rank=%d accepted=%t damageAt%vm=%t; want %t", rank, result.Accepted, target.X, applied, rank > 0)
					}
				}
			})
		}
	}
}
