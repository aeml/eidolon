package game

import (
	"fmt"
	"math"
	"testing"
)

func TestSmokeBombPurchasedAreaAndAcceptedShape(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, scale := range []float64{1, 4} {
			for _, outside := range []bool{false, true} {
				for _, immune := range []bool{false, true} {
					t.Run(fmt.Sprintf("rank%d/body%v/outside%v/immune%v", rank, scale, outside, immune), func(t *testing.T) {
						w := newTestWorld()
						defer w.StopBackground()
						p := newTestPlayer("smoke-caster", "Rogue")
						p.Level, p.InstanceID, p.X, p.Y, p.Z = 100, "smoke-area", 60000, 40, 60000
						p.UnlockedSkills = []string{"Smoke Bomb"}
						w.AddEntity(p)
						p.recomputeTalentPoints()
						points := p.TalentPoints
						for i := 0; i < rank; i++ {
							if _, ok, reason := w.PerformUnlockTalent(p.ID, "ROG_34"); !ok {
								t.Fatal(reason)
							}
						}
						if p.TalentRanks["ROG_34"] != rank || p.TalentPoints != points-rank {
							t.Fatal("purchase did not consume points")
						}
						p.Mana = p.MaxMana
						radius := 5 * (1 + .03*float64(rank))
						target := newTestPlayer("smoke-target", "Skeleton")
						target.Type, target.InstanceID, target.Scale, target.CCImmune = TypeEnemy, p.InstanceID, scale, immune
						target.X, target.Z = p.X+radius+1.25*scale-.01, p.Z
						if outside {
							target.X += .02
						}
						w.AddEntity(target)
						var cast *AbilityEvent
						w.OnEvent = func(kind string, payload interface{}) {
							if event, ok := payload.(AbilityEvent); kind == "ability" && ok {
								cast = &event
							}
						}
						mana := p.Mana
						result := w.PerformAbility(p.ID, p.X+100, p.Z+100, "", "Smoke Bomb")
						if !result.Accepted || p.Mana != mana-35 {
							t.Fatalf("paid cast failed: %+v", result)
						}
						if (target.AccuracyReduction == .3) != !outside || target.Slowed != (!outside && !immune) {
							t.Fatalf("wrong boundary/control: accuracy=%v slow=%v", target.AccuracyReduction, target.Slowed)
						}
						if cast == nil || math.Abs(cast.Radius-radius) > 1e-8 || math.Abs(cast.Arc-2*math.Pi) > 1e-8 || cast.TargetX != p.X || cast.TargetZ != p.Z {
							t.Fatalf("wrong accepted footprint: %+v", cast)
						}
					})
				}
			}
		}
	}
}

func TestTrainedSmokeBombPreservesWallAndTargetExclusions(t *testing.T) {
	for _, excluded := range []string{"wall", "dead", "other-instance", "friendly"} {
		t.Run(excluded, func(t *testing.T) {
			w, p, target := directSkillWallFixture("Rogue", excluded != "wall")
			defer w.StopBackground()
			p.Level, p.UnlockedSkills, p.TalentRanks = 100, []string{"Smoke Bomb"}, map[string]int{"ROG_34": 5}
			p.RecalculateStats()
			p.Mana = p.MaxMana
			w.Grid.Remove(target)
			if excluded == "dead" {
				target.State = "DEAD"
			}
			if excluded == "other-instance" {
				target.InstanceID = "elsewhere"
			}
			if excluded == "friendly" {
				target.Type, target.SubType = TypePlayer, "Cleric"
			}
			w.Grid.Add(target)
			if !w.PerformAbility(p.ID, target.X, target.Z, "", "Smoke Bomb").Accepted {
				t.Fatal("cast rejected")
			}
			if target.AccuracyReduction != 0 || target.Slowed {
				t.Fatal("excluded target affected")
			}
		})
	}
}
