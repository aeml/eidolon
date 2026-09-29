package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

// A narrow convex cover fixture keeps even short-range skills in reach on both
// sides. The generated formations and their real outlines are tested separately.
func rockEffectFixture(t *testing.T, class string, blocked bool) (*World, *Entity, *Entity) {
	t.Helper()
	w := newRockWorldForTest(t)
	if blocked {
		w.rockSolids = []worldRockSolid{{ID: "effect-cover", Planes: []rockPlane{
			{X: 1, Limit: -101.8}, {Z: 1, Limit: -317}, {X: -1, Limit: 102.2}, {Z: -1, Limit: 325},
		}}}
	}
	p := newTestPlayer("rock-effect-caster", class)
	p.X, p.Z, p.Mana = -103.5, -321, 1000
	w.AddEntity(p)
	target := &Entity{ID: "rock-effect-target", Type: TypeEnemy, X: -100.5, Z: -321,
		State: "IDLE", Scale: 1, Health: 10000, MaxHealth: 10000}
	w.AddEntity(target)
	return w, p, target
}

func TestRockDirectionalAndAreaSkillsRespectCover(t *testing.T) {
	for _, spec := range []struct{ class, skill, rune string }{
		{"Wizard", "Flame Whip", ""}, {"Wizard", "Scorch Beam", ""},
		{"Cleric", "Radiant Strike", ""}, {"Cleric", "Radiant Strike", "radiantstrike_smite"},
		{"Fighter", "Shield Slam", ""}, {"Fighter", "Sweeping Strike", ""},
		{"Fighter", "Earthshaker", ""}, {"Fighter", "Earthshaker", "earthshaker_fissure"},
		{"Wizard", "Gravity Well", ""}, {"Wizard", "Gravity Well", "gravitywell_blackhole"},
		{"Wizard", "Meteor Drop", ""}, {"Wizard", "Meteor Drop", "meteor_cluster"},
		{"Wizard", "Inferno Cataclysm", ""}, {"Rogue", "Rain of Arrows", ""},
		{"Cleric", "Consecrated Ground", ""},
	} {
		for _, blocked := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/%s/cover=%v", spec.skill, spec.rune, blocked), func(t *testing.T) {
				w, p, target := rockEffectFixture(t, spec.class, blocked)
				p.UnlockedSkills = []string{spec.skill}
				p.SkillRunes = map[string]string{spec.skill: spec.rune}
				x, z := target.X, target.Z
				health := target.Health
				castX, castZ := x, z
				switch spec.skill {
				case "Gravity Well", "Meteor Drop", "Inferno Cataclysm", "Rain of Arrows":
					castX, castZ = p.X-1, p.Z // Legal cast; the radius extends behind cover.
				}
				if result := w.PerformAbility(p.ID, castX, castZ, "", spec.skill); !result.Accepted {
					t.Fatalf("legal cast rejected: %+v", result)
				}
				// Snapshot first: impact can create secondary fields/projectiles.
				var projectiles []*Entity
				for _, e := range w.Entities {
					if e.Type == TypeProjectile && e.OwnerID == p.ID {
						projectiles = append(projectiles, e)
					}
				}
				for _, e := range projectiles {
					e.LastAttackTime = time.Now().Add(-time.Second)
					w.updateEntity(e, .05, nil, &deferredActions{})
				}
				if blocked {
					if target.Health != health || target.X != x || target.Z != z || target.Slowed || target.Rooted || target.Stunned || target.ArmorReduction != 0 {
						t.Fatalf("effect crossed cover: hp=%v position=%v,%v", target.Health, target.X, target.Z)
					}
				} else if target.Health >= health {
					t.Fatal("unobstructed control did not deal damage")
				}
			})
		}
	}
}

func TestRockBeamEndpointUsesGeneratedFormation(t *testing.T) {
	w, p, target := rockEffectFixture(t, "Wizard", false)
	w.rockSolids = rockSolidsForTest(t)
	p.X, p.Z, target.X, target.Z = -102, -328, -102, -314
	w.AddEntity(p)
	w.AddEntity(target)
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
	if cast == nil || math.Abs(cast.TargetZ+325) > 1e-6 || cast.TargetX != p.X || target.Health != target.MaxHealth {
		t.Fatalf("beam crossed actual formation or published wrong endpoint: %+v", cast)
	}
}

func TestRockSecondaryExplosionsRespectCover(t *testing.T) {
	for _, blocked := range []bool{false, true} {
		for _, shield := range []bool{false, true} {
			w, p, target := rockEffectFixture(t, "Wizard", blocked)
			if shield {
				w.applyImpactShieldExplosion(p, impactShieldExplosion{damage: 100, x: p.X, z: p.Z, ownerID: p.ID}, false)
			} else {
				w.applyOnKillExplosion(p, "already-dead", "", p.X, p.Z, 100, &deferredActions{}, false)
			}
			if blocked && target.Health != target.MaxHealth || !blocked && target.Health >= target.MaxHealth {
				t.Fatalf("secondary explosion cover mismatch: shield=%v blocked=%v health=%v", shield, blocked, target.Health)
			}
		}
	}
}
