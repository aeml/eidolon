package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestDeathSpiralPurchasedAreaAndBleedBoundary(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, scale := range []float64{1, 4} {
			for _, outside := range []bool{false, true} {
				t.Run(fmt.Sprintf("rank%d/body%v/outside%v", rank, scale, outside), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("spiral-source", "Rogue")
					p.Level, p.InstanceID, p.X, p.Y, p.Z = 100, "spiral-room", 60000, 40, 60000
					p.UnlockedSkills = []string{"Death Spiral"}
					w.AddEntity(p)
					if _, ok := w.SetPlayerLevel(p.ID, 100); !ok {
						t.Fatal("could not prepare ordinary level stats")
					}
					points := p.TalentPoints
					for i := 0; i < rank; i++ {
						if _, ok, reason := w.PerformUnlockTalent(p.ID, "ROG_34"); !ok {
							t.Fatal(reason)
						}
					}
					if p.TalentRanks["ROG_34"] != rank || p.TalentPoints != points-rank {
						t.Fatal("invalid purchase accounting")
					}
					p.Mana = p.MaxMana
					if p.Damage <= 0 {
						t.Fatal("fixture must retain positive ordinary attack damage after training")
					}
					radius := 4 * (1 + .03*float64(rank))
					target := &Entity{ID: "spiral-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
						InstanceID: p.InstanceID, X: p.X + radius + 1.25*scale - .01, Z: p.Z, Scale: scale,
						Health: 10000, MaxHealth: 10000, Bleeding: true, BleedDamage: 5, BleedEndTime: time.Now().Add(time.Minute)}
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
					if result := w.PerformAbility(p.ID, p.X+100, p.Z+100, "", "Death Spiral"); !result.Accepted || p.Mana != mana-35 {
						t.Fatalf("unpaid/rejected cast: %+v", result)
					}
					if (target.Health < 10000) != !outside || target.Bleeding != outside {
						t.Fatal("incorrect damage/bleed admission")
					}
					if cast == nil || math.Abs(cast.Radius-radius) > 1e-8 || math.Abs(cast.Arc-2*math.Pi) > 1e-8 || cast.TargetX != p.X || cast.TargetZ != p.Z {
						t.Fatalf("incorrect accepted circle: %+v", cast)
					}
				})
			}
		}
	}
}
