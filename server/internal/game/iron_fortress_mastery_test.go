package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestIronFortressMasteryReachesPaidDurationAndExpires(t *testing.T) {
	for _, runeID := range []string{"", "ironfortress_extended", "ironfortress_thorns", "ironfortress_immovable"} {
		for _, rank := range []int{0, 1, 5} {
			for _, generic := range []int{0, 5} {
				t.Run(fmt.Sprintf("%s/rank%d/general%d", runeID, rank, generic), func(t *testing.T) {
					w, p, enemy := directSkillWallFixture("Fighter", true)
					defer w.StopBackground()
					p.Level, p.UnlockedSkills = 100, []string{"Iron Fortress"}
					p.BaseStats = InitialPlayerStats()
					p.TalentRanks = map[string]int{"FTR_07": rank, "FTR_30": generic, "FTR_37": generic}
					p.SkillRunes = map[string]string{"Iron Fortress": runeID}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					mana, defense, speed, cdr := p.Mana, p.Defense, p.Speed, p.CooldownReduction
					start := time.Now()
					result := w.PerformAbility(p.ID, p.X, p.Z, "", "Iron Fortress")
					end := time.Now()
					if !result.Accepted || p.Mana != mana-40 || !p.IronFortressActive {
						t.Fatalf("ordinary paid cast failed: %+v mana=%d->%d", result, mana, p.Mana)
					}
					base := 30.0
					if runeID == "ironfortress_extended" {
						base = 45
					}
					want := time.Duration(math.Round(base * (1 + .04*float64(rank) + .07*float64(generic)) * float64(time.Second)))
					deadline := p.IronFortressEndTime
					if deadline.Before(start.Add(want)) || deadline.After(end.Add(want)) {
						t.Fatalf("duration=%v..%v want=%v", deadline.Sub(end), deadline.Sub(start), want)
					}
					if math.Abs(p.Cooldowns["Iron Fortress"].Sub(start).Seconds()-60*(1-cdr)) > .1 ||
						p.Defense != int(float64(defense)*1.5) || math.Abs(p.Speed-speed*.8) > 1e-8 {
						t.Fatal("duration mastery changed cooldown or defense/speed strength")
					}
					if p.IronFortressThorns != (runeID == "ironfortress_thorns") || p.IronFortressImmovable != (runeID == "ironfortress_immovable") {
						t.Fatal("duration mastery changed rune selection")
					}
					if runeID == "ironfortress_thorns" && ApplyDamageReflect(enemy, p, 100) != 20 {
						t.Fatal("duration mastery changed reflection strength")
					}
					p.TalentRanks = nil
					p.RecalculateStats()
					if !p.IronFortressEndTime.Equal(deadline) {
						t.Fatal("later rank changes rewrote paid duration")
					}
					p.IronFortressEndTime = time.Now().Add(-time.Millisecond)
					w.updateEntity(p, 0, nil, &deferredActions{})
					if p.IronFortressActive || p.IronFortressThorns || p.IronFortressImmovable ||
						p.Defense != defense || math.Abs(p.Speed-speed) > 1e-8 {
						t.Fatal("expiry did not remove protection and restore stats")
					}
				})
			}
		}
	}
}

func TestIronFortressMasteryIsSkillScopedDurationNotPhantomDamage(t *testing.T) {
	p := newTestPlayer("fortress-mastery-scope", "Fighter")
	p.TalentRanks = map[string]int{"FTR_07": 5}
	bonus := p.GetSkillBonus("Iron Fortress")
	if math.Abs(bonus.SkillDuration-.2) > 1e-8 || bonus.SkillDamage != 0 {
		t.Fatalf("expected duration-only mastery: %+v", bonus)
	}
	for _, skill := range []string{"Guardian Roar", "Berserker Edge", "Last Stand Rampage", "Charge"} {
		bonus := p.GetSkillBonus(skill)
		if bonus.SkillDuration != 0 || bonus.SkillDamage != 0 {
			t.Fatalf("mastery leaked into %s: %+v", skill, bonus)
		}
	}
}

func TestIronFortressMasteryOrdinaryPurchasesPreserveIDAndPointCosts(t *testing.T) {
	w, p, _ := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Iron Fortress"}
	p.TalentRanks = nil
	p.recomputeTalentPoints()
	available := p.TalentPoints
	for rank := 1; rank <= 5; rank++ {
		if _, ok, reason := w.PerformUnlockTalent(p.ID, "FTR_07"); !ok {
			t.Fatalf("ordinary purchase %d failed: %s", rank, reason)
		}
		if p.TalentRanks["FTR_07"] != rank || p.TalentPoints != available-rank {
			t.Fatal("purchase changed the saved ID, rank progression or point cost")
		}
	}
	if _, ok, _ := w.PerformUnlockTalent(p.ID, "FTR_07"); ok || p.TalentRanks["FTR_07"] != 5 || p.TalentPoints != available-5 {
		t.Fatal("sixth purchase exceeded the preserved rank cap or spent points")
	}
	p.Mana = p.MaxMana
	start := time.Now()
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Iron Fortress"); !result.Accepted {
		t.Fatal("trained cast rejected")
	}
	if math.Abs(p.IronFortressEndTime.Sub(start).Seconds()-36) > .1 {
		t.Fatal("ordinary purchased ranks did not reach the actual cast")
	}
}
