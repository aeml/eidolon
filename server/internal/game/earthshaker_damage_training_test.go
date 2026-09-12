package game

import (
	"fmt"
	"maps"
	"math"
	"testing"
	"time"
)

func TestEarthshakerPaidDamageTraining(t *testing.T) {
	for _, runeID := range []string{"", "earthshaker_fissure", "earthshaker_seismic", "earthshaker_aftershock"} {
		for _, rank := range []int{0, 1, 5} {
			for _, generic := range []int{0, 5} {
				t.Run(fmt.Sprintf("%s/rank%d/generic%d", runeID, rank, generic), func(t *testing.T) {
					w, p, target := directSkillWallFixture("Fighter", true)
					defer w.StopBackground()
					p.Level, p.UnlockedSkills = 100, []string{"Earthshaker"}
					p.TalentRanks = map[string]int{"FTR_13": rank, "FTR_38": generic}
					p.SkillRunes = map[string]string{"Earthshaker": runeID}
					p.RecalculateStats()
					p.Damage, p.Stats.Strength, p.Mana = 50, 10, p.MaxMana
					mana, hp := p.Mana, target.Health
					result := w.PerformAbility(p.ID, target.X, target.Z, "", "Earthshaker")
					if !result.Accepted || p.Mana != mana-40 || !target.Stunned || result.CooldownRemaining <= 0 {
						t.Fatalf("paid cast control failed: %+v mana=%d stun=%v", result, p.Mana, target.Stunned)
					}
					want := int(math.Floor(70*(1+.04*float64(rank)+.02*float64(generic)) + 1e-9))
					if hp-target.Health != want || target.Threat[p.ID] != float64(want) {
						t.Errorf("damage=%d threat=%v want=%d", hp-target.Health, target.Threat[p.ID], want)
					}
				})
			}
		}
	}
}

func TestEarthshakerDamageTrainingCapsAndPurchases(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Earthshaker"}
	p.TalentRanks = nil
	p.recomputeTalentPoints()
	points := p.TalentPoints
	for rank := 1; rank <= 5; rank++ {
		if _, ok, reason := w.PerformUnlockTalent(p.ID, "FTR_13"); !ok {
			t.Fatalf("purchase %d failed: %s", rank, reason)
		}
		if p.TalentRanks["FTR_13"] != rank || p.TalentPoints != points-rank {
			t.Fatal("purchase changed rank identity or one-point cost")
		}
	}
	if _, ok, _ := w.PerformUnlockTalent(p.ID, "FTR_13"); ok || p.TalentPoints != points-5 {
		t.Fatal("sixth purchase spent a point")
	}
	p.TalentRanks["FTR_13"], p.TalentRanks["FTR_38"], p.TalentRanks["CLR_13"] = 999, -1, 5
	ranks := maps.Clone(p.TalentRanks)
	p.Damage, p.Stats.Strength, p.Mana = 50, 10, p.MaxMana
	hp := target.Health
	if !w.PerformAbility(p.ID, target.X, target.Z, "", "Earthshaker").Accepted {
		t.Fatal("cast rejected")
	}
	if hp-target.Health != 84 || !maps.Equal(ranks, p.TalentRanks) {
		t.Fatalf("cap/foreign-rank/immutable save failed: damage=%d ranks=%v", hp-target.Health, p.TalentRanks)
	}
}

func TestEarthshakerTrainedAftershockKeepsOriginalDamageBudget(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Earthshaker"}
	p.TalentRanks = map[string]int{"FTR_13": 5, "FTR_38": 5}
	p.SkillRunes = map[string]string{"Earthshaker": "earthshaker_aftershock"}
	p.Damage, p.Stats.Strength, p.Mana = 50, 10, p.MaxMana
	hits := make(chan DamageEvent, 4)
	w.OnEvent = func(kind string, value interface{}) {
		if event, ok := value.(DamageEvent); kind == "damage" && ok && event.SourceID == p.ID && event.TargetID == target.ID {
			hits <- event
		}
	}
	if !w.PerformAbility(p.ID, target.X, target.Z, "", "Earthshaker").Accepted {
		t.Fatal("cast rejected")
	}
	w.Mu.Lock()
	p.Mu.Lock()
	p.TalentRanks = nil
	p.Damage, p.Stats.Strength = 500, 100
	p.Mu.Unlock()
	w.Mu.Unlock()
	for _, want := range []int{91, 45} {
		select {
		case event := <-hits:
			if event.Amount != want {
				t.Errorf("damage=%d want original cast budget=%d", event.Amount, want)
			}
		case <-time.After(5 * time.Second):
			t.Fatal("missing actual wave damage receipt")
		}
	}
}

func TestEarthshakerTrainedDamageRetainsCriticalAndWallAdmission(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		for _, runeID := range []string{"", "earthshaker_fissure", "earthshaker_seismic"} {
			t.Run(fmt.Sprintf("%s/doorway%v", runeID, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Fighter", doorway)
				defer w.StopBackground()
				p.Level, p.UnlockedSkills = 100, []string{"Earthshaker"}
				p.TalentRanks = map[string]int{"FTR_13": 5, "FTR_38": 5}
				p.SkillRunes = map[string]string{"Earthshaker": runeID}
				p.Damage, p.Stats.Strength, p.CritChanceBonus, p.Mana = 50, 10, 1, p.MaxMana
				hp := target.Health
				if !w.PerformAbility(p.ID, target.X, target.Z, "", "Earthshaker").Accepted {
					t.Fatal("self-centered quake should cast even if the wall excludes its target")
				}
				want := 0
				if doorway {
					want = 182
				}
				if hp-target.Health != want || target.Stunned != doorway {
					t.Fatalf("damage=%d want=%d stunned=%v", hp-target.Health, want, target.Stunned)
				}
			})
		}
	}
}
