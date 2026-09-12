package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestGuardianRoarMasteryPaidPartyDurationAndExpiry(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, generic := range []int{0, 5} {
			for _, combo := range []bool{false, true} {
				t.Run(fmt.Sprintf("rank%d/general%d/combo%v", rank, generic, combo), func(t *testing.T) {
					w, p, enemy := directSkillWallFixture("Fighter", true)
					defer w.StopBackground()
					p.Level, p.UnlockedSkills = 100, []string{"Shield Slam", "Guardian Roar"}
					p.BaseStats = InitialPlayerStats()
					p.TalentRanks = map[string]int{"FTR_09": rank, "FTR_30": generic, "FTR_37": generic, "FTR_36": 5}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					party := w.CreateParty(p.ID)
					if party == nil {
						t.Fatal("party creation failed")
					}
					allies := make([]*Entity, 0, 3)
					for _, placement := range []string{"near", "far", "other-instance"} {
						ally := newTestPlayer("roar-mastery-"+placement, "Fighter")
						ally.X, ally.Z, ally.InstanceID = p.X, p.Z, p.InstanceID
						// A recipient's own mastery must not replace the caster's duration.
						ally.TalentRanks = map[string]int{"FTR_09": 5, "FTR_30": 5, "FTR_37": 5, "FTR_36": 5}
						ally.RecalculateStats()
						if placement == "far" {
							ally.X += 100
						}
						if placement == "other-instance" {
							ally.InstanceID = "other-roar-instance"
						}
						w.AddEntity(ally)
						if err := w.JoinParty(party.ID, ally.ID); err != nil {
							t.Fatal(err)
						}
						allies = append(allies, ally)
					}
					base := 10.0
					if combo {
						if r := w.PerformAbility(p.ID, enemy.X, enemy.Z, enemy.ID, "Shield Slam"); !r.Accepted {
							t.Fatal("combo opener rejected")
						}
						p.LastAbilityTime = time.Now().Add(-time.Second)
						base = 15
					}
					mana, defense, allyDefense, health := p.Mana, p.Defense, allies[0].Defense, enemy.Health
					start := time.Now()
					result := w.PerformAbility(p.ID, p.X, p.Z, "", "Guardian Roar")
					end := time.Now()
					if !result.Accepted || p.Mana != mana-35 || !p.GuardianRoarActive {
						t.Fatalf("paid roar failed: %+v", result)
					}
					want := time.Duration(math.Round(base * (1 + .04*float64(rank) + .07*float64(generic)) * float64(time.Second)))
					deadline := p.GuardianRoarEndTime
					if deadline.Before(start.Add(want)) || deadline.After(end.Add(want)) {
						t.Errorf("duration=%v..%v want=%v", deadline.Sub(end), deadline.Sub(start), want)
					}
					if !allies[0].GuardianRoarEndTime.Equal(deadline) || !allies[0].GuardianRoarActive {
						t.Error("nearby recipient did not inherit caster duration")
					}
					if allies[1].GuardianRoarActive || allies[2].GuardianRoarActive {
						t.Error("mastery expanded range or instance scope")
					}
					if p.Defense != int(float64(defense)*1.2) || allies[0].Defense != int(float64(allyDefense)*1.2) {
						t.Error("protective stats must apply immediately to caster and ally at unchanged strength")
					}
					if enemy.Health != health {
						t.Error("duration mastery introduced damage")
					}
					if math.Abs(p.Cooldowns["Guardian Roar"].Sub(start).Seconds()-30*(1-p.CooldownReduction)) > .1 {
						t.Error("mastery changed cooldown")
					}
					p.TalentRanks = map[string]int{"FTR_36": 5}
					p.RecalculateStats()
					if !p.GuardianRoarEndTime.Equal(deadline) || !allies[0].GuardianRoarEndTime.Equal(deadline) {
						t.Error("later training rewrote an existing cast")
					}
					for _, actor := range []*Entity{p, allies[0]} {
						actor.GuardianRoarEndTime = time.Now().Add(-time.Millisecond)
						w.updateEntity(actor, 0, nil, &deferredActions{})
						if actor.GuardianRoarActive {
							t.Error("expired buff remained active")
						}
					}
					if p.Defense != defense || allies[0].Defense != allyDefense {
						t.Error("expiry did not restore defensive stats")
					}
				})
			}
		}
	}
}

func TestGuardianRoarMasteryPurchaseAndScope(t *testing.T) {
	w, p, _ := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Guardian Roar"}
	p.TalentRanks = nil
	p.recomputeTalentPoints()
	points := p.TalentPoints
	for rank := 1; rank <= 5; rank++ {
		if _, ok, reason := w.PerformUnlockTalent(p.ID, "FTR_09"); !ok {
			t.Fatal(reason)
		}
		if p.TalentRanks["FTR_09"] != rank || p.TalentPoints != points-rank {
			t.Fatal("purchase identity or price changed")
		}
	}
	if _, ok, _ := w.PerformUnlockTalent(p.ID, "FTR_09"); ok || p.TalentPoints != points-5 {
		t.Fatal("sixth rank spent points")
	}
	bonus := p.GetSkillBonus("Guardian Roar")
	if math.Abs(bonus.SkillDuration-.2) > 1e-8 || bonus.SkillDamage != 0 {
		t.Errorf("mastery must supply duration, not phantom damage: %+v", bonus)
	}
	for _, skill := range []string{"Iron Fortress", "Berserker Edge", "Last Stand Rampage", "Charge"} {
		bonus := p.GetSkillBonus(skill)
		if bonus.SkillDuration != 0 || bonus.SkillDamage != 0 {
			t.Errorf("mastery leaked into %s", skill)
		}
	}
	p.Mana = p.MaxMana
	start := time.Now()
	if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Guardian Roar"); !r.Accepted {
		t.Fatal("purchased cast rejected")
	}
	if math.Abs(p.GuardianRoarEndTime.Sub(start).Seconds()-12) > .1 {
		t.Error("purchased ranks did not reach cast")
	}
}
