package game

import (
	"fmt"
	"maps"
	"math"
	"testing"
	"time"
)

func TestGripMasteryPaidRootDuration(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, generic := range []int{0, 5} {
			t.Run(fmt.Sprintf("rank%d/generic%d", rank, generic), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Fighter", true)
				defer w.StopBackground()
				p.Level, p.UnlockedSkills = 100, []string{"Unbreakable Grip"}
				p.TalentRanks = map[string]int{"FTR_15": rank, "FTR_30": generic, "FTR_37": generic}
				p.Mana = p.MaxMana
				hp, mana, start := target.Health, p.Mana, time.Now()
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Unbreakable Grip")
				end := time.Now()
				if !result.Accepted || p.Mana != mana-35 || result.CooldownRemaining <= 0 {
					t.Fatalf("paid control: %+v", result)
				}
				duration := time.Duration(math.Round(float64(time.Second) * (1 + .04*float64(rank) + .07*float64(generic))))
				if !target.Rooted || target.RootEndTime.Before(start.Add(duration)) || target.RootEndTime.After(end.Add(duration)) {
					t.Fatalf("duration=%v..%v want=%v", target.RootEndTime.Sub(end), target.RootEndTime.Sub(start), duration)
				}
				deadline := target.RootEndTime
				p.TalentRanks = nil
				p.RecalculateStats()
				if target.Health != hp || target.Stunned || target.RootEndTime != deadline || math.Abs(math.Hypot(target.X-p.X, target.Z-p.Z)-2) > 1e-8 {
					t.Fatal("mastery changed damage, stun, pull endpoint or existing duration")
				}
			})
		}
	}
}

func TestGripMasteryPurchasesAndCaps(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Unbreakable Grip"}
	p.TalentRanks = nil
	p.recomputeTalentPoints()
	points := p.TalentPoints
	for rank := 1; rank <= 5; rank++ {
		if _, ok, reason := w.PerformUnlockTalent(p.ID, "FTR_15"); !ok {
			t.Fatal(reason)
		}
		if p.TalentRanks["FTR_15"] != rank || p.TalentPoints != points-rank {
			t.Fatal("purchase price/rank mismatch")
		}
	}
	if _, ok, _ := w.PerformUnlockTalent(p.ID, "FTR_15"); ok || p.TalentPoints != points-5 {
		t.Fatal("sixth purchase charged")
	}
	p.TalentRanks = map[string]int{"FTR_15": 999, "FTR_30": -1, "FTR_37": -1, "CLR_15": 5}
	ranks := maps.Clone(p.TalentRanks)
	p.Mana = p.MaxMana
	start := time.Now()
	if !w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Unbreakable Grip").Accepted {
		t.Fatal("cast rejected")
	}
	end := time.Now()
	if !maps.Equal(ranks, p.TalentRanks) || target.RootEndTime.Before(start.Add(1200*time.Millisecond)) || target.RootEndTime.After(end.Add(1200*time.Millisecond)) {
		t.Fatal("rank caps, foreign exclusion or immutable save failed")
	}
}
