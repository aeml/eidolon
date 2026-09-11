package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
)

func TestTimeWarpTrainedAreaAndAcceptedShape(t *testing.T) {
	data, err := os.ReadFile("testdata/time_warp_area.json")
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
					p := newTestPlayer("warp-source", "Wizard")
					p.Level, p.InstanceID, p.X, p.Y, p.Z = 100, "warp-area", 60000, 40, 60000
					p.TalentRanks, p.UnlockedSkills = tc.Ranks, []string{"Time Warp"}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					w.AddEntity(p)
					ally := newTestPlayer("warp-ally", "Cleric")
					ally.InstanceID, ally.Scale, ally.X, ally.Z = p.InstanceID, scale, p.X+tc.Radius+1.25*scale-.01, p.Z
					if outside {
						ally.X += .02
					}
					w.AddEntity(ally)
					mana, speed := p.Mana, ally.Speed
					var cast *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if event, ok := payload.(AbilityEvent); kind == "ability" && ok {
							cast = &event
						}
					}
					result := w.PerformAbility(p.ID, p.X+100, p.Z+100, "", "Time Warp")
					if !result.Accepted || p.Mana != mana-50 || !p.TimeWarpActive {
						t.Fatalf("paid/self cast failed: %+v", result)
					}
					if ally.TimeWarpActive != !outside || (ally.Speed > speed) != !outside {
						t.Fatalf("buff=%v outside=%v", ally.TimeWarpActive, outside)
					}
					if !outside && !ally.TimeWarpEndTime.Equal(p.TimeWarpEndTime) {
						t.Fatal("ally lost shared deadline")
					}
					if cast == nil || math.Abs(cast.Radius-tc.Radius) > 1e-8 || cast.Arc != 2*math.Pi || cast.TargetX != p.X || cast.TargetZ != p.Z {
						t.Fatalf("wrong accepted shape: %+v", cast)
					}
				})
			}
		}
	}
}

func TestTimeWarpAreaPreservesZoneSetAndRelationships(t *testing.T) {
	for _, pieces := range []int{0, 5, 6} {
		t.Run(fmt.Sprintf("set-pieces%d", pieces), func(t *testing.T) {
			zone := pieces == 6
			w, p, enemy := directSkillWallFixture("Wizard", false)
			defer w.StopBackground()
			p.Level, p.TalentRanks, p.UnlockedSkills = 100, map[string]int{"WIZ_36": 5, "WIZ_38": 5}, []string{"Time Warp"}
			p.Equipment = make(map[string]Item)
			for _, slot := range []string{"head", "chest", "legs", "feet", "gloves", "shoulders"}[:pieces] {
				p.Equipment[slot] = Item{ID: "warp-" + slot, Slot: slot, SetID: "temporal_weave", Level: 100}
			}
			p.RecalculateStats()
			p.Mana = p.MaxMana
			if p.HasAnySetBonus("timeWarpZone") != zone {
				t.Fatal("invalid equipped-set fixture")
			}
			for _, id := range []string{"ally", "npc", "far", "dead", "other-instance", "opponent"} {
				ally := newTestPlayer(id, "Cleric")
				ally.InstanceID, ally.X, ally.Z = p.InstanceID, enemy.X, enemy.Z
				if id == "npc" {
					ally.Type = TypeNPC
				}
				if id == "far" {
					ally.X += 500
				}
				if id == "dead" {
					ally.State = "DEAD"
				}
				if id == "other-instance" {
					ally.InstanceID = "other-warp"
				}
				w.AddEntity(ally)
			}
			w.PvP.Matches["warp-pvp"] = &PvPMatch{ID: "warp-pvp", Status: PvPMatchActive, TeamA: []string{p.ID}, TeamB: []string{"opponent"}}
			w.PvP.MatchByPlayer[p.ID], w.PvP.MatchByPlayer["opponent"] = "warp-pvp", "warp-pvp"
			if !w.PerformAbility(p.ID, p.X, p.Z, "", "Time Warp").Accepted {
				t.Fatal("warp rejected")
			}
			for _, id := range []string{"ally", "npc"} {
				if !w.GetEntity(id).TimeWarpActive {
					t.Errorf("friendly support blocked by wall: %s", id)
				}
			}
			if w.GetEntity("far").TimeWarpActive != zone {
				t.Fatal("changed zone-wide set effect")
			}
			if p.HasAnySetBonus("timeWarpZone") != zone {
				t.Fatal("cast changed equipped-set bonus")
			}
			for _, id := range []string{"dead", "other-instance", "opponent", enemy.ID} {
				if w.GetEntity(id).TimeWarpActive {
					t.Errorf("buffed excluded %s", id)
				}
			}
		})
	}
}
