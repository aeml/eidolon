package game

// Diagnostic overlay only: these paired casts expose remaining consumers.
// Run with scripts/audit-talent-consumers.mjs; they are not silently skipped
// tests in the passing release suite. Promote them when implementing each fix.

import "testing"

// Healing, Wizard status durations, Teleport, Purifying Wave, Guardian
// Embrace and holy ground now have ordinary actual-consumer tests.
// Group the next three immediate area consumers in one diagnostic batch.
func TestPendingTalentClericImmediateAreas(t *testing.T) {
	for _, skill := range []string{"Blessing of Resolve", "Blessing of Zeal", "Heaven's Trumpet"} {
		t.Run(skill, func(t *testing.T) {
			for _, rank := range []int{0, 5} {
				w := newTestWorld()
				p := newTestPlayer("probe-area", "Cleric")
				p.InstanceID = "qa-cleric-immediate-area-probe"
				p.Level = 100
				p.TalentRanks["CLR_34"] = rank
				p.UnlockedSkills = []string{skill}
				ally := newTestPlayer("probe-ally", "Cleric")
				ally.InstanceID = p.InstanceID
				ally.X = 12.2
				ally.Radius = 1.25
				ally.Health = 100
				if skill == "Heaven's Trumpet" {
					ally.Type, ally.X = TypeEnemy, 14.2
				}
				w.AddEntity(p)
				w.AddEntity(ally)
				result := w.PerformAbility(p.ID, 0, 0, "", skill)
				applied := ally.BlessingResolveActive || ally.ZealActive || ally.Health < 100
				if !result.Accepted || applied != (rank > 0) {
					t.Errorf("rank=%d accepted=%t appliedAt%vm=%t; want %t", rank, result.Accepted, ally.X, applied, rank > 0)
				}
			}
		})
	}
}
