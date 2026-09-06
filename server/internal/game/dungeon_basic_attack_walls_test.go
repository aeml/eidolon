package game

import (
	"fmt"
	"testing"
	"time"
)

func TestDungeonBasicAttackAdmissionRespectsWallsForAllClasses(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/doorway=%v", class, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture(class, doorway)
				p.AttackCooldown = 10 * time.Millisecond
				hits := make(chan struct{}, 1)
				w.OnEvent = func(kind string, _ interface{}) {
					if kind == "damage" {
						hits <- struct{}{}
					}
				}
				_, accepted := w.PerformAttack(p.ID, target.ID)
				if accepted != doorway {
					t.Fatalf("attack acceptance=%v, doorway=%v", accepted, doorway)
				}
				if !doorway {
					if !p.LastAttackTime.IsZero() || p.State != "IDLE" {
						t.Fatal("blocked attack committed its cooldown or animation")
					}
					return
				}
				select {
				case <-hits:
					target.Mu.RLock()
					damaged := target.Health < target.MaxHealth
					target.Mu.RUnlock()
					if !damaged {
						t.Fatal("open doorway attack produced no real damage")
					}
				case <-time.After(time.Second):
					t.Fatal("open doorway attack never landed")
				}
			})
		}
	}
}

func TestDungeonBasicAttackRechecksTargetAtImpact(t *testing.T) {
	for _, movedBehindWall := range []bool{false, true} {
		t.Run(fmt.Sprintf("behindWall=%v", movedBehindWall), func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", false)
			target.X = p.X - 1 // Legal at attack admission.
			rects := w.dungeonWalkRectsSnapshot(p.InstanceID)
			if _, _, blocked := firstDungeonWalkRectWallHit(rects, p.X, p.Z, target.X, target.Z); blocked {
				t.Fatal("fixture does not begin with a legal attack path")
			}
			damaged := false
			w.OnEvent = func(kind string, _ interface{}) {
				if kind == "damage" {
					damaged = true
				}
			}
			// Run the exact post-delay path synchronously: absence of damage
			// is proved by completion, not by a short timer or scheduler luck.
			target.X = p.X - 2
			if movedBehindWall {
				target.X = p.X + 2
			}
			w.applyAttackImpact(p.ID, target.ID, p.InstanceID, rects, 0)
			if damaged == movedBehindWall || (target.Health < target.MaxHealth) == movedBehindWall {
				t.Fatalf("impact damage=%v HP=%d after movement, behind wall=%v", damaged, target.Health, movedBehindWall)
			}
		})
	}
}

func TestDungeonAttackSnapshotIsPrivateAndCannotFollowSceneChanges(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	instance, _ := w.getDungeonInstance(p.InstanceID)
	originalID := p.InstanceID
	rects := w.dungeonWalkRectsSnapshot(originalID)
	instance.Layout.WalkRects[0].Width = 0
	if rects[0].Width != 20 {
		t.Fatal("delayed attack geometry aliases the mutable instance layout")
	}
	p.InstanceID, target.InstanceID = "dungeon_new", "dungeon_new"
	w.applyAttackImpact(p.ID, target.ID, originalID, rects, 0)
	if target.Health != target.MaxHealth {
		t.Fatal("an old attack followed both actors into another scene")
	}
}

func TestDungeonBasicAndReflectedDamageEventsKeepTheirInstance(t *testing.T) {
	w, p, target := directSkillWallFixture("Fighter", true)
	target.ActiveSetBonuses = map[string]map[string]int{"reflection-fixture": {"damageReflect": 1}}
	var events []DamageEvent
	w.OnEvent = func(kind string, value interface{}) {
		if kind == "damage" {
			events = append(events, value.(DamageEvent))
		}
	}
	w.applyAttackImpact(p.ID, target.ID, p.InstanceID, w.dungeonWalkRectsSnapshot(p.InstanceID), 0)
	if len(events) != 2 {
		t.Fatalf("expected actual basic damage and reflection, got %+v", events)
	}
	for _, event := range events {
		if event.Amount <= 0 || event.InstanceID != p.InstanceID {
			t.Fatalf("damage event lost its instance routing: %+v", event)
		}
	}
}
