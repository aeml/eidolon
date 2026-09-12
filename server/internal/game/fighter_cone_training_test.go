package game

import (
	"fmt"
	"maps"
	"math"
	"testing"
)

func TestFighterConePaidAreaTraining(t *testing.T) {
	for _, skill := range []struct {
		name, technique string
		radius, arc     float64
		mana            int
	}{
		{"Shield Slam", "FTR_06", 4, math.Pi / 2, 25},
		{"Sweeping Strike", "FTR_12", 5, math.Pi, 30},
	} {
		for _, rank := range []int{0, 1, 5} {
			for _, generic := range []int{0, 5} {
				t.Run(fmt.Sprintf("%s/rank%d/generic%d", skill.name, rank, generic), func(t *testing.T) {
					w, p, edge := directSkillWallFixture("Fighter", true)
					defer w.StopBackground()
					p.Level, p.UnlockedSkills = 100, []string{skill.name}
					p.BaseStats = InitialPlayerStats()
					p.TalentRanks = map[string]int{skill.technique: rank, "FTR_33": generic, "FTR_38": generic}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					radius := skill.radius * (1 + .02*float64(rank) + .05*float64(generic))
					oldX, oldZ := edge.X, edge.Z
					edge.X, edge.Z, edge.Radius = p.X, p.Z+radius+.5-.001, .5
					w.Grid.Update(edge, oldX, oldZ)
					outside := &Entity{ID: "cone-outside", Type: TypeEnemy, InstanceID: p.InstanceID, X: p.X, Z: p.Z + radius + .5 + .001,
						Radius: .5, State: "IDLE", Health: 10000, MaxHealth: 10000}
					behind := &Entity{ID: "cone-behind", Type: TypeEnemy, InstanceID: p.InstanceID, X: p.X, Z: p.Z - 1,
						Radius: .5, State: "IDLE", Health: 10000, MaxHealth: 10000}
					center := &Entity{ID: "cone-center", Type: TypeEnemy, InstanceID: p.InstanceID, X: p.X, Z: p.Z + 1,
						Radius: .5, State: "IDLE", Health: 10000, MaxHealth: 10000}
					for _, e := range []*Entity{outside, behind, center} {
						w.AddEntity(e)
					}
					var accepted *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if e, ok := payload.(AbilityEvent); kind == "ability" && ok {
							accepted = &e
						}
					}
					mana := p.Mana
					result := w.PerformAbility(p.ID, p.X, p.Z+10, "", skill.name)
					if !result.Accepted || p.Mana != mana-skill.mana || center.Health >= 10000 {
						t.Fatalf("paid positive control failed: %+v beforeMana=%d center=%d damage=%d strength=%d", result, mana, center.Health, p.Damage, p.Stats.Strength)
					}
					if edge.Health >= 10000 || outside.Health != 10000 || behind.Health != 10000 {
						t.Errorf("area %.3f edge=%d outside=%d behind=%d", radius, edge.Health, outside.Health, behind.Health)
					}
					if accepted == nil || math.Abs(accepted.Radius-radius) > 1e-8 || accepted.Arc != skill.arc {
						t.Errorf("accepted cone omitted trained shape: %+v", accepted)
					}
				})
			}
		}
	}
}

func TestSweepingStrikePaidDamageTraining(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, generic := range []int{0, 5} {
			t.Run(fmt.Sprintf("rank%d/generic%d", rank, generic), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Fighter", true)
				defer w.StopBackground()
				p.Level, p.UnlockedSkills = 100, []string{"Sweeping Strike"}
				p.TalentRanks = map[string]int{"FTR_11": rank, "FTR_38": generic}
				p.RecalculateStats()
				p.Mana = p.MaxMana
				p.Damage, p.Stats.Strength = 50, 10
				before := target.Health
				if !w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Sweeping Strike").Accepted {
					t.Fatal("cast rejected")
				}
				want := int(math.Floor(62*(1+.04*float64(rank)+.02*float64(generic)) + 1e-9))
				if before-target.Health != want || target.Threat[p.ID] != float64(want)*2 {
					t.Errorf("damage=%d threat=%v want=%d", before-target.Health, target.Threat[p.ID], want)
				}
			})
		}
	}
}

func TestFighterConeTrainedWallAndDoorway(t *testing.T) {
	for _, skill := range []string{"Shield Slam", "Sweeping Strike"} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/doorway%v", skill, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Fighter", doorway)
				defer w.StopBackground()
				p.Level, p.UnlockedSkills = 100, []string{skill}
				p.TalentRanks = map[string]int{"FTR_06": 5, "FTR_12": 5, "FTR_33": 5, "FTR_38": 5}
				before := target.Health
				if !w.PerformAbility(p.ID, target.X, target.Z, "", skill).Accepted {
					t.Fatal("cast rejected")
				}
				if (target.Health < before) != doorway {
					t.Fatalf("wrong wall admission: hp=%d before=%d", target.Health, before)
				}
			})
		}
	}
}

func TestFighterConeOrdinaryPurchasesPreserveRankCosts(t *testing.T) {
	for _, skill := range []struct {
		name, talent string
		radius       float64
	}{
		{"Shield Slam", "FTR_06", 4.4}, {"Sweeping Strike", "FTR_12", 5.5},
	} {
		t.Run(skill.name, func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", true)
			defer w.StopBackground()
			p.Level, p.UnlockedSkills = 100, []string{skill.name}
			p.TalentRanks = nil
			p.recomputeTalentPoints()
			points := p.TalentPoints
			for rank := 1; rank <= 5; rank++ {
				if _, ok, reason := w.PerformUnlockTalent(p.ID, skill.talent); !ok {
					t.Fatalf("purchase %d: %s", rank, reason)
				}
				if p.TalentRanks[skill.talent] != rank || p.TalentPoints != points-rank {
					t.Fatal("rank identity or point cost changed")
				}
			}
			if _, ok, _ := w.PerformUnlockTalent(p.ID, skill.talent); ok || p.TalentPoints != points-5 {
				t.Fatal("sixth rank spent points")
			}
			var event *AbilityEvent
			w.OnEvent = func(kind string, payload interface{}) {
				if e, ok := payload.(AbilityEvent); kind == "ability" && ok {
					event = &e
				}
			}
			p.Mana = p.MaxMana
			if !w.PerformAbility(p.ID, target.X, target.Z, "", skill.name).Accepted {
				t.Fatal("trained cast rejected")
			}
			if event == nil || math.Abs(event.Radius-skill.radius) > 1e-8 {
				t.Fatalf("purchased radius lost: %+v", event)
			}
		})
	}
}

func TestSweepingStrikeLegacyTrainingPreservesCapsAndSavedRanks(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Sweeping Strike"}
	p.TalentRanks = map[string]int{"FTR_11": 999, "FTR_12": -1, "FTR_38": 5, "CLR_11": 5, "invalid": 999}
	p.RecalculateStats()
	p.Damage, p.Stats.Strength = 50, 10
	p.Mana = p.MaxMana
	ranks, health := maps.Clone(p.TalentRanks), target.Health
	if !w.PerformAbility(p.ID, target.X, target.Z, "", "Sweeping Strike").Accepted {
		t.Fatal("legacy cast rejected")
	}
	if health-target.Health != 80 {
		t.Fatalf("rank cap or foreign-rank filter lost: damage=%d", health-target.Health)
	}
	if !maps.Equal(p.TalentRanks, ranks) {
		t.Fatal("cast mutated saved build")
	}
}
