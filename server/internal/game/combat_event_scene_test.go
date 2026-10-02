package game

import "testing"

func TestAbilityEventHelpersCaptureSceneAndRejectMissingSource(t *testing.T) {
	for _, helper := range []string{"ordinary", "teleport", "landing", "earthshaker"} {
		t.Run(helper, func(t *testing.T) {
			p := newTestPlayer("scene-caster", "Wizard")
			p.InstanceID = "dungeon_cast-scene"
			w := newPvPTestWorld(p)
			var events []AbilityEvent
			w.OnEvent = func(kind string, data interface{}) {
				if kind == "ability" {
					events = append(events, data.(AbilityEvent))
				}
			}
			w.Mu.Lock()
			switch helper {
			case "ordinary":
				w.fireAbilityEvent(p.ID, "", "Fireball", 1, 2)
			case "teleport":
				w.fireTeleportEvent(p.ID, "", AbilityOrigin{X: 0, Z: 0}, AbilityLanding{X: 1, Z: 2}, 0)
			case "landing":
				w.fireAbilityLandingEvent(p.ID, "", "Shadow Lunge", 1, 2, AbilityLanding{X: 1, Z: 2})
			case "earthshaker":
				w.fireEarthshakerEvent(p.ID, 0, 0, 1, 0, 6, false, "aftershock")
			}
			p.InstanceID = "dungeon_departed"
			w.emitAbilityEvent(AbilityEvent{SourceID: "missing-source", SkillName: "Fireball"})
			w.Mu.Unlock()
			if len(events) != 1 || events[0].InstanceID != "dungeon_cast-scene" || events[0].SourceID != p.ID {
				t.Fatalf("event lost creation-time scene or missing source emitted: %+v", events)
			}
		})
	}
}

func TestBasicAttackEventCapturesAdmissionScene(t *testing.T) {
	p := newTestPlayer("scene-attacker", "Fighter")
	p.InstanceID = "dungeon_attack-scene"
	target := &Entity{ID: "scene-target", Type: TypeEnemy, InstanceID: p.InstanceID, X: 1, Health: 100, MaxHealth: 100, State: "IDLE"}
	w := newPvPTestWorld(p, target)
	t.Cleanup(w.StopBackground)
	events := make(chan AttackEvent, 1)
	w.OnEvent = func(kind string, data interface{}) {
		if kind == "attack" {
			events <- data.(AttackEvent)
		}
	}
	if _, accepted := w.PerformAttack(p.ID, target.ID); !accepted {
		t.Fatal("valid basic attack rejected")
	}
	select {
	case event := <-events:
		if event.InstanceID != "dungeon_attack-scene" || event.SourceID != p.ID || event.TargetID != target.ID {
			t.Fatalf("attack event lost admission scene/identities: %+v", event)
		}
	default:
		t.Fatal("accepted basic attack emitted no animation event")
	}
}

func TestHazardEventCapturesOverworldScopeAndSkipsInstances(t *testing.T) {
	for _, scene := range []string{"", "dungeon_hazard-scene"} {
		t.Run(scene, func(t *testing.T) {
			p := newTestPlayer("hazard-recipient", "Fighter")
			p.InstanceID, p.X, p.Z = scene, 500, 500
			w := newPvPTestWorld(p)
			w.PlayerHazardTicks = make(map[string]map[string]float64)
			w.Hazards = map[string]*Hazard{"local-hazard": {ID: "local-hazard", HazardType: HazardLavaPool,
				X: p.X, Z: p.Z, Radius: 5, DamagePct: .01, TickInterval: 1}}
			var events []HazardDamageEvent
			w.OnEvent = func(kind string, data interface{}) {
				if kind == "hazard_damage" {
					events = append(events, data.(HazardDamageEvent))
				}
			}
			w.processHazardDamage(1, []*Entity{p})
			if scene == "" {
				if len(events) != 1 || events[0].InstanceID != scene || events[0].PlayerID != p.ID {
					t.Fatalf("overworld hazard lost captured scope: %+v", events)
				}
			} else if len(events) != 0 {
				t.Fatal("overworld hazard emitted for a dungeon player")
			}
		})
	}
}
