package game

// Diagnostic overlay only: these paired casts expose remaining consumers.
// Run with scripts/audit-talent-consumers.mjs; they are not silently skipped
// tests in the passing release suite. Promote them when implementing each fix.

import (
	"fmt"
	"math"
	"testing"
	"time"
)

// Spirit Guardians/Boost now have ordinary cast/tick and observer coverage.
// The remaining Cleric cone and Healing Light area variants still need probing.
func TestPendingTalentClericConeAndHealingAreas(t *testing.T) {
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

// Use normal branch selection and real combo dispatch, rather than granting an
// ActiveCombo flag. Rank-zero effects distinguish accessible combos from broken
// trained geometry; accepted events must describe the actual area as well.
func TestPendingTalentClericAcceptedAreas(t *testing.T) {
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
