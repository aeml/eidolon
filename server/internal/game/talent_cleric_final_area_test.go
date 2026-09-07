package game

// Actual cast regressions promoted from the explicit talent audit.

import (
	"encoding/json"
	"fmt"
	"math"
	"testing"
	"time"
)

// Rank-zero controls distinguish the trained annulus from the base area.
func TestClericTrainedConeAndHealingAreas(t *testing.T) {
	for _, variant := range []string{"Radiant Strike", "Beacon", "Mass Revival"} {
		t.Run(variant, func(t *testing.T) {
			for _, rank := range []int{0, 5} {
				w := newTestWorld()
				p := newTestPlayer("probe-area", "Cleric")
				p.InstanceID = "qa-cleric-area-probe"
				p.Level = 100
				p.Stats.Wisdom = 10
				p.TalentRanks["CLR_34"] = rank
				skill, radius := "Healing Light", 5.0
				target := newTestPlayer("probe-target", "Wizard")
				target.InstanceID, target.Radius = p.InstanceID, 1.25
				target.Health = target.MaxHealth / 2
				switch variant {
				case "Radiant Strike":
					skill, radius, target.Type = variant, 3, TypeEnemy
				case "Beacon":
					p.SkillRunes = map[string]string{skill: "healinglight_beacon"}
				case "Mass Revival":
					// Isolate this consumer; normal cross-branch access is not proven.
					p.ActiveCombo = "healing_light_party"
					radius = 20
				}
				p.UnlockedSkills = []string{skill}
				target.X = radius*1.10 + target.Radius
				w.AddEntity(p)
				w.AddEntity(target)
				before := target.Health
				// Self target anchors Beacon; the cone faces +X.
				result := w.PerformAbility(p.ID, target.X, 0, p.ID, skill)
				applied := target.Health > before
				if variant == "Radiant Strike" {
					applied = target.Health < before
				}
				if !result.Accepted || applied != (rank > 0) {
					t.Errorf("rank=%d accepted=%t effectAt%vm=%t; want %t", rank, result.Accepted, target.X, applied, rank > 0)
				}
			}
		})
	}
}

func TestClericFinalAreaBoundariesAndExclusions(t *testing.T) {
	for _, variant := range []string{"Radiant Strike", "Beacon", "Mass Revival"} {
		for _, rank := range []int{0, 1, 5} {
			for _, scale := range []float64{1, 4} {
				t.Run(fmt.Sprintf("%s/rank%d/scale%g", variant, rank, scale), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("caster", "Cleric")
					p.InstanceID, p.X, p.Z = "cleric-boundaries", 60000, 60000
					p.Level, p.Stats.Wisdom = 100, 10
					p.TalentRanks["CLR_34"] = rank
					skill, base := "Healing Light", 5.0
					if variant == "Radiant Strike" {
						skill, base = variant, 3
					} else if variant == "Beacon" {
						p.SkillRunes = map[string]string{skill: "healinglight_beacon"}
					} else {
						base = 20
						p.ActiveCombo = "healing_light_party"
					}
					p.UnlockedSkills = []string{skill}
					w.AddEntity(p)
					radius := base * (1 + .03*float64(rank))
					targets := map[string]*Entity{}
					for _, id := range []string{"inside", "outside", "dead", "other-instance", "wrong-allegiance", "angle-outside"} {
						e := newTestPlayer(id, "Wizard")
						e.InstanceID, e.Scale, e.Health = p.InstanceID, scale, 100
						e.X, e.Z = p.X+radius+1.25*scale-.01, p.Z
						if variant == "Radiant Strike" {
							e.Type = TypeEnemy
						}
						switch id {
						case "outside":
							e.X += .02
						case "dead":
							e.State = "DEAD"
						case "other-instance":
							e.InstanceID = "elsewhere"
						case "wrong-allegiance":
							if variant == "Radiant Strike" {
								e.Type = TypePlayer
							} else {
								e.Type = TypeEnemy
							}
						case "angle-outside":
							e.X, e.Z = p.X, p.Z+radius
						}
						w.AddEntity(e)
						targets[id] = e
					}
					if result := w.PerformAbility(p.ID, p.X+1, p.Z, p.ID, skill); !result.Accepted {
						t.Fatal(result)
					}
					for id, e := range targets {
						want := id == "inside" || (id == "angle-outside" && variant != "Radiant Strike")
						changed := e.Health != 100
						if changed != want {
							t.Errorf("%s affected=%v want=%v (hp=%d)", id, changed, want, e.Health)
						}
					}
				})
			}
		}
	}
}

func TestClericFinalAreaCoverPolicy(t *testing.T) {
	for _, variant := range []string{"Radiant Strike", "Beacon", "Mass Revival"} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/doorway%v", variant, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Cleric", doorway)
				p.TalentRanks["CLR_34"] = 5
				skill := "Healing Light"
				if variant == "Radiant Strike" {
					skill = variant
				} else {
					target.Type, target.SubType, target.Health = TypePlayer, "Wizard", 100
					if variant == "Beacon" {
						p.SkillRunes = map[string]string{skill: "healinglight_beacon"}
					} else {
						p.ActiveCombo = "healing_light_party"
					}
				}
				p.UnlockedSkills = []string{skill}
				before := target.Health
				if result := w.PerformAbility(p.ID, target.X, target.Z, p.ID, skill); !result.Accepted {
					t.Fatal(result)
				}
				want := doorway || variant != "Radiant Strike"
				if (target.Health != before) != want {
					t.Errorf("effect through cover=%v want=%v", target.Health != before, want)
				}
			})
		}
	}
}

func TestClericDirectHealingResolvesTargetAndExplicitEmptyShape(t *testing.T) {
	for _, runeID := range []string{"", "healinglight_renewal", "healinglight_divine"} {
		t.Run(runeID, func(t *testing.T) {
			w := newTestWorld()
			p, ally := newTestPlayer("healer", "Cleric"), newTestPlayer("ally", "Wizard")
			p.InstanceID, ally.InstanceID = "direct-heal-shape", "direct-heal-shape"
			p.X, ally.X, ally.Health = 60000, 60008, 100
			p.UnlockedSkills = []string{"Healing Light"}
			p.SkillRunes = map[string]string{"Healing Light": runeID}
			ally.Stunned, ally.Rooted = true, true
			w.AddEntity(p)
			w.AddEntity(ally)
			var event AbilityEvent
			w.OnEvent = func(kind string, value interface{}) {
				if kind == "ability" {
					event = value.(AbilityEvent)
				}
			}
			if result := w.PerformAbility(p.ID, ally.X+1, ally.Z, ally.ID, "Healing Light"); !result.Accepted {
				t.Fatal(result)
			}
			if !event.ShapeResolved || event.Radius != 0 || event.Arc != 0 || event.TargetID != ally.ID || event.TargetX != ally.X || event.TargetZ != ally.Z {
				t.Fatalf("wrong direct heal shape/target: %+v", event)
			}
			data, err := json.Marshal(event)
			if err != nil {
				t.Fatal(err)
			}
			var wire map[string]interface{}
			if err := json.Unmarshal(data, &wire); err != nil {
				t.Fatal(err)
			}
			if wire["shapeResolved"] != true || wire["radius"] != nil {
				t.Fatalf("ambiguous wire shape: %s", data)
			}
			if ally.Health != 130 {
				t.Errorf("direct heal changed amount: %d", ally.Health)
			}
			if ally.HealingLightHoTActive != (runeID == "healinglight_renewal") {
				t.Error("renewal changed")
			}
			if runeID == "healinglight_divine" && (ally.Stunned || !ally.Rooted) {
				t.Error("cleanse must remove exactly one debuff")
			}
		})
	}
}

// Use normal branch selection and real combo dispatch, rather than granting an
// ActiveCombo flag. Rank-zero effects distinguish accessible combos from broken
// trained geometry; accepted events must describe the actual area as well.
func TestClericAcceptedAreas(t *testing.T) {
	for _, variant := range []string{"Radiant Strike", "Beacon", "Mass Revival"} {
		for _, rank := range []int{0, 1, 5} {
			t.Run(fmt.Sprintf("%s/rank%d", variant, rank), func(t *testing.T) {
				w := newTestWorld()
				p := newTestPlayer("accepted-area-caster", "Cleric")
				p.InstanceID, p.X, p.Z = "qa-accepted-cleric-area", 60000, 60000
				p.Level, p.Stats.Wisdom, p.TalentRanks = 100, 10, map[string]int{"CLR_34": rank}
				w.AddEntity(p)
				skill, branch, base, arc := "Healing Light", "A", 5.0, 2*math.Pi
				anchorX, anchorZ, targetID := p.X, p.Z, p.ID
				if variant == "Radiant Strike" {
					skill, branch, base, arc, targetID = variant, "B", 3, 2*math.Pi/3, ""
				} else if variant == "Beacon" {
					p.SkillRunes = map[string]string{skill: "healinglight_beacon"}
					primary := newTestPlayer("beacon-primary", "Wizard")
					primary.InstanceID, primary.X, primary.Z = p.InstanceID, p.X+8, p.Z
					w.AddEntity(primary)
					anchorX, anchorZ, targetID = primary.X, primary.Z, primary.ID
				} else {
					base = 20
				}
				if _, ok := w.PerformSelectBranch(p.ID, branch); !ok {
					t.Fatal("normal branch selection rejected")
				}
				radius := base * (1 + .03*float64(rank))
				edge := newTestPlayer("accepted-area-edge", "Wizard")
				edge.InstanceID, edge.X, edge.Z = p.InstanceID, anchorX+radius+1.25-.01, anchorZ
				edge.Health = edge.MaxHealth / 2
				if variant == "Radiant Strike" {
					edge.Type = TypeEnemy
				}
				w.AddEntity(edge)
				if variant == "Mass Revival" {
					if !w.PerformAbility(p.ID, p.X, p.Z, p.ID, "Divine Intervention").Accepted {
						t.Fatal("normal combo opener rejected")
					}
					// Only advance the fixture's GCD clock; normal dispatch detects the combo.
					p.LastAbilityTime = time.Now().Add(-time.Second)
				}
				var event *AbilityEvent
				w.OnEvent = func(kind string, payload interface{}) {
					if value, ok := payload.(AbilityEvent); kind == "ability" && ok && value.SkillName == skill {
						event = &value
					}
				}
				before := edge.Health
				cursorX := anchorX
				if variant == "Radiant Strike" {
					cursorX = p.X + 1
				}
				if !w.PerformAbility(p.ID, cursorX, anchorZ, targetID, skill).Accepted {
					t.Fatal("normal selected-branch cast rejected")
				}
				applied := edge.Health > before
				if variant == "Radiant Strike" {
					applied = edge.Health < before
				}
				if !applied {
					t.Errorf("trained edge missed at radius %v (rank %d)", radius, rank)
				}
				if event == nil || math.Abs(event.Radius-radius) > 1e-8 || math.Abs(event.Arc-arc) > 1e-8 {
					t.Errorf("accepted event does not describe radius=%v arc=%v: %+v", radius, arc, event)
				}
				if variant != "Radiant Strike" && event != nil && (event.TargetX != anchorX || event.TargetZ != anchorZ) {
					t.Errorf("accepted healing area has wrong center: %+v", event)
				}
			})
		}
	}
}
