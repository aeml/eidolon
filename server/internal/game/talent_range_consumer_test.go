package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
)

func TestScorchBeamTalentRangeBoundaries(t *testing.T) {
	data, err := os.ReadFile("testdata/beam_talent_range.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name  string         `json:"name"`
		Ranks map[string]int `json:"ranks"`
		Range float64        `json:"range"`
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		for _, scale := range []float64{1, 4} {
			for _, outside := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/scale=%v/outside=%v", tc.Name, scale, outside), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("range-beam-caster", "Wizard")
					p.Level, p.TalentRanks = 100, tc.Ranks
					p.X, p.Z = 60000, 60000
					p.UnlockedSkills = []string{"Scorch Beam"}
					w.AddEntity(p)
					target := &Entity{ID: "beam-edge-target", Type: TypeEnemy, Scale: scale,
						Health: 10000, MaxHealth: 10000, State: "IDLE", Z: p.Z}
					delta := -0.01
					if outside {
						delta = 0.01
					}
					target.X = p.X + tc.Range + entityVisualRadius(target) + delta
					w.AddEntity(target)
					var event *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if value, ok := payload.(AbilityEvent); kind == "ability" && ok {
							event = &value
						}
					}
					mana := p.Mana
					result := w.PerformAbility(p.ID, p.X+1, p.Z, "", "Scorch Beam")
					if !result.Accepted || p.Mana >= mana || result.CooldownRemaining <= 0 {
						t.Fatalf("directional cast did not pay/start cooldown: %+v", result)
					}
					if event == nil || math.Abs(event.TargetX-(p.X+tc.Range)) > 1e-8 || event.TargetZ != p.Z {
						t.Fatalf("wrong published endpoint: %+v, range %v", event, tc.Range)
					}
					if outside {
						if target.Health != 10000 || target.ArmorReduction != 0 {
							t.Fatal("beam hit beyond body-padded range")
						}
					} else if target.Health >= 10000 || target.ArmorReduction != 5 {
						t.Fatal("beam failed to hit/melt armor inside body-padded range")
					}
				})
			}
		}
	}
}

func TestTeleportTalentRangeBoundaries(t *testing.T) {
	data, err := os.ReadFile("testdata/talent_range.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name  string         `json:"name"`
		Ranks map[string]int `json:"ranks"`
		Rune  string         `json:"rune"`
		Range float64        `json:"range"`
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		for _, outside := range []bool{false, true} {
			name := tc.Name + "/inside"
			if outside {
				name = tc.Name + "/outside"
			}
			t.Run(name, func(t *testing.T) {
				w := newTestWorld()
				p := newTestPlayer("range-caster", "Wizard")
				p.Level, p.TalentRanks = 100, tc.Ranks
				p.UnlockedSkills = []string{"Teleport"}
				p.SkillRunes = map[string]string{"Teleport": tc.Rune}
				w.AddEntity(p)
				distance := tc.Range - 0.01
				if outside {
					distance = tc.Range + 0.01
				}
				beforeMana := p.Mana
				var event *AbilityEvent
				w.OnEvent = func(kind string, payload interface{}) {
					if value, ok := payload.(AbilityEvent); kind == "ability" && ok {
						event = &value
					}
				}
				result := w.PerformAbility(p.ID, distance, 0, "", "Teleport")
				if result.Accepted == outside {
					t.Fatalf("accepted=%v outside=%v range=%v", result.Accepted, outside, tc.Range)
				}
				if outside {
					if p.X != 0 || p.Z != 0 || p.Mana != beforeMana || len(p.Cooldowns) != 0 || event != nil {
						t.Fatal("rejected cast consumed resources, moved, or emitted an effect")
					}
				} else if math.Abs(p.X-distance) > 1e-8 || p.Mana >= beforeMana || result.CooldownRemaining <= 0 || event == nil || math.Abs(event.TargetX-p.X) > 1e-8 {
					t.Fatalf("accepted cast did not move/pay/publish the exact destination: %+v", result)
				}
			})
		}
	}
}

func TestRankedTeleportPreservesDungeonWallsAndPublishedLanding(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		w := newTestWorld()
		p := newTestPlayer("ranked-dungeon-blink", "Wizard")
		const origin = 60000.0
		p.Level, p.X, p.Z, p.InstanceID = 100, origin+9, origin, "dungeon_ranked_teleport_walls"
		if !w.isDungeonInstance(p.InstanceID) {
			t.Fatal("fixture must exercise dungeon constraints")
		}
		p.TalentRanks["WIZ_35"] = 5
		p.UnlockedSkills = []string{"Teleport"}
		rects := []DungeonWalkRect{{X: origin, Z: origin, Width: 20, Height: 20},
			{X: origin + 30, Z: origin, Width: 20, Height: 20}}
		if doorway {
			rects = append(rects, DungeonWalkRect{X: origin + 15, Z: origin, Width: 12, Height: 6})
		}
		w.storeDungeonInstance(p.InstanceID, &DungeonInstance{ID: p.InstanceID, Layout: DungeonLayout{WalkRects: rects}})
		w.AddEntity(p)
		var event *AbilityEvent
		w.OnEvent = func(kind string, payload interface{}) {
			if value, ok := payload.(AbilityEvent); kind == "ability" && ok {
				event = &value
			}
		}
		result := w.PerformAbility(p.ID, origin+26.9, origin, "", "Teleport")
		want := origin + 10
		if doorway {
			want = origin + 26.9
		}
		if !result.Accepted || math.Abs(p.X-want) > 1e-8 || p.Z != origin || event == nil || math.Abs(event.TargetX-want) > 1e-8 || event.TargetZ != origin {
			t.Fatalf("doorway=%v: cast %+v lands (%v,%v), want (%v,%v); event %+v", doorway, result, p.X, p.Z, want, origin, event)
		}
	}
}

func TestRankedScorchBeamPreservesCoverAndCombatFiltering(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprintf("doorway=%v", doorway), func(t *testing.T) {
			w, p, target := directSkillWallFixture("Wizard", doorway)
			// Extend the receiving room so its far wall does not clip the
			// ranked 21.6m beam; retain the same half-metre gap/doorway.
			rects := []DungeonWalkRect{{X: 50000, Z: 50000, Width: 20, Height: 20},
				{X: 50025.5, Z: 50000, Width: 30, Height: 20}}
			if doorway {
				rects = append(rects, DungeonWalkRect{X: 50010, Z: 50000, Width: 5, Height: 6})
			}
			w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: rects}})
			p.Level, p.TalentRanks["WIZ_35"] = 100, 5
			p.UnlockedSkills = []string{"Scorch Beam"}
			oldX := target.X
			target.X = p.X + 20.5 // Beyond the untrained beam including target padding.
			w.Grid.Update(target, oldX, target.Z)
			misses := []*Entity{
				{ID: "beam-friendly", Type: TypePlayer, X: target.X, Z: target.Z, InstanceID: p.InstanceID},
				{ID: "beam-other-instance", Type: TypeEnemy, X: target.X, Z: target.Z, InstanceID: "dungeon_other"},
				{ID: "beam-side", Type: TypeEnemy, X: target.X, Z: target.Z + 5, InstanceID: p.InstanceID},
				{ID: "beam-behind", Type: TypeEnemy, X: p.X - 1, Z: p.Z, InstanceID: p.InstanceID},
			}
			for _, miss := range misses {
				miss.Health, miss.MaxHealth, miss.State, miss.Scale = 10000, 10000, "IDLE", 1
				w.AddEntity(miss)
			}
			var event *AbilityEvent
			w.OnEvent = func(kind string, payload interface{}) {
				if value, ok := payload.(AbilityEvent); kind == "ability" && ok {
					event = &value
				}
			}
			result := w.PerformAbility(p.ID, p.X+1, p.Z, "", "Scorch Beam")
			wantX := 50010.0
			if doorway {
				wantX = p.X + 21.6
			}
			if !result.Accepted || event == nil || math.Abs(event.TargetX-wantX) > 1e-8 {
				t.Fatalf("wrong accepted beam endpoint: result=%+v event=%+v wantX=%v", result, event, wantX)
			}
			if (target.Health < 10000) != doorway || (target.ArmorReduction == 5) != doorway {
				t.Fatalf("wrong wall/doorway outcome: health=%v armor=%v", target.Health, target.ArmorReduction)
			}
			for _, miss := range misses {
				if miss.Health != 10000 || miss.ArmorReduction != 0 {
					t.Fatalf("invalid target hit: %s", miss.ID)
				}
			}
		})
	}
}
