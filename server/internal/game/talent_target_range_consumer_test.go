package game

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

func TestTalentTargetRangeBoundaries(t *testing.T) {
	data, err := os.ReadFile("testdata/target_talent_range.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name  string         `json:"name"`
		Class string         `json:"class"`
		Skill string         `json:"skill"`
		Ranks map[string]int `json:"ranks"`
		Range float64        `json:"range"`
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		for _, explicit := range []bool{false, true} {
			for _, outside := range []bool{false, true} {
				for _, scale := range []float64{1, 4} {
					t.Run(fmt.Sprintf("%s/explicit=%v/outside=%v/scale=%v", tc.Name, explicit, outside, scale), func(t *testing.T) {
						w := newTestWorld()
						p := newTestPlayer("talent-target-caster", tc.Class)
						p.Level, p.TalentRanks = 100, tc.Ranks
						p.X, p.Z = 60000, 60000
						p.UnlockedSkills = []string{tc.Skill}
						w.AddEntity(p)
						target := &Entity{ID: "talent-target", Type: TypeEnemy, Scale: scale, Z: p.Z,
							Health: 10000, MaxHealth: 10000, State: "IDLE"}
						delta := -0.01
						if outside {
							delta = 0.01
						}
						target.X = p.X + tc.Range + entityVisualRadius(target) + delta
						w.AddEntity(target)
						id := ""
						if explicit {
							id = target.ID
						}
						mana := p.Mana
						var event *AbilityEvent
						w.OnEvent = func(kind string, payload interface{}) {
							if value, ok := payload.(AbilityEvent); kind == "ability" && ok {
								event = &value
							}
						}
						result := w.PerformAbility(p.ID, target.X, target.Z, id, tc.Skill)
						if tc.Skill == "Weak Point Mark" && outside {
							if result.Accepted || p.Mana != mana || result.CooldownRemaining != 0 || event != nil || target.WeakPointMarked {
								t.Fatalf("out-of-range mark was not free rejection: %+v", result)
							}
							return
						}
						if !result.Accepted || p.Mana >= mana || result.CooldownRemaining <= 0 || event == nil {
							t.Fatalf("cast not accepted/paid/published: %+v", result)
						}
						wantTarget := target.ID
						if outside {
							wantTarget = ""
						}
						if event.TargetID != wantTarget {
							t.Fatalf("event target=%q want=%q", event.TargetID, wantTarget)
						}
						if tc.Skill == "Weak Point Mark" {
							if !target.WeakPointMarked {
								t.Fatal("inside target did not receive mark")
							}
						} else {
							count := 0
							for _, entity := range w.Entities {
								if entity.Type == TypeProjectile && entity.OwnerID == p.ID {
									count++
									if entity.TargetID != wantTarget {
										t.Fatalf("projectile retained wrong homing target: %q", entity.TargetID)
									}
								}
							}
							if count != 3 {
								t.Fatalf("volley lost projectiles: %d", count)
							}
						}
					})
				}
			}
		}
	}
}

func TestRankedTargetAbilitiesKeepCoverAndRelationships(t *testing.T) {
	for _, spec := range []struct {
		class, skill, talent string
		distance             float64
	}{
		{"Wizard", "Arcane Missiles", "WIZ_35", 20.5},
		{"Rogue", "Weak Point Mark", "ROG_36", 11.5},
	} {
		for _, mode := range []string{"doorway", "wall", "friendly", "other-instance", "dead"} {
			for _, explicit := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/%s/explicit=%v", spec.skill, mode, explicit), func(t *testing.T) {
					w, p, target := directSkillWallFixture(spec.class, mode != "wall")
					p.Level, p.TalentRanks[spec.talent] = 100, 5
					p.UnlockedSkills = []string{spec.skill}
					oldX := target.X
					target.X = p.X + spec.distance
					w.Grid.Update(target, oldX, target.Z)
					switch mode {
					case "friendly":
						target.Type = TypePlayer
					case "other-instance":
						w.Grid.Remove(target)
						target.InstanceID = "dungeon_target_elsewhere"
						w.Grid.Add(target)
					case "dead":
						target.State = "DEAD"
					}
					id := ""
					if explicit {
						id = target.ID
					}
					mana := p.Mana
					result := w.PerformAbility(p.ID, target.X, target.Z, id, spec.skill)
					valid := mode == "doorway"
					if spec.class == "Rogue" {
						if result.Accepted != valid || target.WeakPointMarked != valid {
							t.Fatalf("wrong mark outcome: %+v", result)
						}
						if !valid && (p.Mana != mana || result.CooldownRemaining != 0) {
							t.Fatal("invalid mark spent resources")
						}
						return
					}
					if !result.Accepted {
						t.Fatal("unguided volley must still launch")
					}
					count := 0
					for _, projectile := range w.Entities {
						if projectile.Type != TypeProjectile || projectile.OwnerID != p.ID {
							continue
						}
						count++
						want := ""
						if valid {
							want = target.ID
						}
						if projectile.TargetID != want {
							t.Fatalf("invalid homing target: %q", projectile.TargetID)
						}
						for step := 0; step < 30; step++ {
							deferred := &deferredActions{}
							w.updateEntity(projectile, .05, nil, deferred)
							if len(deferred.removals) > 0 {
								break
							}
						}
					}
					if count != 3 {
						t.Fatalf("wrong volley size: %d", count)
					}
					if (target.Health < 10000) != valid {
						t.Fatalf("wrong actual impact outcome: %s health=%d", mode, target.Health)
					}
				})
			}
		}
	}
}
