package game

import (
	"math"
	"testing"
	"time"
)

func TestElevatedProjectileAbilitiesSpawnAndTravelAboveGround(t *testing.T) {
	for _, tc := range []struct {
		class, skill string
		offset       float64
	}{
		{"Wizard", "Fireball", 1.5}, {"Wizard", "Flame Tornado", 1.5},
		{"Wizard", "Arcane Missiles", 1.5}, {"Wizard", "Dragonfire Lance", 1.5},
		{"Rogue", "Piercing Throw", 1}, {"Rogue", "Explosive Trap", .5},
		{"Cleric", "Consecrated Ground", .1}, {"Wizard", "Inferno Cataclysm", .1},
	} {
		t.Run(tc.skill, func(t *testing.T) {
			w, p := elevationMovementWorld(t)
			p.SubType, p.Level = tc.class, 100
			p.UnlockedSkills = []string{tc.skill}
			p.Mana, p.MaxMana = 10000, 10000
			if result := w.PerformAbility(p.ID, p.X+10, p.Z+3, "", tc.skill); !result.Accepted {
				t.Fatalf("cast rejected: %+v", result)
			}
			count := 0
			for _, projectile := range w.Entities {
				if projectile.Type != TypeProjectile {
					continue
				}
				count++
				for step := 0; step < 8; step++ {
					want := w.terrainElevation.sample(projectile.X, projectile.Z, "") + tc.offset
					if math.Abs(projectile.Y-want) > 1e-8 {
						t.Fatalf("%s y=%f want=%f", projectile.SubType, projectile.Y, want)
					}
					w.updateEntity(projectile, .05, nil, &deferredActions{})
				}
			}
			if count == 0 {
				t.Fatal("ability produced no projectile/zone")
			}
		})
	}
}

func TestElevatedFireballHitsAndMeteorLandsAtGround(t *testing.T) {
	w, p := elevationMovementWorld(t)
	p.SubType = "Wizard"
	p.Mana, p.MaxMana = 1000, 1000
	p.UnlockedSkills = []string{"Fireball", "Meteor Drop"}
	target := &Entity{ID: "hill-target", Type: TypeEnemy, X: p.X + 12, Z: p.Z, Health: 10000, MaxHealth: 10000, Radius: 1, State: "IDLE"}
	w.AddEntity(target)
	if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Fireball"); !result.Accepted {
		t.Fatal(result)
	}
	for _, e := range w.Entities {
		if e.Type != TypeProjectile {
			continue
		}
		for step := 0; step < 30 && target.Health == target.MaxHealth; step++ {
			w.updateEntity(e, .05, nil, &deferredActions{})
		}
	}
	if target.Health == target.MaxHealth {
		t.Fatal("elevated Fireball never damaged its target")
	}
	p.Level = 100
	p.LastAbilityTime = time.Now().Add(-time.Second)
	if result := w.PerformAbility(p.ID, target.X, target.Z, "", "Meteor Drop"); !result.Accepted {
		t.Fatal(result)
	}
	var meteor *Entity
	for _, e := range w.Entities {
		if e.SubType == "Meteor" {
			meteor = e
		}
	}
	if meteor == nil {
		t.Fatal("no meteor spawned")
	}
	ground := w.terrainElevation.sample(meteor.X, meteor.Z, "")
	if math.Abs(meteor.Y-ground-30) > 1e-8 {
		t.Fatal("meteor did not spawn above its landing")
	}
	meteor.LastAttackTime = time.Now().Add(700 * time.Millisecond)
	w.updateEntity(meteor, .01, nil, &deferredActions{})
	if meteor.Y <= ground+10 || meteor.Y >= ground+15 {
		t.Fatal("meteor descent ignored ground", meteor.Y, ground)
	}
	var impact ProjectileImpactEvent
	w.OnEvent = func(kind string, value interface{}) {
		if kind == "projectile_impact" {
			impact = value.(ProjectileImpactEvent)
		}
	}
	meteor.LastAttackTime = time.Now().Add(-time.Millisecond)
	w.updateEntity(meteor, .01, nil, &deferredActions{})
	if impact.ProjectileID != meteor.ID || impact.Y != ground || !impact.Terminal {
		t.Fatalf("incorrect impact: %+v", impact)
	}
}
