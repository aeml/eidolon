package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
)

func TestGuardianRoarTrainedAreaAndAcceptedShape(t *testing.T) {
	data, err := os.ReadFile("testdata/guardian_roar_area.json")
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
					p := newTestPlayer("roar-caster", "Fighter")
					p.Level, p.InstanceID, p.X, p.Y, p.Z = 100, "roar-area", 60000, 40, 60000
					p.TalentRanks, p.UnlockedSkills = tc.Ranks, []string{"Guardian Roar"}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					w.AddEntity(p)
					ally := newTestPlayer("roar-ally", "Cleric")
					ally.Equipment["chest"] = Item{Stats: map[string]int{"defense": 100}}
					ally.RecalculateStats()
					ally.InstanceID, ally.Scale, ally.X, ally.Z = p.InstanceID, scale, p.X+tc.Radius+1.25*scale-.01, p.Z
					if outside {
						ally.X += .02
					}
					w.AddEntity(ally)
					defense, mana := ally.Defense, p.Mana
					var cast *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if event, ok := payload.(AbilityEvent); kind == "ability" && ok {
							cast = &event
						}
					}
					result := w.PerformAbility(p.ID, p.X+100, p.Z+100, "", "Guardian Roar")
					if !result.Accepted || p.Mana != mana-35 || !p.GuardianRoarActive {
						t.Fatalf("paid/self roar failed: %+v", result)
					}
					if ally.GuardianRoarActive != !outside || (ally.Defense > defense) != !outside {
						t.Fatalf("ally buff=%v defense=%d before=%d outside=%v", ally.GuardianRoarActive, ally.Defense, defense, outside)
					}
					if !outside && !ally.GuardianRoarEndTime.Equal(p.GuardianRoarEndTime) {
						t.Fatal("ally lost shared deadline")
					}
					if cast == nil || math.Abs(cast.Radius-tc.Radius) > 1e-8 || cast.Arc != 2*math.Pi || cast.TargetX != p.X || cast.TargetZ != p.Z {
						t.Fatalf("incorrect accepted cast point/area: %+v", cast)
					}
				})
			}
		}
	}
}

func TestGuardianRoarTrainedTauntBoundaryRetainsBossSetGate(t *testing.T) {
	for _, scale := range []float64{1, 4} {
		for _, withSet := range []bool{false, true} {
			for _, outside := range []bool{false, true} {
				t.Run(fmt.Sprintf("body%v/set%v/outside%v", scale, withSet, outside), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("roar-tank", "Fighter")
					p.Level, p.InstanceID = 30, "roar-taunt"
					p.TalentRanks, p.UnlockedSkills = map[string]int{"FTR_33": 5}, []string{"Guardian Roar"}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					if withSet {
						p.ActiveSetBonuses = map[string]map[string]int{"bulwark": {"bossTaunt": 1}}
					}
					w.AddEntity(p)
					target := &Entity{ID: "roar-enemy", Type: TypeEnemy, InstanceID: p.InstanceID, State: "IDLE", Health: 1000, MaxHealth: 1000,
						Scale: scale, X: 17.25 + 1.25*scale - .01, Threat: map[string]float64{"other": 100}}
					if outside {
						target.X += .02
					}
					w.AddEntity(target)
					if !w.PerformAbility(p.ID, 0, 0, "", "Guardian Roar").Accepted {
						t.Fatal("roar rejected")
					}
					want := !outside && (scale < 4 || withSet)
					if (target.Threat[p.ID] > 100) != want || target.GuardianRoarActive {
						t.Fatalf("taunt=%v buff=%v want=%v", target.Threat[p.ID], target.GuardianRoarActive, want)
					}
				})
			}
		}
	}
}

func TestGuardianRoarTrainedAreaRetainsWallsAndRelationships(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprintf("doorway%v", doorway), func(t *testing.T) {
			w, p, enemy := directSkillWallFixture("Fighter", doorway)
			defer w.StopBackground()
			p.Level, p.TalentRanks, p.UnlockedSkills = 30, map[string]int{"FTR_33": 5}, []string{"Guardian Roar"}
			p.RecalculateStats()
			p.Mana = p.MaxMana
			for _, id := range []string{"ally", "dead", "other-instance", "opponent"} {
				ally := newTestPlayer(id, "Cleric")
				ally.InstanceID, ally.X, ally.Z = p.InstanceID, enemy.X, enemy.Z
				if id == "dead" {
					ally.State = "DEAD"
				}
				if id == "other-instance" {
					ally.InstanceID = "another-roar"
				}
				w.AddEntity(ally)
			}
			w.PvP.Matches["roar-pvp"] = &PvPMatch{ID: "roar-pvp", Status: PvPMatchActive, TeamA: []string{p.ID}, TeamB: []string{"opponent"}}
			w.PvP.MatchByPlayer[p.ID], w.PvP.MatchByPlayer["opponent"] = "roar-pvp", "roar-pvp"
			if !w.PerformAbility(p.ID, p.X, p.Z, "", "Guardian Roar").Accepted {
				t.Fatal("roar rejected")
			}
			if (enemy.Threat[p.ID] > 0) != doorway {
				t.Fatalf("taunt crossed wall: doorway=%v threat=%v", doorway, enemy.Threat[p.ID])
			}
			if !w.GetEntity("ally").GuardianRoarActive {
				t.Fatal("friendly support incorrectly blocked by wall")
			}
			for _, id := range []string{"dead", "other-instance", "opponent"} {
				if w.GetEntity(id).GuardianRoarActive {
					t.Errorf("buffed excluded %s", id)
				}
			}
		})
	}
}
