package game

import (
	"math"
	"testing"
	"time"
)

func TestStarterPursuitReturnsHomeWithoutHealingOrTeleport(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("traveler", "Wizard")
	p.X, p.Z = 261, -26
	e := &Entity{ID: "Skeleton-lanternhold-0", Type: TypeEnemy, SubType: "Skeleton", Level: 1,
		State: "MOVING", Health: 16, MaxHealth: 30, X: 255, Z: -26, SpawnX: 125, SpawnZ: 180,
		TargetX: p.X, TargetZ: p.Z, Speed: 5.4, AttackCooldown: time.Second,
		Threat: map[string]float64{p.ID: 100}}
	w.AddEntity(p)
	w.AddEntity(e)
	before := math.Hypot(e.X-e.SpawnX, e.Z-e.SpawnZ)
	w.updateEntity(e, .1, []*Entity{p}, &deferredActions{})
	after := math.Hypot(e.X-e.SpawnX, e.Z-e.SpawnZ)
	if math.Abs(before-after-.54) > 1e-8 || e.TargetX != e.SpawnX || e.TargetZ != e.SpawnZ {
		t.Fatalf("starter did not walk home at its normal speed: %+v", e)
	}
	if e.Health != 16 || e.State != "MOVING" || !w.CanDamage(p, e) {
		t.Fatal("returning enemy healed, became immune, or stopped moving")
	}
}

func TestStarterPursuitStillDefendsNearbyPlayers(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("nearby", "Wizard")
	p.X, p.Z = 180, 200
	e := &Entity{ID: "road", Type: TypeEnemy, SubType: "Skeleton", Level: 1,
		State: "IDLE", Health: 20, MaxHealth: 30, X: 170, Z: 200, SpawnX: 125, SpawnZ: 200,
		Speed: 5.4, AttackCooldown: time.Second, Threat: map[string]float64{p.ID: 100}}
	w.AddEntity(p)
	w.AddEntity(e)
	w.updateEntity(e, .1, []*Entity{p}, &deferredActions{})
	if e.X <= 170 || e.Health != 20 {
		t.Fatal("nearby provoked starter stopped defending its encounter")
	}
}

func TestStarterPursuitDoesNotChangeOtherEncounters(t *testing.T) {
	base := Entity{ID: "road", Type: TypeEnemy, SubType: "Skeleton", Level: 1}
	if starterPursuitRadius(&base) != 60 {
		t.Fatal("missing starter encounter boundary")
	}
	for _, change := range []func(*Entity){
		func(e *Entity) { e.InstanceID = "dungeon_verdant" },
		func(e *Entity) { e.InstanceID = "earth_crystal_raid" },
		func(e *Entity) { e.Level = 10 },
		func(e *Entity) { e.ID = "elite-road" },
		func(e *Entity) { e.Scale = 4 },
		func(e *Entity) { e.OwnerID = "summoner" },
		func(e *Entity) { e.Type = TypePlayer },
		func(e *Entity) { e.SubType = "DemonOrc" },
	} {
		e := Entity{ID: base.ID, Type: base.Type, SubType: base.SubType, Level: base.Level}
		change(&e)
		if starterPursuitRadius(&e) != 0 {
			t.Fatal("unrelated encounter changed")
		}
	}
}

func TestStarterPursuitCannotAccumulateAcrossTheRoad(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("retreating-traveler", "Wizard")
	e := &Entity{ID: "road", Type: TypeEnemy, SubType: "Skeleton", Level: 1,
		State: "MOVING", Health: 16, MaxHealth: 30, X: 130, Z: 200, SpawnX: 125, SpawnZ: 200,
		Speed: 5.4, AttackCooldown: time.Second, Threat: map[string]float64{p.ID: 100}}
	w.AddEntity(p)
	w.AddEntity(e)
	for step := 0; step < 600; step++ {
		p.X, p.Z = 140+float64(step)*.5, 200
		w.updateEntity(e, .1, []*Entity{p}, &deferredActions{})
		if math.Hypot(e.X-e.SpawnX, e.Z-e.SpawnZ) > 62 {
			t.Fatal("starter followed a continuous retreat out of its encounter")
		}
	}
	if math.Hypot(e.X-e.SpawnX, e.Z-e.SpawnZ) > 11 || e.Health != 16 {
		t.Fatal("starter did not resume its damaged local patrol")
	}
}
