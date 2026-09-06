package game

import (
	"fmt"
	"math"
	"testing"
)

func TestDungeonDirectionalAttacksRespectWalls(t *testing.T) {
	for _, spec := range []struct{ class, skill, rune string }{
		{"Wizard", "Flame Whip", ""}, {"Wizard", "Scorch Beam", ""},
		{"Cleric", "Radiant Strike", ""}, {"Cleric", "Radiant Strike", "radiantstrike_smite"},
		{"Fighter", "Shield Slam", ""}, {"Fighter", "Sweeping Strike", ""},
		{"Fighter", "Earthshaker", ""}, {"Fighter", "Earthshaker", "earthshaker_fissure"},
	} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/%s/doorway=%v", spec.skill, spec.rune, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture(spec.class, doorway)
				p.UnlockedSkills = []string{spec.skill}
				p.SkillRunes = map[string]string{spec.skill: spec.rune}
				health := target.Health
				result := w.PerformAbility(p.ID, target.X, target.Z, "", spec.skill)
				// Directional swings/beams can be cast into empty space. A wall
				// blocks targets, not the cast itself, just like an ordinary miss.
				if !result.Accepted {
					t.Fatalf("directional cast rejected: %+v", result)
				}
				if doorway {
					if target.Health >= health {
						t.Fatal("open doorway prevented directional hit")
					}
				} else if target.Health != health || target.Stunned || target.ArmorReduction != 0 {
					t.Fatalf("directional effect crossed wall: health=%d stun=%v armorReduction=%d", target.Health, target.Stunned, target.ArmorReduction)
				}
			})
		}
	}
}

func TestDungeonGripCannotPullThroughWallsOrPushNearTargets(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		for _, distance := range []float64{0.5, 6} {
			for _, explicit := range []bool{false, true} {
				t.Run(fmt.Sprintf("doorway=%v/distance=%v/explicit=%v", doorway, distance, explicit), func(t *testing.T) {
					w, p, target := directSkillWallFixture("Fighter", doorway)
					oldX := target.X
					target.X = p.X + distance
					w.Grid.Update(target, oldX, target.Z)
					p.UnlockedSkills = []string{"Unbreakable Grip"}
					mana, x := p.Mana, target.X
					targetID := ""
					if explicit {
						targetID = target.ID
					}
					result := w.PerformAbility(p.ID, target.X, target.Z, targetID, "Unbreakable Grip")
					if doorway || distance < 1 {
						if !result.Accepted || !target.Rooted || target.X != p.X+math.Min(2, distance) {
							t.Fatalf("legal pull failed or pushed near target: %+v x=%f", result, target.X)
						}
					} else if result.Accepted || p.Mana != mana || result.CooldownRemaining != 0 || target.Rooted || target.X != x {
						t.Fatalf("blocked pull consumed resources or affected target: %+v x=%f", result, target.X)
					}
				})
			}
		}
	}
}

func TestScorchBeamPublishesItsActualWallClippedEndpoint(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprint(doorway), func(t *testing.T) {
			w, p, target := directSkillWallFixture("Wizard", doorway)
			p.UnlockedSkills = []string{"Scorch Beam"}
			var cast *AbilityEvent
			w.OnEvent = func(kind string, value interface{}) {
				if kind == "ability" {
					event := value.(AbilityEvent)
					cast = &event
				}
			}
			if result := w.PerformAbility(p.ID, target.X, target.Z, "", "Scorch Beam"); !result.Accepted {
				t.Fatal(result)
			}
			wantX := 50010.0
			if doorway {
				wantX = p.X + 18
			}
			if cast == nil || cast.TargetX != wantX || cast.TargetZ != p.Z {
				t.Fatalf("beam visual endpoint=%+v, want (%f,%f)", cast, wantX, p.Z)
			}
		})
	}
}
