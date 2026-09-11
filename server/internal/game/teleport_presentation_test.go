package game

import (
	"encoding/json"
	"fmt"
	"math"
	"testing"
)

func TestTeleportPresentationAcceptedEndpointsAndTraining(t *testing.T) {
	for _, runeID := range []string{"", "teleport_blink", "teleport_phase", "teleport_warp"} {
		for _, trained := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/trained%v", runeID, trained), func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("teleport-presentation", "Wizard")
				p.Level, p.InstanceID, p.X, p.Z = 100, "dungeon_teleport_presentation", 60000, 60000
				p.UnlockedSkills, p.SkillRunes = []string{"Teleport"}, map[string]string{"Teleport": runeID}
				if trained {
					p.TalentRanks = map[string]int{"WIZ_36": 5, "WIZ_38": 5}
				}
				w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{
					{X: 60000, Z: 60000, Width: 20, Height: 20},
				}}})
				w.AddEntity(p)
				var events []map[string]any
				w.OnEvent = func(kind string, payload any) {
					if kind != "ability" {
						return
					}
					b, err := json.Marshal(payload)
					if err != nil {
						t.Fatal(err)
					}
					var event map[string]any
					if err := json.Unmarshal(b, &event); err != nil {
						t.Fatal(err)
					}
					events = append(events, event)
				}
				if result := w.PerformAbility(p.ID, 60012, 60000, "", "Teleport"); !result.Accepted {
					t.Fatalf("cast: %+v", result)
				}
				if len(events) != 1 {
					t.Fatalf("events: %+v", events)
				}
				e := events[0]
				origin, ok := e["origin"].(map[string]any)
				if !ok || origin["x"] != float64(60000) || origin["z"] != float64(60000) {
					t.Errorf("lost departure: %+v", e)
				}
				if e["targetX"] != p.X || e["targetZ"] != p.Z || p.X >= 60012 || e["shapeResolved"] != true {
					t.Errorf("unresolved cast: %+v landing%v,%v", e, p.X, p.Z)
				}
				if runeID == "teleport_warp" {
					radius := 4.0
					if trained {
						radius = 5
					}
					if e["radius"] != radius || e["arc"] != 2*math.Pi {
						t.Errorf("wrong Warp shape: %+v", e)
					}
				} else if e["radius"] != nil || e["arc"] != nil {
					t.Errorf("non-Warp damage rings: %+v", e)
				}
				// Cooldown denial must not replay this accepted presentation.
				if result := w.PerformAbility(p.ID, 60005, 60000, "", "Teleport"); result.Accepted || len(events) != 1 {
					t.Fatalf("denied cast emitted effects: %+v %+v", result, events)
				}
			})
		}
	}
}
