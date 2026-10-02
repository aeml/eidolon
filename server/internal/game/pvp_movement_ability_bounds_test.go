package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func insidePvPCenterBounds(x, z float64) bool {
	return math.Abs(x) <= 24+1e-9 && math.Abs(z) <= 16+1e-9
}

func arenaMovementFixture(t *testing.T, mode, class, skill, rune string) (*World, *Entity, *Entity) {
	t.Helper()
	p := newTestPlayer("bounds-caster", class)
	target := newTestPlayer("bounds-opponent", "Fighter")
	p.UnlockedSkills = []string{skill}
	p.SkillRunes = map[string]string{skill: rune}
	target.Health, target.MaxHealth = 10000, 10000
	w := newPvPTestWorld(p, target)
	if match := startTestPvPMatch(w, mode, []string{p.ID}, []string{target.ID}); match == nil {
		t.Fatal("actual match did not start")
	}
	// These fixtures isolate geometry after opening protection, not its timer.
	p.InvulnerableEndTime, target.InvulnerableEndTime = time.Time{}, time.Time{}
	return w, p, target
}

func TestPvPGroundMovementAbilitiesStayInsideArena(t *testing.T) {
	for _, mode := range []string{PvPModeDuel, PvPModeArena1v1} {
		for _, spec := range []struct{ class, skill, rune string }{
			{"Wizard", "Teleport", ""},
			{"Wizard", "Teleport", "teleport_blink"},
			{"Wizard", "Teleport", "teleport_warp"},
			{"Fighter", "Charge", ""},
			{"Fighter", "Charge", "charge_momentum"},
			{"Fighter", "Shattering Charge", ""},
			{"Fighter", "Juggernaut Charge", ""},
		} {
			for _, aim := range []struct {
				name         string
				x, z, dx, dz float64
			}{
				{"east", 23, 0, 8, 0}, {"west", -23, 0, -8, 0},
				{"north", 0, 15, 0, 8}, {"south", 0, -15, 0, -8},
				{"ordinary", 0, 0, 8, 0},
			} {
				t.Run(fmt.Sprintf("%s/%s/%s/%s", mode, spec.skill, spec.rune, aim.name), func(t *testing.T) {
					w, p, opponent := arenaMovementFixture(t, mode, spec.class, spec.skill, spec.rune)
					opponentX, opponentZ := opponent.X, opponent.Z
					opponent.X, opponent.Z = 0, -8
					w.Grid.Update(opponent, opponentX, opponentZ)
					oldX, oldZ := p.X, p.Z
					p.X, p.Z = aim.x, aim.z
					w.Grid.Update(p, oldX, oldZ)
					mana := p.Mana
					var cast *AbilityEvent
					w.OnEvent = func(kind string, value interface{}) {
						if kind == "ability" {
							if event, ok := value.(AbilityEvent); ok {
								cast = &event
							}
						}
					}
					result := w.PerformAbility(p.ID, aim.x+aim.dx, aim.z+aim.dz, "", spec.skill)
					if !result.Accepted || p.Mana >= mana || result.CooldownRemaining <= 0 {
						t.Fatalf("ordinary range/cost contract lost: %+v", result)
					}
					if cast == nil || !insidePvPCenterBounds(cast.TargetX, cast.TargetZ) {
						t.Fatalf("replicated movement aim escapes arena: %+v", cast)
					}
					if p.IsCharging && !insidePvPCenterBounds(p.ChargeTargetX, p.ChargeTargetZ) {
						t.Fatal("committed charge endpoint escapes arena")
					}
					for step := 0; step < 50 && p.IsCharging; step++ {
						w.updateEntity(p, .05, nil, &deferredActions{})
						if !insidePvPCenterBounds(p.X, p.Z) {
							t.Fatal("charge traveled outside arena")
						}
					}
					if p.IsCharging || !insidePvPCenterBounds(p.X, p.Z) {
						t.Fatal("movement landed outside arena")
					}
					if aim.name == "ordinary" {
						wantX := 8.0
						if spec.rune == "charge_momentum" {
							wantX = 12 // Existing +50% distance, not a flat extension.
						}
						if math.Abs(p.X-wantX) > 1e-9 || p.Z != 0 {
							t.Fatal("in-bounds movement was changed")
						}
					}
				})
			}
		}
	}
}

func TestPvPRogueBehindTargetLandingsStayInsideArena(t *testing.T) {
	for _, mode := range []string{PvPModeDuel, PvPModeArena1v1} {
		for _, spec := range []struct{ skill, rune string }{
			{"Shadow Strike", ""}, {"Shadow Lunge", ""},
			{"Shadow Lunge", "shadowlunge_extended"}, {"Shadow Lunge", "shadowlunge_cripple"},
			{"Shadow Lunge", "shadowlunge_shadow"}, {"Backstab", "backstab_shadowstep"},
		} {
			for _, sign := range []float64{-1, 1} {
				t.Run(fmt.Sprintf("%s/%s/corner=%v", mode, spec.skill, sign), func(t *testing.T) {
					w, p, target := arenaMovementFixture(t, mode, "Rogue", spec.skill, spec.rune)
					oldX, oldZ := target.X, target.Z
					target.X, target.Z = sign*24, sign*16
					target.Rotation = -sign * 3 * math.Pi / 4
					w.Grid.Update(target, oldX, oldZ)
					oldX, oldZ = p.X, p.Z
					p.X, p.Z = sign*22, sign*14
					w.Grid.Update(p, oldX, oldZ)
					mana, health := p.Mana, target.Health
					result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, spec.skill)
					if !result.Accepted || p.Mana >= mana || result.CooldownRemaining <= 0 {
						t.Fatalf("accessible hostile strike failed: %+v", result)
					}
					if spec.skill == "Shadow Lunge" {
						// Base Lunge applies a wound, not an immediate weapon hit.
						if !target.Bleeding || target.BleedDamage <= 0 || target.BleedSourceID != p.ID {
							t.Fatal("clipped lunge lost its actual bleed contract")
						}
					} else if target.Health >= health {
						t.Fatal("clipped strike lost its immediate damage")
					}
					if !insidePvPCenterBounds(p.X, p.Z) {
						t.Fatal("behind-target landing escaped arena")
					}
					if p.InstanceID != target.InstanceID {
						t.Fatal("strike changed scene")
					}
				})
			}
		}
	}
}

func TestPvPGravityWellCannotPullOpponentOutsideArena(t *testing.T) {
	for _, rune := range []string{"", "gravitywell_blackhole"} {
		for _, edge := range []struct {
			name         string
			x, z, dx, dz float64
		}{
			{"east", 24, 0, 1, 0}, {"west", -24, 0, -1, 0},
			{"north", 0, 16, 0, 1}, {"south", 0, -16, 0, -1},
		} {
			t.Run(rune+"/"+edge.name, func(t *testing.T) {
				w, p, target := arenaMovementFixture(t, PvPModeArena1v1, "Wizard", "Gravity Well", rune)
				oldX, oldZ := target.X, target.Z
				target.X, target.Z = edge.x, edge.z
				w.Grid.Update(target, oldX, oldZ)
				oldX, oldZ = p.X, p.Z
				p.X, p.Z = edge.x-edge.dx, edge.z-edge.dz
				w.Grid.Update(p, oldX, oldZ)
				health := target.Health
				result := w.PerformAbility(p.ID, edge.x+5*edge.dx, edge.z+5*edge.dz, "", "Gravity Well")
				if !result.Accepted || target.Health >= health {
					t.Fatalf("legal nearby well did not affect opponent: %+v", result)
				}
				if !insidePvPCenterBounds(target.X, target.Z) {
					t.Fatal("gravity pull displaced opponent outside arena")
				}
				if !target.Slowed {
					t.Fatal("boundary clipping suppressed legitimate control effect")
				}
			})
		}
	}
}

func TestPvPChargeShockwaveCannotKnockOpponentOutsideArena(t *testing.T) {
	for _, sign := range []float64{-1, 1} {
		t.Run(fmt.Sprintf("edge=%v", sign), func(t *testing.T) {
			w, p, target := arenaMovementFixture(t, PvPModeArena1v1, "Fighter", "Charge", "charge_shockwave")
			oldX, oldZ := target.X, target.Z
			target.X, target.Z = sign*24, 0
			w.Grid.Update(target, oldX, oldZ)
			oldX, oldZ = p.X, p.Z
			p.X, p.Z = sign*22, 0
			w.Grid.Update(p, oldX, oldZ)
			health := target.Health
			result := w.PerformAbility(p.ID, sign*23, 0, "", "Charge")
			if !result.Accepted {
				t.Fatalf("charge not admitted: %+v", result)
			}
			for step := 0; step < 30 && p.IsCharging; step++ {
				w.updateEntity(p, .05, nil, &deferredActions{})
				if !insidePvPCenterBounds(p.X, p.Z) || !insidePvPCenterBounds(target.X, target.Z) {
					t.Fatal("charge impact/knockback escaped arena")
				}
			}
			if p.IsCharging || target.Health >= health {
				t.Fatal("boundary clipping suppressed charge impact")
			}
		})
	}
}

func TestPvPMovementClippingRequiresActualMatchNotScenePrefix(t *testing.T) {
	p := newTestPlayer("forged-prefix", "Wizard")
	p.InstanceID = "pvp-forged"
	w := newPvPTestWorld(p)
	x, z, active := w.constrainDungeonMovementDestination(p, 30, 40)
	if active || x != 30 || z != 40 {
		t.Fatal("scene prefix was treated as an actual arena")
	}
	if _, ok := w.GetInstanceLayout(p.InstanceID); ok {
		t.Fatal("clipping authorized a nonexistent venue")
	}
}
