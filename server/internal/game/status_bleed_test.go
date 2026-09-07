package game

import (
	"testing"
	"time"
)

func TestBleedTickCadenceAndExpiryForActorTypes(t *testing.T) {
	for _, kind := range []EntityType{TypePlayer, TypeEnemy, TypeNPC} {
		t.Run(string(kind), func(t *testing.T) {
			w := newTestWorld()
			now := time.Now()
			e := &Entity{ID: "bleed-victim", Type: kind, State: "IDLE", Health: 100, MaxHealth: 100,
				Bleeding: true, BleedSourceID: "bleed-owner", BleedDamage: 7, BleedEndTime: now.Add(10 * time.Second)}
			var events []DamageEvent
			w.OnEvent = func(kind string, value interface{}) {
				if event, ok := value.(DamageEvent); kind == "damage" && ok {
					events = append(events, event)
				}
			}
			e.Mu.Lock()
			defer e.Mu.Unlock()
			w.tickBleedLocked(e, now, &deferredActions{})
			w.tickBleedLocked(e, now.Add(999*time.Millisecond), &deferredActions{})
			if e.Health != 93 || len(events) != 1 || events[0].SourceID != "bleed-owner" || events[0].Kind != "bleed" {
				t.Fatalf("invalid first tick/cadence: health=%d events=%+v", e.Health, events)
			}
			w.tickBleedLocked(e, now.Add(time.Second), &deferredActions{})
			if e.Health != 86 || len(events) != 2 {
				t.Fatal("second tick missing")
			}
			w.tickBleedLocked(e, now.Add(11*time.Second), &deferredActions{})
			if e.Bleeding || e.BleedSourceID != "" || e.Health != 86 || len(events) != 2 {
				t.Fatal("expired bleed did damage or retained status")
			}
		})
	}
}

func TestEnemyBleedKillCreditsOwnerOnce(t *testing.T) {
	w := newTestWorld()
	owner := newTestPlayer("bleed-killer", "Rogue")
	owner.Level, owner.X, owner.Z = 1, 50000, 50000
	owner.MaxExperience = 1000000
	w.AddEntity(owner)
	now := time.Now()
	e := &Entity{ID: "bleed-kill-target", Type: TypeEnemy, SubType: "Skeleton", Level: 1,
		X: owner.X + 2, Z: owner.Z, State: "IDLE", Health: 5, MaxHealth: 100,
		Bleeding: true, BleedDamage: 7, BleedSourceID: owner.ID, BleedEndTime: now.Add(10 * time.Second)}
	w.AddEntity(e)
	deferred := &deferredActions{}
	e.Mu.Lock()
	w.tickBleedLocked(e, now, deferred)
	if e.State != "DEAD" || e.Health != 0 {
		e.Mu.Unlock()
		t.Fatal("lethal bleed did not resolve death")
	}
	w.tickBleedLocked(e, now.Add(time.Second), deferred)
	e.Mu.Unlock()
	// Kill rewards intentionally run asynchronously. Observe the normal reward
	// path under the owner lock instead of racing the reward goroutine.
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
	if xp != 20 {
		t.Fatalf("kill credit missing or duplicated: XP=%d, want 20", xp)
	}
}
