package game

// Diagnostic overlay only: these paired casts expose remaining consumers.
// Run with scripts/audit-talent-consumers.mjs; they are not silently skipped
// tests in the passing release suite. Promote them when implementing each fix.

import (
	"math"
	"testing"
	"time"
)

func TestPendingTalentHealingConsumer(t *testing.T) {
	for _, rank := range []int{0, 5} {
		w := newTestWorld()
		p := newTestPlayer("probe-healer", "Cleric")
		p.Level = 100
		p.Stats.Wisdom = 10
		p.Health = 100
		p.HealingDoneBonus = 0.2
		p.TalentRanks["CLR_03"] = rank
		p.UnlockedSkills = []string{"Healing Light"}
		w.AddEntity(p)
		result := w.PerformAbility(p.ID, 0, 0, p.ID, "Healing Light")
		want := 72
		if rank > 0 {
			want = 86
		}
		if !result.Accepted || p.Health-100 != want {
			t.Errorf("rank=%d accepted=%t healed=%d; want %d", rank, result.Accepted, p.Health-100, want)
		}
	}
}

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
