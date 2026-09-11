package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
	"time"
)

func TestExecutionerSpinTrainedAreaAndAcceptedShape(t *testing.T) {
	data, err := os.ReadFile("testdata/executioner_spin_area.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name   string
		Ranks  map[string]int
		Radius float64
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		for _, scale := range []float64{1, 4} {
			for _, outside := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/body%v/outside%v", tc.Name, scale, outside), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("spin-caster", "Fighter")
					p.Level, p.InstanceID, p.X, p.Z = 100, "spin-area", 60000, 60000
					p.BaseStats = InitialPlayerStats()
					p.TalentRanks, p.UnlockedSkills = tc.Ranks, []string{"Executioner Spin"}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					w.AddEntity(p)
					target := &Entity{ID: "spin-enemy", Type: TypeEnemy, InstanceID: p.InstanceID, State: "IDLE", Health: 10000, MaxHealth: 10000,
						Scale: scale, X: p.X + tc.Radius + 1.25*scale - .01, Z: p.Z}
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
					result := w.PerformAbility(p.ID, p.X+100, p.Z+100, "", "Executioner Spin")
					if !result.Accepted || p.Mana != mana-40 {
						t.Fatalf("paid spin failed: %+v", result)
					}
					if (target.Health < 10000) != !outside {
						t.Fatalf("target HP=%d outside=%v", target.Health, outside)
					}
					if cast == nil || math.Abs(cast.Radius-tc.Radius) > 1e-8 || cast.Arc != 2*math.Pi || cast.TargetX != p.X || cast.TargetZ != p.Z {
						t.Fatalf("wrong accepted shape: %+v", cast)
					}
				})
			}
		}
	}
}

func TestExecutionerSpinPurchasedTechniquePreservesCostAndCooldown(t *testing.T) {
	for rank := 0; rank <= 5; rank++ {
		t.Run(fmt.Sprintf("rank%d", rank), func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			p := newTestPlayer("spin-purchaser", "Fighter")
			p.Level, p.InstanceID, p.BaseStats, p.UnlockedSkills = 100, "spin-purchase", InitialPlayerStats(), []string{"Executioner Spin"}
			p.RecalculateStats()
			w.AddEntity(p)
			for spent := 0; spent < rank; spent++ {
				if _, ok, reason := w.PerformUnlockTalent(p.ID, "FTR_24"); !ok {
					t.Fatal(reason)
				}
			}
			p.recomputeTalentPoints()
			p.Mana = p.MaxMana
			if p.TalentRanks["FTR_24"] != rank || p.TalentPoints != 20-rank {
				t.Fatal("lost talent investment")
			}
			target := &Entity{ID: "spin-purchase-enemy", Type: TypeEnemy, InstanceID: p.InstanceID, State: "IDLE", Health: 10000, MaxHealth: 10000, X: 7.55, Scale: 1}
			w.AddEntity(target)
			mana := p.Mana
			result := w.PerformAbility(p.ID, 0, 0, "", "Executioner Spin")
			if !result.Accepted || p.Mana != mana-40 || (target.Health < 10000) != (rank >= 3) {
				t.Fatalf("rank%d result=%+v targetHP=%d", rank, result, target.Health)
			}
			want := 15 * (1 - p.CooldownReduction) * (1 - .03*float64(rank))
			remaining := time.Until(p.Cooldowns["Executioner Spin"]).Seconds()
			if remaining > want+.01 || remaining < want-.25 {
				t.Fatalf("CD=%v want=%v", remaining, want)
			}
		})
	}
}

func TestExecutionerSpinTrainedAreaRetainsWallsAndExclusions(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprintf("doorway%v", doorway), func(t *testing.T) {
			w, p, enemy := directSkillWallFixture("Fighter", doorway)
			defer w.StopBackground()
			p.Level, p.TalentRanks, p.UnlockedSkills = 100, map[string]int{"FTR_33": 5}, []string{"Executioner Spin"}
			p.BaseStats = InitialPlayerStats()
			p.RecalculateStats()
			p.Mana = p.MaxMana
			before := enemy.Health
			for _, id := range []string{"ally", "dead", "other-instance"} {
				actor := newTestPlayer(id, "Cleric")
				actor.InstanceID, actor.X, actor.Z = p.InstanceID, enemy.X, enemy.Z
				actor.Health, actor.MaxHealth = 10000, 10000
				if id == "dead" {
					actor.Type, actor.State = TypeEnemy, "DEAD"
				}
				if id == "other-instance" {
					actor.Type, actor.InstanceID = TypeEnemy, "other-spin"
				}
				w.AddEntity(actor)
			}
			if !w.PerformAbility(p.ID, p.X, p.Z, "", "Executioner Spin").Accepted {
				t.Fatal("spin rejected")
			}
			if (enemy.Health < before) != doorway {
				t.Fatalf("damage crossed wall: before=%d after=%d", before, enemy.Health)
			}
			for _, id := range []string{"ally", "dead", "other-instance"} {
				if w.GetEntity(id).Health != 10000 {
					t.Errorf("damaged excluded %s", id)
				}
			}
		})
	}
}

func TestExecutionerSpinPreservesDamageAndMarkedThreatBonus(t *testing.T) {
	for _, status := range []string{"none", "weak-point", "weakness", "threat"} {
		t.Run(status, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			p := newTestPlayer("spin-damage", "Fighter")
			p.Level, p.InstanceID, p.BaseStats = 100, "spin-damage", InitialPlayerStats()
			p.UnlockedSkills, p.TalentRanks = []string{"Executioner Spin"}, map[string]int{"FTR_23": 5, "FTR_38": 5}
			p.RecalculateStats()
			p.Mana, p.Damage, p.CritChanceBonus = p.MaxMana, 100, 0
			w.AddEntity(p)
			target := &Entity{ID: "spin-damage-enemy", Type: TypeEnemy, InstanceID: p.InstanceID, State: "IDLE", Health: 10000, MaxHealth: 10000, X: 2}
			switch status {
			case "weak-point":
				target.WeakPointMarked = true
			case "weakness":
				target.MarkWeakness = true
				target.MarkWeaknessFactor = .2
			case "threat":
				target.Threat = map[string]float64{p.ID: 10}
			}
			w.AddEntity(target)
			base := int((100 + float64(p.Stats.Strength)*3) * 1.3 * (1 + .04*5 + .02*5))
			want := base
			if status != "none" {
				want = int(float64(want) * 1.5)
			}
			if status == "weakness" {
				want = int(float64(want) * 1.2)
			} // Existing receiving debuff remains separate.
			if !w.PerformAbility(p.ID, 0, 0, "", "Executioner Spin").Accepted {
				t.Fatal("spin rejected")
			}
			if 10000-target.Health != want {
				t.Fatalf("damage=%d want=%d", 10000-target.Health, want)
			}
		})
	}
}
