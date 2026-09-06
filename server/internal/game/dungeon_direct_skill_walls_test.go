package game

import (
	"fmt"
	"testing"
)

func directSkillWallFixture(class string, doorway bool) (*World, *Entity, *Entity) {
	const origin = 50000.0
	w := newTestWorld()
	p := newTestPlayer("direct-wall-caster", class)
	p.InstanceID, p.X, p.Z = "dungeon_direct_wall", origin+9, origin
	rects := []DungeonWalkRect{
		{X: origin, Z: origin, Width: 20, Height: 20},
		{X: origin + 20.5, Z: origin, Width: 20, Height: 20},
	}
	if doorway {
		rects = append(rects, DungeonWalkRect{X: origin + 10, Z: origin, Width: 5, Height: 6})
	}
	w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: rects}})
	w.AddEntity(p)
	target := &Entity{ID: "direct-wall-target", Type: TypeEnemy, InstanceID: p.InstanceID,
		X: origin + 11, Z: origin, State: "IDLE", Scale: 1, Health: 10000, MaxHealth: 10000}
	w.AddEntity(target)
	return w, p, target
}

// Real dispatch with canonical-floor fixtures. These are not rendered dungeon
// playthroughs or evidence for secondary AoE/basic-attack wall behavior.
func TestDungeonDirectHostileSkillsRequireReachableTarget(t *testing.T) {
	for _, spec := range []struct{ class, skill string }{
		{"Cleric", "Smite"}, {"Cleric", "Mark of Weakness"}, {"Rogue", "Weak Point Mark"},
	} {
		for _, doorway := range []bool{false, true} {
			for _, explicit := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/doorway=%v/explicit=%v", spec.skill, doorway, explicit), func(t *testing.T) {
					w, p, target := directSkillWallFixture(spec.class, doorway)
					p.UnlockedSkills = []string{spec.skill}
					targetID := ""
					if explicit {
						targetID = target.ID
					}
					manaBefore := p.Mana
					var cast *AbilityEvent
					w.OnEvent = func(kind string, value interface{}) {
						if kind == "ability" {
							event := value.(AbilityEvent)
							cast = &event
						}
					}
					result := w.PerformAbility(p.ID, target.X, target.Z, targetID, spec.skill)
					affected := target.Health < target.MaxHealth || target.Stunned || target.MarkWeakness || target.WeakPointMarked
					if doorway {
						if !result.Accepted || !affected || p.Mana >= manaBefore || result.CooldownRemaining <= 0 {
							t.Fatalf("open doorway prevented normal targeted cast: %+v affected=%v", result, affected)
						}
						if cast == nil || cast.TargetID != target.ID || cast.TargetX != target.X || cast.TargetZ != target.Z {
							t.Fatalf("ability event omitted the resolved target: %+v", cast)
						}
					} else if result.Accepted || affected || p.Mana != manaBefore || result.CooldownRemaining != 0 || !p.LastAbilityTime.IsZero() {
						t.Fatalf("solid wall did not reject targeted cast before resources/effects: %+v affected=%v", result, affected)
					}
				})
			}
		}
	}
}

func TestDungeonArcaneMissilesDoNotRetainRejectedHomingTarget(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		for _, explicit := range []bool{false, true} {
			t.Run(fmt.Sprintf("doorway=%v/explicit=%v", doorway, explicit), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Wizard", doorway)
				p.UnlockedSkills = []string{"Arcane Missiles"}
				targetID := ""
				if explicit {
					targetID = target.ID
				}
				result := w.PerformAbility(p.ID, target.X, target.Z, targetID, "Arcane Missiles")
				if !result.Accepted {
					t.Fatal("unguided cursor missiles should still be cast normally")
				}
				count := 0
				for _, entity := range w.Entities {
					if entity.Type != TypeProjectile || entity.SubType != "ArcaneMissile" {
						continue
					}
					count++
					want := ""
					if doorway {
						want = target.ID
					}
					if entity.TargetID != want {
						t.Fatalf("missile homing target %q, want %q", entity.TargetID, want)
					}
				}
				if count != 3 {
					t.Fatalf("ordinary volley lost missiles: %d", count)
				}
			})
		}
	}
}

func TestDirectSkillWallValidationPreservesFriendlyAndLegacyRules(t *testing.T) {
	w, p, target := directSkillWallFixture("Cleric", false)
	target.Type = TypeNPC
	if !validDirectAbilityTarget(w, p, target, 15, TypePlayer, TypeNPC) {
		t.Fatal("hostile reachability validation changed friendly support rules")
	}
	target.Type = TypeEnemy
	instance, _ := w.getDungeonInstance(p.InstanceID)
	instance.Layout.WalkRects = nil
	if !validDirectAbilityTarget(w, p, target, 15, TypeEnemy) {
		t.Fatal("legacy geometry lost its existing targeting behavior")
	}
	target.InstanceID = "dungeon_other"
	if validDirectAbilityTarget(w, p, target, 15, TypeEnemy) {
		t.Fatal("targeting crossed instance isolation")
	}
}
