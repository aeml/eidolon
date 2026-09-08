package game

import (
	"testing"
	"time"
)

func TestPoisonTickCadenceAndExpiryForActorTypes(t *testing.T) {
	for _, kind := range []EntityType{TypePlayer, TypeEnemy, TypeNPC} {
		t.Run(string(kind), func(t *testing.T) {
			w := newTestWorld()
			now := time.Now()
			e := &Entity{ID: "poison-victim", Type: kind, State: "IDLE", Health: 100, MaxHealth: 100,
				Poisoned: true, PoisonSourceID: "poison-owner", PoisonDamage: 7, PoisonEndTime: now.Add(10 * time.Second)}
			var events []DamageEvent
			w.OnEvent = func(kind string, value interface{}) {
				if event, ok := value.(DamageEvent); kind == "damage" && ok {
					events = append(events, event)
				}
			}
			e.Mu.Lock()
			defer e.Mu.Unlock()
			w.tickPoisonLocked(e, now, &deferredActions{})
			w.tickPoisonLocked(e, now.Add(999*time.Millisecond), &deferredActions{})
			if e.Health != 93 || len(events) != 1 || events[0].SourceID != "poison-owner" || events[0].Kind != "poison" || e.LastDamageType != "poison" {
				t.Fatalf("invalid poison cadence/event: health=%d events=%+v", e.Health, events)
			}
			w.tickPoisonLocked(e, now.Add(time.Second), &deferredActions{})
			if e.Health != 86 || len(events) != 2 {
				t.Fatal("second poison tick missing")
			}
			w.tickPoisonLocked(e, now.Add(11*time.Second), &deferredActions{})
			if e.Poisoned || e.PoisonSourceID != "" || e.Health != 86 || len(events) != 2 {
				t.Fatal("expired poison damaged or retained status")
			}
		})
	}
}

func TestPoisonKillCreditsOwnerAndDoesNotFollowLethalBleed(t *testing.T) {
	for _, bleedFirst := range []bool{false, true} {
		w := newTestWorld()
		owner := newTestPlayer("dot-killer", "Rogue")
		owner.Level, owner.X, owner.Z, owner.MaxExperience = 1, 50000, 50000, 1000000
		w.AddEntity(owner)
		now := time.Now()
		e := &Entity{ID: "poison-kill-target", Type: TypeEnemy, SubType: "Skeleton", Level: 1,
			X: owner.X + 2, Z: owner.Z, State: "IDLE", Health: 5, MaxHealth: 100,
			Poisoned: true, PoisonDamage: 7, PoisonSourceID: owner.ID, PoisonEndTime: now.Add(10 * time.Second),
			Bleeding: bleedFirst, BleedDamage: 7, BleedSourceID: owner.ID, BleedEndTime: now.Add(10 * time.Second)}
		w.AddEntity(e)
		var events []DamageEvent
		w.OnEvent = func(kind string, value interface{}) {
			if event, ok := value.(DamageEvent); kind == "damage" && ok {
				events = append(events, event)
			}
		}
		w.updateEntity(e, .05, []*Entity{owner}, &deferredActions{})
		if e.State != "DEAD" || e.Health != 0 || len(events) != 1 {
			t.Fatalf("one lethal status produced incorrect death/events: health=%d events=%+v", e.Health, events)
		}
		wantKind := "poison"
		if bleedFirst {
			wantKind = "bleed"
		}
		if events[0].Kind != wantKind || events[0].SourceID != owner.ID {
			t.Fatalf("wrong lethal attribution: %+v", events)
		}
		xp := 0
		deadline := time.Now().Add(2 * time.Second)
		for time.Now().Before(deadline) {
			owner.Mu.RLock()
			xp = owner.Experience
			owner.Mu.RUnlock()
			if xp > 0 {
				break
			}
			time.Sleep(time.Millisecond)
		}
		// Exactly one level-one ordinary-enemy reward under curve 2.
		if xp != 10 {
			t.Fatalf("incorrect asynchronous kill credit: %d", xp)
		}
	}
}

func TestLethalPoisonPreservesDivineIntervention(t *testing.T) {
	w := newTestWorld()
	now := time.Now()
	e := newTestPlayer("poison-protected", "Cleric")
	e.Health, e.MaxHealth = 5, 100
	e.Poisoned, e.PoisonDamage, e.PoisonEndTime = true, 7, now.Add(10*time.Second)
	e.DivineInterventionActive, e.DivineInterventionEndTime = true, now.Add(time.Minute)
	e.Mu.Lock()
	defer e.Mu.Unlock()
	w.tickPoisonLocked(e, now, &deferredActions{})
	if e.State == "DEAD" || e.Health != 30 || e.DivineInterventionActive {
		t.Fatal("poison bypassed lethal-damage prevention")
	}
}
