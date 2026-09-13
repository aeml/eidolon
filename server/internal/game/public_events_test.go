package game

import (
	"testing"
	"time"
)

func TestPublicEventChampionHealthSurvivesStatRecalculation(t *testing.T) {
	w, _, _ := publicEventFixture(0)
	w.Mu.Lock()
	w.publicEvent.Wave = 3
	w.spawnPublicEventWaveLocked(w.publicEvent, 4)
	champion := w.publicEvent.enemies[0]
	w.Mu.Unlock()
	maximum := champion.MaxHealth
	champion.Health -= 25
	champion.RecalculateStats()
	if champion.MaxHealth != maximum || champion.Health != maximum-25 {
		t.Fatalf("recalculation changed champion health: %d/%d, expected %d/%d", champion.Health, champion.MaxHealth, maximum-25, maximum)
	}
}

func publicEventFixture(realm int) (*World, *Entity, time.Time) {
	now := time.Unix(1800000000, 0).Truncate(4 * PublicEventPeriod).Add(time.Duration(realm)*PublicEventPeriod + time.Minute)
	_, site, _ := publicEventSchedule(now)
	w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50), Hazards: map[string]*Hazard{}, PlayerHazardTicks: map[string]map[string]float64{}}
	p := &Entity{ID: "hero", Type: TypePlayer, State: "IDLE", Level: site.Level, Health: 100, MaxHealth: 100, X: site.X, Z: site.Z, Gold: 100}
	w.AddEntity(p)
	w.UpdatePublicEvent(now)
	return w, p, now
}

func TestPublicEventsRotateWithoutRemoteActivationAndExpireOwnedEnemies(t *testing.T) {
	for i, site := range PublicEventSites() {
		w, p, now := publicEventFixture(i)
		if v := w.PublicEventSnapshot(); v.Site.ID != site.ID || v.Phase != "defending" || v.Remaining != 6 {
			t.Fatal("wrong scheduled encounter", v)
		}
		unrelated := &Entity{ID: "ordinary-enemy", Type: TypeEnemy, Health: 20}
		w.AddEntity(unrelated)
		w.UpdatePublicEvent(now.Add(8 * time.Minute))
		if w.PublicEventSnapshot().Phase != "expired" || w.Entities[unrelated.ID] != unrelated {
			t.Fatal("expiry touched unrelated world state")
		}
		for _, e := range w.Entities {
			if e.WorldEventID != "" {
				t.Fatal("expired event leaked enemy")
			}
		}
		p.InstanceID = "dungeon-other"
		w.UpdatePublicEvent(now.Add(PublicEventPeriod))
		if w.PublicEventSnapshot().Phase != "announced" || len(w.publicEvent.enemies) != 0 {
			t.Fatal("remote dungeon player activated event")
		}
	}
}

func TestPublicEventWardRulesRequireTheRealPositionAndMovement(t *testing.T) {
	for i := range PublicEventSites() {
		w, p, now := publicEventFixture(i)
		for _, enemy := range w.publicEvent.enemies {
			enemy.X, enemy.Z = p.X+40, p.Z
		}
		w.UpdatePublicEvent(now.Add(time.Second))
		view := w.PublicEventSnapshot()
		if i == 0 && view.Charge != 1 {
			t.Fatal("earth ward did not charge")
		}
		if i != 0 && view.Charge != 0 {
			t.Fatal("wrong rune position or stationary air player charged", view)
		}
		p.X, p.Z = view.RuneX, view.RuneZ
		if i == 2 {
			p.X += 17
		}
		if i == 3 {
			p.X++
		}
		w.UpdatePublicEvent(now.Add(2 * time.Second))
		if w.PublicEventSnapshot().Charge == 0 {
			t.Fatal("correct ward position did not contribute", i)
		}
		prior := w.PublicEventSnapshot().Charge
		p.Disconnected = true
		w.UpdatePublicEvent(now.Add(3 * time.Second))
		if w.PublicEventSnapshot().Charge != prior {
			t.Fatal("disconnected player contributed")
		}
	}
}

func TestPublicEventWholeEncounterCalmsHazardsWithoutCurrencyBonus(t *testing.T) {
	w, p, now := publicEventFixture(0)
	hazard := &Hazard{ID: "event-road-hazard", X: p.X, Z: p.Z, Radius: 6, DamagePct: .1, TickInterval: 1}
	w.Hazards[hazard.ID] = hazard
	w.AddEntity(&Entity{ID: hazard.ID, State: "IDLE"})
	for wave := 1; wave <= 3; wave++ {
		if w.publicEvent.Wave != wave {
			t.Fatal("skipped wave", w.publicEvent.Wave)
		}
		for _, enemy := range w.publicEvent.enemies {
			enemy.Health = 0
			enemy.State = "DEAD"
			w.RemoveEntity(enemy.ID)
		}
		// Retained death evidence survives corpse cleanup, but charge remains a
		// physical ward objective: killing alone does not advance the wave.
		for second := 0; second < 20; second++ {
			now = now.Add(time.Second)
			w.UpdatePublicEvent(now)
		}
	}
	if w.publicEvent.Phase != "champion" || len(w.publicEvent.enemies) != 1 {
		t.Fatal("champion not reached")
	}
	w.UpdatePublicEvent(now.Add(time.Second))
	if w.publicEvent.Phase == "complete" {
		t.Fatal("live champion auto-completed")
	}
	w.publicEvent.enemies[0].Health = 0
	w.publicEvent.enemies[0].State = "DEAD"
	now = now.Add(2 * time.Second)
	w.UpdatePublicEvent(now)
	if w.publicEvent.Phase != "complete" || hazard.SuppressedUntil != now.Add(5*time.Minute) || w.Entities[hazard.ID].State != "CALMED" || p.Gold != 100 {
		t.Fatal("bad completion consequences")
	}
	w.processHazardDamage(1, []*Entity{p})
	if p.Health != 100 {
		t.Fatal("calmed hazard still damaged player")
	}
	w.UpdatePublicEvent(now.Add(5 * time.Minute))
	if !hazard.SuppressedUntil.IsZero() || w.Entities[hazard.ID].State != "IDLE" {
		t.Fatal("hazard never recovered")
	}
}

func TestPublicEventEnemiesNeverRespawnAsOrdinaryMobs(t *testing.T) {
	w, _, _ := publicEventFixture(0)
	e := w.publicEvent.enemies[0]
	e.State = "DEAD"
	e.Health = 0
	e.LastAttackTime = time.Now().Add(-time.Minute)
	deferred := &deferredActions{}
	w.updateEntity(e, .1, nil, deferred)
	if e.State != "DEAD" || len(deferred.removals) != 1 {
		t.Fatal("temporary event monster respawned")
	}
}
