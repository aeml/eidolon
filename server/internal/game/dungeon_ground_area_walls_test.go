package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestDungeonGroundCastsRejectWallsBeforeResources(t *testing.T) {
	for _, spec := range []struct{ class, skill string }{
		{"Wizard", "Gravity Well"}, {"Wizard", "Meteor Drop"},
		{"Wizard", "Inferno Cataclysm"}, {"Rogue", "Rain of Arrows"},
	} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/doorway=%v", spec.skill, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture(spec.class, doorway)
				p.UnlockedSkills = []string{spec.skill}
				mana := p.Mana
				entityCount := len(w.Entities)
				casts := 0
				w.OnEvent = func(kind string, _ interface{}) {
					if kind == "ability" {
						casts++
					}
				}
				result := w.PerformAbility(p.ID, target.X, target.Z, "", spec.skill)
				if doorway {
					if !result.Accepted || p.Mana >= mana || casts != 1 || result.CooldownRemaining <= 0 {
						t.Fatalf("open doorway cast failed: %+v casts=%d", result, casts)
					}
				} else if result.Accepted || p.Mana != mana || casts != 0 || len(w.Entities) != entityCount || target.Health != target.MaxHealth || result.CooldownRemaining != 0 {
					t.Fatalf("blocked cast consumed resources or produced effects: %+v casts=%d", result, casts)
				}
			})
		}
	}
}

// Cast at legal ground on the caster's side. The enemy is inside the effect's
// radius but separated by a wall. Advance normal projectile impact/tick logic;
// no damage or health overrides stand in for an actual skill hit.
func TestDungeonGroundAreaDamageRespectsWalls(t *testing.T) {
	for _, spec := range []struct{ class, skill, rune string }{
		{"Wizard", "Gravity Well", ""}, {"Wizard", "Meteor Drop", ""},
		{"Wizard", "Inferno Cataclysm", ""}, {"Rogue", "Rain of Arrows", ""},
		{"Cleric", "Consecrated Ground", ""},
		{"Wizard", "Gravity Well", "gravitywell_expanded"},
		{"Wizard", "Gravity Well", "gravitywell_blackhole"},
		{"Wizard", "Meteor Drop", "meteor_extinction"},
		{"Wizard", "Meteor Drop", "meteor_cluster"},
		{"Cleric", "Consecrated Ground", "consecratedground_expanded"},
	} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/%s/doorway=%v", spec.skill, spec.rune, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture(spec.class, doorway)
				p.UnlockedSkills = []string{spec.skill}
				p.SkillRunes = map[string]string{spec.skill: spec.rune}
				x, z := target.X, target.Z
				health := target.Health
				damage := 0
				w.OnEvent = func(kind string, value interface{}) {
					if kind == "damage" {
						event := value.(DamageEvent)
						if event.TargetID == target.ID {
							damage += event.Amount
						}
					}
				}
				result := w.PerformAbility(p.ID, p.X-1, p.Z, "", spec.skill)
				if !result.Accepted {
					t.Fatalf("legal ground cast rejected: %+v", result)
				}
				for _, e := range w.Entities {
					if e.Type == TypeProjectile && e.OwnerID == p.ID {
						e.LastAttackTime = time.Now().Add(-time.Second)
						w.updateEntity(e, 0.05, nil, &deferredActions{})
					}
				}
				if doorway {
					if target.Health >= health || damage <= 0 {
						t.Fatal("open doorway prevented normal area damage")
					}
				} else if target.Health != health || damage != 0 || target.X != x || target.Z != z || target.Slowed || target.Rooted {
					t.Fatalf("area effect crossed wall: hp=%d pos=(%f,%f) slow=%v root=%v", target.Health, target.X, target.Z, target.Slowed, target.Rooted)
				}
			})
		}
	}
}

func TestDungeonGroundValidationPreservesLegacyAndRejectsInvalidPoints(t *testing.T) {
	w, p, target := directSkillWallFixture("Wizard", false)
	for _, point := range [][2]float64{{p.X, p.Z + 15}, {math.NaN(), p.Z}, {p.X, math.Inf(1)}} {
		if w.validDungeonGroundCastTarget(p, point[0], point[1]) {
			t.Fatalf("invalid ground accepted: %v", point)
		}
	}
	inst, _ := w.getDungeonInstance(p.InstanceID)
	inst.Layout.WalkRects = nil
	if !w.validDungeonGroundCastTarget(p, target.X, target.Z) {
		t.Fatal("legacy cast rules changed")
	}
	if !withinDungeonAbilityRadius(nil, "Meteor Drop", p.X, p.Z, target, 16) {
		t.Fatal("legacy area damage changed")
	}
}

func TestDungeonMeteorScatterRemainsOnReachableGround(t *testing.T) {
	for _, runeID := range []string{"meteor_cluster", "meteor_apocalypse"} {
		t.Run(runeID, func(t *testing.T) {
			w, p, _ := directSkillWallFixture("Wizard", false)
			p.UnlockedSkills = []string{"Meteor Drop"}
			p.SkillRunes = map[string]string{"Meteor Drop": runeID}
			// Initial center is one unit from a wall; positive scatter crosses it
			// unless each additional meteor is clipped from the accepted center.
			x, z, instanceID := p.X, p.Z, p.InstanceID
			if result := w.PerformAbility(p.ID, x, z, "", "Meteor Drop"); !result.Accepted {
				t.Fatal(result)
			}
			t.Cleanup(func() { w.Mu.Lock(); p.Mu.Lock(); p.State = "DEAD"; p.Mu.Unlock(); w.Mu.Unlock() })
			want := 3
			if runeID == "meteor_apocalypse" {
				want = 6
			}
			deadline := time.Now().Add(8 * time.Second)
			for {
				count := 0
				w.Mu.RLock()
				for _, e := range w.Entities {
					if e.SubType != "Meteor" || e.OwnerID != p.ID {
						continue
					}
					count++
					if _, _, blocked := w.firstDungeonWallHit(instanceID, x, z, e.X, e.Z); blocked {
						w.Mu.RUnlock()
						t.Fatalf("scatter crossed wall: (%f,%f)", e.X, e.Z)
					}
				}
				w.Mu.RUnlock()
				if count == want {
					break
				}
				if time.Now().After(deadline) {
					t.Fatalf("got %d meteors, want %d", count, want)
				}
				time.Sleep(50 * time.Millisecond)
			}
		})
	}
}

func TestDungeonMeteorShieldExplosionCannotCrossWall(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprint(doorway), func(t *testing.T) {
			w, p, target := directSkillWallFixture("Wizard", doorway)
			p.ArcaneShieldActive, p.ArcaneShieldHP = true, 100
			meteor := &Entity{ID: "combo-meteor", Type: TypeProjectile, SubType: "Meteor", ProjectileSkill: "Meteor Drop",
				InstanceID: p.InstanceID, X: p.X - 1, Z: p.Z, OwnerID: p.ID, Radius: 16, Damage: 50,
				MeteorShieldExplode: true, LastAttackTime: time.Now().Add(-time.Second)}
			w.AddEntity(meteor)
			w.updateEntity(meteor, 0.05, nil, &deferredActions{})
			if p.ArcaneShieldActive || p.ArcaneShieldHP != 0 {
				t.Fatal("impact did not consume combo shield")
			}
			want := 10000
			if doorway {
				want -= 150
			}
			if target.Health != want {
				t.Fatalf("combo health=%d, want %d", target.Health, want)
			}
		})
	}
}

func TestDungeonHolyGroundPreservesFriendlyHealing(t *testing.T) {
	w, p, ally := directSkillWallFixture("Cleric", false)
	ally.Type = TypeNPC
	ally.Health = 5000
	p.UnlockedSkills = []string{"Consecrated Ground"}
	p.SkillRunes = map[string]string{"Consecrated Ground": "consecratedground_sanctuary"}
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Consecrated Ground"); !result.Accepted {
		t.Fatal(result)
	}
	for _, e := range w.Entities {
		if e.SubType == "ZoneHoly" && e.OwnerID == p.ID {
			w.updateEntity(e, 0.05, nil, &deferredActions{})
		}
	}
	if ally.Health <= 5000 || !ally.ConsecratedSanctuaryEndTime.After(time.Now()) {
		t.Fatal("hostile wall rule changed friendly healing or sanctuary")
	}
}

func TestDungeonGroundDamageDoesNotFollowTargetIntoAnotherInstance(t *testing.T) {
	for _, skill := range []string{"Meteor Drop", "Inferno Cataclysm"} {
		t.Run(skill, func(t *testing.T) {
			w, p, target := directSkillWallFixture("Wizard", true)
			p.UnlockedSkills = []string{skill}
			if result := w.PerformAbility(p.ID, target.X, target.Z, "", skill); !result.Accepted {
				t.Fatal(result)
			}
			// Retain a stale spatial entry deliberately; authoritative actor
			// identity must still protect a target that changes instance.
			target.InstanceID = "dungeon_elsewhere"
			for _, e := range w.Entities {
				if e.Type == TypeProjectile && e.OwnerID == p.ID {
					e.LastAttackTime = time.Now().Add(-time.Second)
					w.updateEntity(e, 0.05, nil, &deferredActions{})
				}
			}
			if target.Health != target.MaxHealth {
				t.Fatal("ground effect crossed instance identity")
			}
		})
	}
}
