package game

// Diagnostic overlay only: these paired casts expose remaining consumers.
// Run with scripts/audit-talent-consumers.mjs; they are not silently skipped
// tests in the passing release suite. Promote them when implementing each fix.

import (
	"math"
	"testing"
	"time"
)

// Healing Light now has normal coverage in talent_healing_consumer_test.go.
func TestPendingTalentShieldDurationConsumer(t *testing.T) {
	for _, rank := range []int{0, 5} {
		w := newTestWorld()
		p := newTestPlayer("probe-shield", "Wizard")
		p.Level = 100
		p.TalentRanks["WIZ_32"] = rank
		p.UnlockedSkills = []string{"Arcane Shield"}
		w.AddEntity(p)
		start := time.Now()
		result := w.PerformAbility(p.ID, 0, 0, "", "Arcane Shield")
		want := 20.0 * (1 + 0.05*float64(rank))
		got := p.ArcaneShieldEndTime.Sub(start).Seconds()
		if !result.Accepted || math.Abs(got-want) > 0.1 {
			t.Errorf("rank=%d accepted=%t duration=%.3fs; want %.3fs", rank, result.Accepted, got, want)
		}
	}
}

func TestPendingTalentRangeConsumer(t *testing.T) {
	for _, rank := range []int{0, 5} {
		w := newTestWorld()
		p := newTestPlayer("probe-range", "Wizard")
		p.Level = 100
		p.TalentRanks["WIZ_35"] = rank
		p.UnlockedSkills = []string{"Teleport"}
		w.AddEntity(p)
		result := w.PerformAbility(p.ID, 17, 0, "", "Teleport")
		if result.Accepted != (rank > 0) {
			t.Errorf("rank=%d cast at17m accepted=%t; want %t (15m base,18m ranked)", rank, result.Accepted, rank > 0)
		}
	}
}

func TestPendingTalentAreaConsumer(t *testing.T) {
	for _, rank := range []int{0, 5} {
		w := newTestWorld()
		p := newTestPlayer("probe-area", "Cleric")
		p.Level = 100
		p.TalentRanks["CLR_34"] = rank
		p.UnlockedSkills = []string{"Purifying Wave"}
		ally := newTestPlayer("probe-ally", "Cleric")
		ally.X = 10.2
		ally.Radius = 1.25
		ally.Bleeding = true
		w.AddEntity(p)
		w.AddEntity(ally)
		result := w.PerformAbility(p.ID, 0, 0, "", "Purifying Wave")
		if !result.Accepted || (!ally.Bleeding) != (rank > 0) {
			t.Errorf("rank=%d accepted=%t cleansed10.2mAlly=%t; want %t", rank, result.Accepted, !ally.Bleeding, rank > 0)
		}
	}
}
