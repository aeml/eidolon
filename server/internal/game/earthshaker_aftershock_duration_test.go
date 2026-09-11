package game

import (
	"testing"
	"time"
)

func TestTrainedAftershockRetainsCastDurationAndDoesNotShortenInitialStun(t *testing.T) {
	w, p, original := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Earthshaker"}
	p.BaseStats = InitialPlayerStats()
	p.TalentRanks = map[string]int{"FTR_30": 5, "FTR_37": 5}
	p.SkillRunes = map[string]string{"Earthshaker": "earthshaker_aftershock"}
	p.RecalculateStats()
	p.Mana = p.MaxMana
	late := &Entity{ID: "aftershock-late-target", Type: TypeEnemy, InstanceID: p.InstanceID,
		X: p.X + 10, Z: p.Z, State: "IDLE", Scale: 1, Health: 10000, MaxHealth: 10000}
	w.AddEntity(late)
	type receipt struct {
		id                 string
		observed, deadline time.Time
	}
	hits := make(chan receipt, 8)
	w.OnEvent = func(kind string, value interface{}) {
		if kind != "damage" {
			return
		}
		event, ok := value.(DamageEvent)
		if !ok || event.SourceID != p.ID {
			return
		}
		target := original
		if event.TargetID == late.ID {
			target = late
		} else if event.TargetID != original.ID {
			return
		}
		target.Mu.RLock()
		entry := receipt{target.ID, time.Now(), target.StunEndTime}
		target.Mu.RUnlock()
		hits <- entry
	}
	if result := w.PerformAbility(p.ID, original.X, original.Z, original.ID, "Earthshaker"); !result.Accepted {
		t.Fatal("paid Earthshaker cast failed")
	}
	var initial receipt
	select {
	case initial = <-hits: // Initial damage is synchronous with the accepted cast.
	default:
		t.Fatal("accepted initial cast did not produce its damage event")
	}
	if initial.id != original.ID || late.Stunned {
		t.Fatal("initial wave fixture is invalid")
	}
	// Between the real initial and delayed waves, change the build and bring a
	// previously unaffected enemy into range. No callback or timer is simulated.
	w.Mu.Lock()
	p.Mu.Lock()
	p.TalentRanks = nil
	p.RecalculateStats()
	p.Mu.Unlock()
	late.Mu.Lock()
	oldX, oldZ := late.X, late.Z
	late.X, late.Z = p.X+1, p.Z
	w.Grid.Update(late, oldX, oldZ)
	late.Mu.Unlock()
	w.Mu.Unlock()
	timer := time.NewTimer(5 * time.Second)
	defer timer.Stop()
	seen := map[string]bool{}
	for len(seen) < 2 {
		select {
		case entry := <-hits:
			if seen[entry.id] {
				t.Fatal("duplicate delayed wave hit")
			}
			seen[entry.id] = true
			if entry.id == original.ID && entry.deadline.Before(initial.deadline) {
				t.Error("aftershock shortened the longer trained initial stun")
			}
			if entry.id == late.ID {
				remaining := entry.deadline.Sub(entry.observed)
				// Allow event observation latency, but reject a recomputed untrained
				// 1s stun; the delayed wave must retain the original 1.35s cast bonus.
				if remaining <= 1100*time.Millisecond || remaining > 1350*time.Millisecond {
					t.Errorf("late target stun=%v, expected original trained duration", remaining)
				}
			}
		case <-timer.C:
			t.Fatal("real delayed wave failed to reach both targets")
		}
	}
}
