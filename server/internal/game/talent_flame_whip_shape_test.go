package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
	"time"
)

func TestFlameWhipTalentShape(t *testing.T) {
	data, err := os.ReadFile("testdata/flame_whip_shape.json")
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
				t.Run(fmt.Sprintf("%s/scale=%v/outside=%v", tc.Name, scale, outside), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("whip-caster", "Wizard")
					p.Level, p.TalentRanks, p.X, p.Z = 100, tc.Ranks, 60000, 60000
					p.UnlockedSkills = []string{"Flame Whip"}
					w.AddEntity(p)
					e := &Entity{ID: "whip-edge", Type: TypeEnemy, Scale: scale, Health: 10000, MaxHealth: 10000, State: "IDLE", Z: p.Z}
					e.X = p.X + tc.Radius + entityVisualRadius(e) - .01
					if outside {
						e.X += .02
					}
					w.AddEntity(e)
					var published map[string]interface{}
					w.OnEvent = func(kind string, payload interface{}) {
						if kind == "ability" {
							b, _ := json.Marshal(payload)
							_ = json.Unmarshal(b, &published)
						}
					}
					result := w.PerformAbility(p.ID, p.X+1, p.Z, "", "Flame Whip")
					if !result.Accepted {
						t.Fatal(result)
					}
					if (e.Health < e.MaxHealth) != !outside || e.Stunned != !outside {
						t.Fatalf("radius %v outside=%v health=%v stunned=%v", tc.Radius, outside, e.Health, e.Stunned)
					}
					radius, _ := published["radius"].(float64)
					arc, _ := published["arc"].(float64)
					if math.Abs(radius-tc.Radius) > 1e-8 || math.Abs(arc-math.Pi/2) > 1e-8 {
						t.Fatalf("missing resolved shape: %+v", published)
					}
				})
			}
		}
	}
}

func TestFlameWhipNovaCascadeAndCover(t *testing.T) {
	for _, combo := range []bool{false, true} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("combo=%v/doorway=%v", combo, doorway), func(t *testing.T) {
				w, p, front := directSkillWallFixture("Wizard", doorway)
				p.Level, p.TalentRanks = 100, map[string]int{"WIZ_35": 5, "WIZ_36": 5}
				p.UnlockedSkills = []string{"Teleport", "Flame Whip"}
				if combo {
					if r := w.PerformAbility(p.ID, p.X, p.Z, "", "Teleport"); !r.Accepted {
						t.Fatal(r)
					}
					// Advance only the fixture's GCD clock; combo comes from real dispatch.
					p.LastAbilityTime = time.Now().Add(-time.Second)
				}
				back := &Entity{ID: "whip-behind", Type: TypeEnemy, InstanceID: p.InstanceID, X: p.X - 5, Z: p.Z, State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: 1}
				w.AddEntity(back)
				var published map[string]interface{}
				w.OnEvent = func(kind string, payload interface{}) {
					if kind == "ability" {
						b, _ := json.Marshal(payload)
						_ = json.Unmarshal(b, &published)
					}
				}
				if r := w.PerformAbility(p.ID, p.X+1, p.Z, "", "Flame Whip"); !r.Accepted {
					t.Fatal(r)
				}
				if front.Stunned != doorway || back.Stunned != combo {
					t.Fatalf("front=%v back=%v", front.Stunned, back.Stunned)
				}
				wantArc := math.Pi / 2
				if combo {
					wantArc = 2 * math.Pi
				}
				arc, _ := published["arc"].(float64)
				if math.Abs(arc-wantArc) > 1e-8 {
					t.Fatalf("wrong combo shape %+v", published)
				}
			})
		}
	}
}

func TestFlameWhipRetainsAngleAndTargetRules(t *testing.T) {
	for _, mode := range []string{"inside-angle", "outside-angle", "friendly", "dead", "other-instance", "cc-immune"} {
		t.Run(mode, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("whip-rules-caster", "Wizard")
			p.Level, p.X, p.Z = 100, 60000, 60000
			p.TalentRanks = map[string]int{"WIZ_35": 5, "WIZ_36": 5}
			p.UnlockedSkills = []string{"Flame Whip"}
			w.AddEntity(p)
			heading := .3
			angle := heading + math.Pi/4 - .001
			if mode == "outside-angle" {
				angle += .002
			}
			e := &Entity{ID: "whip-rules-target", Type: TypeEnemy, X: p.X + 10*math.Cos(angle), Z: p.Z + 10*math.Sin(angle),
				State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: 4}
			switch mode {
			case "friendly":
				e.Type = TypePlayer
			case "dead":
				e.State = "DEAD"
			case "other-instance":
				e.InstanceID = "dungeon_other_whip"
			case "cc-immune":
				e.CCImmune = true
			}
			w.AddEntity(e)
			if r := w.PerformAbility(p.ID, p.X+math.Cos(heading), p.Z+math.Sin(heading), "", "Flame Whip"); !r.Accepted {
				t.Fatal(r)
			}
			wantHit := mode == "inside-angle" || mode == "cc-immune"
			if (e.Health < e.MaxHealth) != wantHit || e.Stunned != (mode == "inside-angle") {
				t.Fatalf("%s: health=%d stunned=%v", mode, e.Health, e.Stunned)
			}
		})
	}
}
