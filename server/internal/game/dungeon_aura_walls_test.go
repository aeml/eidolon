package game

import (
	"fmt"
	"testing"
	"time"
)

func TestDungeonSelfAreaEffectsRespectWalls(t *testing.T) {
	for _, spec := range []struct{ class, skill, rune string }{
		{"Fighter", "Whirlwind", ""}, {"Fighter", "Whirlwind", "whirlwind_bladestorm"},
		{"Fighter", "Whirlwind", "whirlwind_bloodwhirl"},
		{"Fighter", "Executioner Spin", ""}, {"Fighter", "Guardian Roar", ""},
		{"Fighter", "Juggernaut Charge", ""}, {"Rogue", "Death Spiral", ""},
		{"Rogue", "Smoke Bomb", ""}, {"Wizard", "Frost Nova", ""},
		{"Cleric", "Heaven's Trumpet", ""}, {"Cleric", "Spirit Guardians", ""},
		{"Cleric", "Spirit Guardians", "spirits_expanded"},
		{"Cleric", "Spirit Guardians", "spirits_vengeful"},
		{"Cleric", "Spirit Guardians Boost", ""},
	} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/%s/doorway=%v", spec.skill, spec.rune, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture(spec.class, doorway)
				p.UnlockedSkills = []string{spec.skill}
				p.SkillRunes = map[string]string{spec.skill: spec.rune}
				p.Health = 250
				health, x, z := target.Health, target.X, target.Z
				result := w.PerformAbility(p.ID, target.X, target.Z, "", spec.skill)
				if !result.Accepted {
					t.Fatalf("self-area cast rejected: %+v", result)
				}
				if p.SpiritsActive {
					w.updateEntity(p, 0.05, nil, &deferredActions{})
				}
				affected := target.Health < health || target.Slowed || target.Stunned || target.MarkWeakness || target.Threat[p.ID] > 0
				if doorway {
					if !affected {
						t.Fatal("open doorway prevented area effect")
					}
					if spec.rune == "whirlwind_bloodwhirl" && p.Health <= 250 {
						t.Fatal("valid Bloodwhirl hit lost its healing")
					}
				} else if affected || target.X != x || target.Z != z {
					t.Fatalf("area effect crossed wall: health=%d slow=%v stun=%v threat=%v position=(%f,%f)", target.Health, target.Slowed, target.Stunned, target.Threat[p.ID], target.X, target.Z)
				}
				if !doorway && spec.rune == "whirlwind_bloodwhirl" && p.Health != 250 {
					t.Fatal("blocked enemy granted Bloodwhirl healing")
				}
			})
		}
	}
}

func TestDungeonSpiritTicksRecheckMovedTarget(t *testing.T) {
	w, p, target := directSkillWallFixture("Cleric", false)
	oldX := target.X
	target.X = p.X - 2
	w.Grid.Update(target, oldX, target.Z)
	health := target.Health
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Spirit Guardians"); !result.Accepted {
		t.Fatal(result)
	}
	w.updateEntity(p, 0.05, nil, &deferredActions{})
	if target.Health >= health {
		t.Fatal("initial open-floor spirit tick did not damage")
	}
	oldX, health = target.X, target.Health
	target.X = p.X + 2
	w.Grid.Update(target, oldX, target.Z)
	p.LastSpiritTick = time.Now().Add(-time.Second)
	w.updateEntity(p, 0.05, nil, &deferredActions{})
	if target.Health != health {
		t.Fatal("later spirit tick followed enemy through wall")
	}
}

func TestDungeonRoarWallRulePreservesFriendlyBuff(t *testing.T) {
	w, p, ally := directSkillWallFixture("Fighter", false)
	ally.Type = TypeNPC
	p.UnlockedSkills = []string{"Guardian Roar"}
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Guardian Roar"); !result.Accepted {
		t.Fatal(result)
	}
	if !ally.GuardianRoarActive || !ally.GuardianRoarEndTime.After(time.Now()) {
		t.Fatal("hostile taunt wall rule changed ally buff")
	}
}

// Cover the existing active-state tick branch separately. This is not proof
// that selecting the Extended rune currently activates that state.
func TestDungeonActiveWhirlwindTickRespectsWalls(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprint(doorway), func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", doorway)
			p.WhirlwindActive = true
			p.WhirlwindEndTime = time.Now().Add(time.Second)
			health := target.Health
			w.updateEntity(p, 0.05, nil, &deferredActions{})
			if doorway && target.Health >= health {
				t.Fatal("open doorway prevented active Whirlwind tick")
			}
			if !doorway && target.Health != health {
				t.Fatal("active Whirlwind tick crossed wall")
			}
		})
	}
}
