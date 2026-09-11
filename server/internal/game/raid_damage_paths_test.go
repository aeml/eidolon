package game

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

// Isolate the real post-wind-up damage paths, as the wall-impact tests do.
// Prepared health/damage values make the boundary crossing deterministic; this
// is mechanical server coverage, not earned gear or browser-controlled combat.
func raidDamagePathFixture(t *testing.T) (*World, *Entity, *Entity, *[]DamageEvent) {
	t.Helper()
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	boss := &Entity{ID: "phase-king", Type: TypeEnemy, SubType: "UmbraPrime", InstanceID: "phase-damage",
		State: "IDLE", Health: 1000, MaxHealth: 1000, Damage: 10000, Scale: 1, X: 20000, Z: 20000}
	player := newTestPlayer("phase-defender", "Fighter")
	player.InstanceID, player.X, player.Z = boss.InstanceID, boss.X+1, boss.Z
	player.Health, player.MaxHealth, player.Defense = 100000, 100000, 0
	w.AddEntity(boss)
	w.AddEntity(player)
	w.updateDarkKingPhase(boss, []*Entity{player})
	events := []DamageEvent{}
	w.OnEvent = func(kind string, data interface{}) {
		if kind == "damage" {
			events = append(events, data.(DamageEvent))
		}
	}
	return w, boss, player, &events
}

func requirePhaseBoundaryEvent(t *testing.T, boss *Entity, events []DamageEvent, kind string, amount int) {
	t.Helper()
	if boss.Health != 750 || boss.RaidPhase != 1 || boss.State == "DEAD" {
		t.Fatal("damage bypassed the unannounced second phase", boss.Health, boss.RaidPhase, boss.State)
	}
	for _, event := range events {
		if event.TargetID == boss.ID && event.Kind == kind && event.Amount == amount && event.InstanceID == boss.InstanceID {
			return
		}
	}
	t.Fatalf("missing actual applied %s damage=%d to boss; events=%+v", kind, amount, events)
}

func TestDarkKingRealReflectionHonorsPhaseAndReportsAppliedDamage(t *testing.T) {
	w, boss, player, events := raidDamagePathFixture(t)
	player.ActiveSetBonuses = map[string]map[string]int{"phase-reflection": {"damageReflect": 1}}
	w.applyAttackImpact(boss.ID, player.ID, boss.InstanceID, nil, 0)
	if player.Health >= player.MaxHealth {
		t.Fatal("fixture did not receive the real attack needed for reflection")
	}
	requirePhaseBoundaryEvent(t, boss, *events, "reflect", 250)
	*events = nil
	w.applyAttackImpact(boss.ID, player.ID, boss.InstanceID, nil, 0)
	requirePhaseBoundaryEvent(t, boss, *events, "reflect", 0)
}

func TestDarkKingRealShieldExplosionHonorsPhaseWithoutCappingOtherTargets(t *testing.T) {
	w, boss, player, events := raidDamagePathFixture(t)
	ordinary := &Entity{ID: "shield-bystander", Type: TypeEnemy, SubType: "Skeleton", InstanceID: boss.InstanceID,
		State: "IDLE", Health: 10000, MaxHealth: 10000, X: boss.X + 3, Z: boss.Z}
	w.AddEntity(ordinary)
	player.ArcaneShieldActive, player.ArcaneShieldHP = true, 1000
	player.ArcaneShieldEndTime = time.Now().Add(time.Minute)
	player.ArcaneShieldRuneID = "arcaneshield_explosive"
	w.applyAttackImpact(boss.ID, player.ID, boss.InstanceID, nil, 0)
	requirePhaseBoundaryEvent(t, boss, *events, "arcane", 250)
	if player.ArcaneShieldActive || ordinary.Health != 9000 {
		t.Fatal("real shield break did not retain full explosion damage on ordinary enemies", player.ArcaneShieldActive, ordinary.Health)
	}
}

func TestDarkKingRealOnKillExplosionHonorsPhaseWithoutCappingOtherTargets(t *testing.T) {
	w, boss, player, events := raidDamagePathFixture(t)
	player.Damage = 2000
	player.ActiveUniqueEffects = []string{"explosive"}
	victim := &Entity{ID: "explosive-victim", Type: TypeEnemy, SubType: "Skeleton", InstanceID: boss.InstanceID,
		State: "IDLE", Level: 1, Health: 10, MaxHealth: 10, X: boss.X + 2, Z: boss.Z}
	ordinary := &Entity{ID: "kill-bystander", Type: TypeEnemy, SubType: "Skeleton", InstanceID: boss.InstanceID,
		State: "IDLE", Health: 10000, MaxHealth: 10000, X: boss.X + 3, Z: boss.Z}
	w.AddEntity(victim)
	w.AddEntity(ordinary)
	w.applyAttackImpact(player.ID, victim.ID, boss.InstanceID, nil, 0)
	requirePhaseBoundaryEvent(t, boss, *events, "physical", 250)
	if victim.State != "DEAD" || ordinary.Health != 9000 {
		t.Fatal("real killing blow did not retain full explosion damage on ordinary enemies", victim.State, ordinary.Health)
	}
}

func TestDarkKingRealOnKillExplosionChainsOncePerDeath(t *testing.T) {
	w, boss, player, events := raidDamagePathFixture(t)
	player.Damage = 2000
	player.ActiveUniqueEffects = []string{"explosive"}
	victims := make([]*Entity, 3)
	for i := range victims {
		victims[i] = &Entity{ID: fmt.Sprintf("chain-victim-%d", i), Type: TypeEnemy, SubType: "Skeleton",
			InstanceID: boss.InstanceID, State: "IDLE", Level: 1, Health: 10, MaxHealth: 10,
			X: boss.X + 2, Z: boss.Z}
		w.AddEntity(victims[i])
	}
	ordinary := &Entity{ID: "chain-bystander", Type: TypeEnemy, SubType: "Skeleton", InstanceID: boss.InstanceID,
		State: "IDLE", Health: 10000, MaxHealth: 10000, X: boss.X + 3, Z: boss.Z}
	otherInstance := &Entity{ID: "other-instance", Type: TypeEnemy, SubType: "Skeleton", InstanceID: "elsewhere",
		State: "IDLE", Health: 10000, MaxHealth: 10000, X: ordinary.X, Z: ordinary.Z}
	w.AddEntity(ordinary)
	w.AddEntity(otherInstance)
	w.applyAttackImpact(player.ID, victims[0].ID, boss.InstanceID, nil, 0)
	w.StopBackground()
	for _, victim := range victims {
		if victim.State != "DEAD" || victim.Health != 0 {
			t.Fatalf("chain did not kill %s exactly: %s/%d", victim.ID, victim.State, victim.Health)
		}
	}
	requirePhaseBoundaryEvent(t, boss, *events, "physical", 250)
	if ordinary.Health != 7000 || otherInstance.Health != 10000 {
		t.Fatalf("expected three in-instance explosions only, got %d/%d", ordinary.Health, otherInstance.Health)
	}
	count := 0
	for _, event := range *events {
		if event.TargetID == ordinary.ID {
			count++
			if event.Amount != 1000 {
				t.Fatalf("chain changed ordinary explosion damage: %+v", event)
			}
		}
	}
	if count != len(victims) {
		t.Fatalf("expected one explosion per death, got %d", count)
	}
}

func TestDarkKingRealConcurrentExplosiveKillsFinishWithoutDuplicateExplosions(t *testing.T) {
	w, boss, player, _ := raidDamagePathFixture(t)
	player.Damage = 2000
	player.ActiveUniqueEffects = []string{"explosive"}
	var eventMu sync.Mutex
	events := []DamageEvent{}
	w.OnEvent = func(kind string, data interface{}) {
		if kind == "damage" {
			eventMu.Lock()
			events = append(events, data.(DamageEvent))
			eventMu.Unlock()
		}
	}
	victims := make([]*Entity, 8)
	for i := range victims {
		victims[i] = &Entity{ID: fmt.Sprintf("concurrent-victim-%d", i), Type: TypeEnemy, SubType: "Skeleton",
			InstanceID: boss.InstanceID, State: "IDLE", Level: 1, Health: 10, MaxHealth: 10,
			X: boss.X + 2, Z: boss.Z}
		w.AddEntity(victims[i])
	}
	ordinary := &Entity{ID: "concurrent-bystander", Type: TypeEnemy, SubType: "Skeleton", InstanceID: boss.InstanceID,
		State: "IDLE", Health: 10000, MaxHealth: 10000, X: boss.X + 3, Z: boss.Z}
	w.AddEntity(ordinary)
	start := make(chan struct{})
	var workers sync.WaitGroup
	for _, victim := range victims {
		workers.Add(1)
		go func(id string) {
			defer workers.Done()
			<-start
			w.applyAttackImpact(player.ID, id, boss.InstanceID, nil, 0)
		}(victim.ID)
	}
	close(start)
	workers.Wait()
	w.StopBackground()
	for _, victim := range victims {
		if victim.State != "DEAD" || victim.Health != 0 {
			t.Fatalf("concurrent kill incomplete: %s %s/%d", victim.ID, victim.State, victim.Health)
		}
	}
	if ordinary.Health != 2000 {
		t.Fatalf("expected eight explosions exactly, got bystander health %d", ordinary.Health)
	}
	requirePhaseBoundaryEvent(t, boss, events, "physical", 250)
}
