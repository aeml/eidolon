package game

import (
	"testing"
	"time"
)

func TestWithinAbilityRadius_FireballUsesTargetVisualRadius(t *testing.T) {
	target := &Entity{Type: TypeEnemy, X: 11.0, Z: 0, Scale: 1.0}

	if !withinAbilityRadius("Fireball", 0, 0, target, 10.0) {
		t.Fatal("expected fireball AoE to include target visual radius")
	}
}

func TestWithinAbilityRadius_UsesTargetVisualRadius(t *testing.T) {
	target := &Entity{Type: TypeEnemy, X: 11.0, Z: 0, Scale: 1.0}

	if !withinAbilityRadius("Frost Nova", 0, 0, target, 10.0) {
		t.Fatal("expected non-fireball AoE to include target visual radius")
	}
}

func TestGravityWell_HitsTargetInsideVisualEdge(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("wizard", "Wizard")
	player.Stats.Intelligence = 20
	enemy := &Entity{
		ID:        "enemy-1",
		Type:      TypeEnemy,
		SubType:   "Skeleton",
		X:         9.0,
		Z:         0,
		Health:    200,
		MaxHealth: 200,
		State:     "IDLE",
		Scale:     1.0,
	}

	w.AddEntity(player)
	w.AddEntity(enemy)

	w.performWizardAbility(player, 0, 0, "", "Gravity Well", func(time.Duration) {})

	if enemy.Health >= 200 {
		t.Fatal("expected gravity well to damage enemy inside the visual radius")
	}
}

func TestMeteorDrop_HitsTargetNearRingEdge(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("wizard", "Wizard")
	player.Stats.Intelligence = 20
	enemy := &Entity{
		ID:        "enemy-meteor",
		Type:      TypeEnemy,
		SubType:   "Skeleton",
		X:         19.0,
		Z:         0,
		Health:    400,
		MaxHealth: 400,
		State:     "IDLE",
		Scale:     1.0,
	}

	w.AddEntity(player)
	w.AddEntity(enemy)

	w.performWizardAbility(player, 0, 0, "", "Meteor Drop", func(time.Duration) {})

	deferred := &deferredActions{}
	for _, entity := range w.Entities {
		if entity.SubType == "Meteor" {
			entity.LastAttackTime = time.Now().Add(-time.Millisecond)
			w.updateEntity(entity, 0.016, nil, deferred)
			break
		}
	}

	if enemy.Health >= 400 {
		t.Fatal("expected meteor drop to damage target near the visual ring edge")
	}
}
