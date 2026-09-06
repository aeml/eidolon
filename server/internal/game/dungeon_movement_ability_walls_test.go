package game

import (
	"fmt"
	"math"
	"testing"
)

// A walkable landing in the next room is not permission to cross the solid
// wall between rooms. Exercise the normal dispatch and the published endpoint.
func TestDungeonGroundMovementAbilitiesCannotSkipWalls(t *testing.T) {
	for _, spec := range []struct{ class, skill, rune string }{
		{"Fighter", "Charge", ""},
		{"Fighter", "Charge", "charge_momentum"},
		{"Fighter", "Shattering Charge", ""},
		{"Wizard", "Teleport", ""},
		{"Wizard", "Teleport", "teleport_blink"},
		{"Wizard", "Teleport", "teleport_warp"},
	} {
		for _, doorway := range []bool{false, true} {
			for _, origin := range []float64{20000, 60000} {
				t.Run(fmt.Sprintf("%s/%s/doorway=%v/offset=%v", spec.skill, spec.rune, doorway, origin), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("movement-caster", spec.class)
					p.InstanceID, p.X, p.Z = "dungeon_movement_walls", origin+9, origin
					p.UnlockedSkills = []string{spec.skill}
					p.SkillRunes = map[string]string{spec.skill: spec.rune}
					rects := []DungeonWalkRect{
						{X: origin, Z: origin, Width: 20, Height: 20},
						{X: origin + 30, Z: origin, Width: 20, Height: 20},
						{X: origin, Z: origin + 15, Width: 6, Height: 36},
						{X: origin + 15, Z: origin + 30, Width: 36, Height: 6},
						{X: origin + 30, Z: origin + 15, Width: 6, Height: 36},
					}
					if doorway {
						rects = append(rects, DungeonWalkRect{X: origin + 15, Z: origin, Width: 12, Height: 6})
					}
					w.storeDungeonInstance(p.InstanceID, &DungeonInstance{ID: p.InstanceID, Layout: DungeonLayout{WalkRects: rects}})
					w.AddEntity(p)
					manaBefore := p.Mana
					var event *AbilityEvent
					w.OnEvent = func(kind string, value interface{}) {
						if kind == "ability" {
							if cast, ok := value.(AbilityEvent); ok {
								event = &cast
							}
						}
					}
					result := w.PerformAbility(p.ID, origin+21, origin, "", spec.skill)
					if !result.Accepted || p.Mana >= manaBefore || result.CooldownRemaining <= 0 {
						t.Fatalf("bounded movement cast did not commit normally: %+v", result)
					}
					wantX := origin + 10
					if doorway {
						wantX = origin + 21
						if spec.rune == "charge_momentum" {
							wantX = origin + 27
						}
					}
					if p.IsCharging {
						if math.Abs(p.ChargeTargetX-wantX) > 1e-6 {
							t.Fatalf("charge targets %v beyond intended stop %v", p.ChargeTargetX, wantX)
						}
						for step := 0; step < 100 && p.IsCharging; step++ {
							w.updateEntity(p, 0.05, nil, &deferredActions{})
						}
					}
					if p.IsCharging || math.Abs(p.X-wantX) > 1e-6 || math.Abs(p.Z-origin) > 1e-6 {
						t.Fatalf("movement ended at (%v,%v), want (%v,%v); charging=%v", p.X, p.Z, wantX, origin, p.IsCharging)
					}
					if event == nil || math.Abs(event.TargetX-wantX) > 1e-6 || math.Abs(event.TargetZ-origin) > 1e-6 {
						t.Fatalf("client movement event disagrees with landing: %+v", event)
					}
				})
			}
		}
	}
}

func TestDungeonJumpCannotSkipWallBetweenValidFloors(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		for _, dt := range []float64{0.05, 3} {
			t.Run(fmt.Sprintf("doorway=%v/step=%v", doorway, dt), func(t *testing.T) {
				const origin = 40000.0
				w := newTestWorld()
				p := newTestPlayer("jump-caster", "Fighter")
				p.InstanceID, p.X, p.Z = "dungeon_jump_wall", origin+9, origin
				rects := []DungeonWalkRect{
					{X: origin, Z: origin, Width: 20, Height: 20},
					{X: origin + 30, Z: origin, Width: 20, Height: 20},
				}
				wantX := origin + 10
				if doorway {
					rects = append(rects, DungeonWalkRect{X: origin + 15, Z: origin, Width: 12, Height: 6})
					wantX = origin + 21
				}
				w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: rects}})
				w.AddEntity(p)
				if !w.StartPlayerJump(p.ID, origin+21, 0, origin) {
					t.Fatal("valid bounded jump was rejected")
				}
				if p.JumpTargetX != wantX || p.TargetX != wantX {
					t.Fatalf("replicated jump destinations bypass a wall: jump=%v walk=%v want=%v", p.JumpTargetX, p.TargetX, wantX)
				}
				for step := 0; step < 100 && p.State == "JUMPING"; step++ {
					w.updateEntity(p, dt, nil, &deferredActions{})
					if !w.IsLocationInDungeon(p.InstanceID, p.X, p.Z) {
						t.Fatal("jump crossed outside canonical floors during travel")
					}
				}
				if p.State != "IDLE" || p.X != wantX || p.Z != origin || p.Y != 0 {
					t.Fatalf("jump ended incorrectly: %s (%v,%v,%v)", p.State, p.X, p.Y, p.Z)
				}
			})
		}
	}
}

func TestRogueTargetedMovementRejectsWallsWithoutSpendingResources(t *testing.T) {
	for _, spec := range []struct{ skill, rune string }{
		{"Shadow Strike", ""}, {"Shadow Lunge", ""},
		{"Shadow Lunge", "shadowlunge_extended"}, {"Shadow Lunge", "shadowlunge_cripple"},
		{"Shadow Lunge", "shadowlunge_shadow"}, {"Backstab", "backstab_shadowstep"},
	} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/%s/doorway=%v", spec.skill, spec.rune, doorway), func(t *testing.T) {
				const origin = 60000.0
				w := newTestWorld()
				p := newTestPlayer("rogue-wall-caster", "Rogue")
				p.InstanceID, p.X, p.Z = "dungeon_rogue_wall", origin+9, origin
				p.UnlockedSkills = []string{spec.skill}
				p.SkillRunes = map[string]string{spec.skill: spec.rune}
				// A narrow solid gap is within Backstab range; the target and
				// its behind-position are otherwise perfectly valid floor.
				rects := []DungeonWalkRect{
					{X: origin, Z: origin, Width: 20, Height: 20},
					{X: origin + 20.5, Z: origin, Width: 20, Height: 20},
				}
				if doorway {
					rects = append(rects, DungeonWalkRect{X: origin + 10, Z: origin, Width: 5, Height: 6})
				}
				w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: rects}})
				w.AddEntity(p)
				target := &Entity{ID: "rogue-wall-target", Type: TypeEnemy, InstanceID: p.InstanceID,
					X: origin + 11, Z: origin, State: "IDLE", Scale: 1, Health: 10000, MaxHealth: 10000}
				w.AddEntity(target)
				manaBefore := p.Mana
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, spec.skill)
				if doorway {
					if !result.Accepted || p.Mana >= manaBefore || result.CooldownRemaining <= 0 || p.X == origin+9 {
						t.Fatalf("open doorway prevented valid targeted movement: %+v, x=%v", result, p.X)
					}
					if (spec.skill != "Shadow Lunge" || spec.rune == "shadowlunge_shadow") && target.Health == target.MaxHealth {
						t.Fatal("accessible movement strike did not damage its target")
					}
				} else if result.Accepted || p.Mana != manaBefore || result.CooldownRemaining != 0 ||
					!p.LastAbilityTime.IsZero() || len(p.Cooldowns) != 0 || p.X != origin+9 || p.Z != origin ||
					target.Health != target.MaxHealth || target.Slowed || target.Bleeding {
					t.Fatalf("wall-blocked movement changed actor state: %+v, pos=(%v,%v), target HP=%v, slow=%v, bleed=%v", result, p.X, p.Z, target.Health, target.Slowed, target.Bleeding)
				}
			})
		}
	}
}

func TestDungeonMovementDestinationKeepsLegacyAndRecoveryBehavior(t *testing.T) {
	for _, fixture := range []struct {
		name, instanceID                   string
		registered, canonical, constrained bool
		fromX, targetX, wantX              float64
	}{
		{"overworld", "", false, false, false, 9, 21, 21},
		{"pvp", "arena_1", false, false, false, 9, 21, 21},
		{"missing layout", "dungeon_missing", false, false, false, 9, 21, 21},
		{"legacy layout", "dungeon_legacy", true, false, false, 9, 21, 21},
		{"recover outside start", "dungeon_recovery", true, true, true, 19, 21, 21},
		{"clip outside destination", "dungeon_edge", true, true, true, 9, 15, 10},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			const origin = 30000.0
			w := newTestWorld()
			p := newTestPlayer("movement-recovery", "Wizard")
			p.InstanceID, p.X, p.Z = fixture.instanceID, origin+fixture.fromX, origin
			if fixture.registered {
				layout := DungeonLayout{}
				if fixture.canonical {
					layout.WalkRects = []DungeonWalkRect{
						{X: origin, Z: origin, Width: 20, Height: 20},
						{X: origin + 30, Z: origin, Width: 20, Height: 20},
					}
				}
				w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: layout})
			}
			x, z, constrained := w.constrainDungeonMovementDestination(p, origin+fixture.targetX, origin)
			if x != origin+fixture.wantX || z != origin || constrained != fixture.constrained {
				t.Fatalf("unexpected movement policy: (%v,%v,%v)", x, z, constrained)
			}
		})
	}
}
