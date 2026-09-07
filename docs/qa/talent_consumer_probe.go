package game

// Diagnostic overlay only: these paired casts expose remaining consumers.
// Run with scripts/audit-talent-consumers.mjs; they are not silently skipped
// tests in the passing release suite. Promote them when implementing each fix.

import "testing"

// Healing, Wizard status durations, Teleport, Purifying Wave and Guardian
// Embrace now have ordinary actual-consumer tests. Holy ground remains open.
func TestPendingTalentConsecratedAreaConsumer(t *testing.T) {
	for _, rank := range []int{0, 5} {
		w := newTestWorld()
		p := newTestPlayer("probe-area", "Cleric")
		p.InstanceID = "qa-consecrated-area-probe"
		p.Level = 100
		p.TalentRanks["CLR_34"] = rank
		p.UnlockedSkills = []string{"Consecrated Ground"}
		ally := newTestPlayer("probe-ally", "Cleric")
		ally.InstanceID = p.InstanceID
		ally.X = 6.8
		ally.Radius = 1.25
		ally.Health = 100
		w.AddEntity(p)
		w.AddEntity(ally)
		result := w.PerformAbility(p.ID, 0, 0, "", "Consecrated Ground")
		var zone *Entity
		for _, candidate := range w.Entities {
			if candidate.SubType == "ZoneHoly" && candidate.OwnerID == p.ID {
				zone = candidate
				break
			}
		}
		if zone == nil {
			t.Fatal("accepted cast did not create its holy zone")
		}
		w.updateEntity(zone, 0, nil, &deferredActions{})
		if !result.Accepted || (ally.Health > 100) != (rank > 0) {
			t.Errorf("rank=%d accepted=%t healed6.8mAlly=%t; want %t (5m base,5.75m ranked plus1.25m body)", rank, result.Accepted, ally.Health > 100, rank > 0)
		}
	}
}
