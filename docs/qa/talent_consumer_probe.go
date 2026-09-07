package game

// Diagnostic overlay only: these paired casts expose remaining consumers.
// Run with scripts/audit-talent-consumers.mjs; they are not silently skipped
// tests in the passing release suite. Promote them when implementing each fix.

import "testing"

// Healing, Wizard status durations, Teleport and Purifying Wave now have
// ordinary actual-consumer tests. This next periodic-area probe stays open.
func TestPendingTalentGuardianAreaConsumer(t *testing.T) {
	for _, rank := range []int{0, 5} {
		w := newTestWorld()
		p := newTestPlayer("probe-area", "Cleric")
		p.InstanceID = "qa-guardian-area-probe"
		p.Level = 100
		p.TalentRanks["CLR_34"] = rank
		p.UnlockedSkills = []string{"Guardian Embrace"}
		ally := newTestPlayer("probe-ally", "Cleric")
		ally.InstanceID = p.InstanceID
		ally.X = 12.2
		ally.Radius = 1.25
		ally.Health = 100
		w.AddEntity(p)
		w.AddEntity(ally)
		result := w.PerformAbility(p.ID, 0, 0, "", "Guardian Embrace")
		w.updateEntity(p, 0, nil, &deferredActions{})
		if !result.Accepted || (ally.Health > 100) != (rank > 0) {
			t.Errorf("rank=%d accepted=%t healed12.2mAlly=%t; want %t (10m base,11.5m ranked plus1.25m body)", rank, result.Accepted, ally.Health > 100, rank > 0)
		}
	}
}
