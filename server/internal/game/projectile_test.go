package game

import (
	"testing"
	"time"
)

func TestProjectilePiercing(t *testing.T) {
	w := NewWorld(nil)
	// Clear initial entities to avoid noise
	w.Entities = make(map[string]*Entity)
	w.Grid = NewSpatialMap(50.0)

	// 1. Setup Enemies in a line
	enemy1 := &Entity{
		ID:        "enemy-1",
		Type:      TypeEnemy,
		X:         5,
		Z:         0,
		Health:    100,
		MaxHealth: 100,
		Radius:    0.5,
	}
	enemy2 := &Entity{
		ID:        "enemy-2",
		Type:      TypeEnemy,
		X:         10,
		Z:         0,
		Health:    100,
		MaxHealth: 100,
		Radius:    0.5,
	}
	w.AddEntity(enemy1)
	w.AddEntity(enemy2)

	// 2. Setup Dagger Projectile
	// Moving along X axis, speed 10
	dagger := &Entity{
		ID:        "dagger-1",
		Type:      TypeProjectile,
		SubType:   "Dagger",
		X:         0,
		Z:         0,
		VelX:      10, // Will reach enemy1 (5) in 0.5s, enemy2 (10) in 1.0s
		VelZ:      0,
		Radius:    1.0,
		Damage:    10,
		OwnerID:   "player-1",
		CreatedAt: time.Now(),
	}
	w.AddEntity(dagger)

	// 3. Simulate
	// Step 1: Move 0.6s -> X=6. Should hit enemy1
	w.Update(0.6)

	if enemy1.Health >= 100 {
		t.Errorf("Enemy 1 should have taken damage. Health: %d", enemy1.Health)
	}
	if _, exists := w.Entities["dagger-1"]; !exists {
		t.Errorf("Dagger should persist after hitting enemy 1")
	}

	// Step 2: Move another 0.5s -> Total 1.1s -> X=11. Should hit enemy2
	w.Update(0.5)

	if enemy2.Health >= 100 {
		t.Errorf("Enemy 2 should have taken damage. Health: %d", enemy2.Health)
	}
	if _, exists := w.Entities["dagger-1"]; !exists {
		t.Errorf("Dagger should persist after hitting enemy 2")
	}

	// Verify Enemy 1 was not hit again (Health should be 90, not 80)
	// Damage is 10.
	if enemy1.Health != 90 {
		t.Errorf("Enemy 1 should be hit exactly once. Health: %d", enemy1.Health)
	}
}

func TestProjectileNonPiercing(t *testing.T) {
	w := NewWorld(nil)
	w.Entities = make(map[string]*Entity)
	w.Grid = NewSpatialMap(50.0)

	enemy1 := &Entity{
		ID:        "enemy-1",
		Type:      TypeEnemy,
		X:         5,
		Z:         0,
		Health:    100,
		MaxHealth: 100,
		Radius:    0.5,
	}
	w.AddEntity(enemy1)

	// Generic Projectile
	proj := &Entity{
		ID:        "arrow-1",
		Type:      TypeProjectile,
		SubType:   "Arrow", // Not Dagger
		X:         0,
		Z:         0,
		VelX:      10,
		VelZ:      0,
		Radius:    1.0,
		Damage:    10,
		OwnerID:   "player-1",
		CreatedAt: time.Now(),
	}
	w.AddEntity(proj)

	// Move past enemy
	w.Update(0.6)

	if enemy1.Health >= 100 {
		t.Errorf("Enemy should have taken damage")
	}
	if _, exists := w.Entities["arrow-1"]; exists {
		t.Errorf("Non-piercing projectile should be destroyed after hit")
	}
}

func TestProjectileHitListInitialization(t *testing.T) {
	// Ensure HitList is initialized correctly if nil
	w := NewWorld(nil)
	w.Entities = make(map[string]*Entity)
	w.Grid = NewSpatialMap(50.0)

	enemy := &Entity{
		ID:     "e1",
		Type:   TypeEnemy,
		X:      2,
		Z:      0,
		Health: 100,
	}
	w.AddEntity(enemy)

	dagger := &Entity{
		ID:        "d1",
		Type:      TypeProjectile,
		SubType:   "Dagger",
		X:         0,
		Z:         0,
		VelX:      10,
		Damage:    10,
		Radius:    1.0, // Set Radius
		HitList:   nil, // Explicitly nil
		CreatedAt: time.Now(),
	}
	w.AddEntity(dagger)

	w.Update(0.3) // Move to X=3, passing through X=2

	if dagger.HitList == nil {
		t.Error("HitList should be initialized after hit")
	}
	if !dagger.HitList["e1"] {
		t.Error("Enemy should be in HitList")
	}
}

func TestPiercingThrowWeakPointDamageBonus(t *testing.T) {
	newImpact := func(marked bool) int {
		w := NewWorld(nil)
		w.Entities = make(map[string]*Entity)
		w.Grid = NewSpatialMap(50.0)
		owner := newTestPlayer("rogue", "Rogue")
		target := &Entity{ID: "enemy", Type: TypeEnemy, X: 2, Health: 100, MaxHealth: 100, State: "IDLE", WeakPointMarked: marked}
		projectile := &Entity{
			ID: "dagger", Type: TypeProjectile, SubType: "Dagger", ProjectileSkill: "Piercing Throw",
			X: 0, VelX: 10, Radius: 1, Damage: 20, OwnerID: owner.ID, CreatedAt: time.Now(),
		}
		w.AddEntity(owner)
		w.AddEntity(target)
		w.AddEntity(projectile)
		w.Update(0.2)
		return 100 - target.Health
	}

	baseDamage := newImpact(false)
	markedDamage := newImpact(true)
	if markedDamage != baseDamage*3/2 {
		t.Fatalf("Weak Point did not add 50%% Piercing Throw damage: base=%d marked=%d", baseDamage, markedDamage)
	}
}

func TestFireballChainRedirectsAndKeepsAdditionalHitsAtHalfDamage(t *testing.T) {
	w := NewWorld(nil)
	w.Entities = make(map[string]*Entity)
	w.Grid = NewSpatialMap(50.0)
	owner := newTestPlayer("wizard-chain", "Wizard")
	first := &Entity{ID: "chain-first", Type: TypeEnemy, X: 2, Health: 1000, MaxHealth: 1000, State: "IDLE", Scale: 1}
	second := &Entity{ID: "chain-second", Type: TypeEnemy, X: 14, Health: 1000, MaxHealth: 1000, State: "IDLE", Scale: 1}
	projectile := &Entity{
		ID: "chain-fireball", Type: TypeProjectile, SubType: "Fireball", ProjectileSkill: "Fireball",
		X: 0, VelX: 20, Radius: 2, Damage: 20, OwnerID: owner.ID, CreatedAt: time.Now(),
		ProjectileRuneID: "fireball_chain", ProjectileBounces: 3,
	}
	w.AddEntity(owner)
	w.AddEntity(first)
	w.AddEntity(second)
	deferred := &deferredActions{}
	w.updateEntity(projectile, 0.1, nil, deferred)

	if len(deferred.removals) > 0 {
		t.Fatalf("chain fireball was removed instead of redirecting: %v", deferred.removals)
	}
	chained := projectile
	chained.Mu.RLock()
	bounces, damage, velX := chained.ProjectileBounces, chained.Damage, chained.VelX
	chained.Mu.RUnlock()
	if bounces != 2 || damage != 10 || velX <= 0 {
		t.Fatalf("unexpected first chain redirect: bounces=%d damage=%d velX=%v", bounces, damage, velX)
	}
}
