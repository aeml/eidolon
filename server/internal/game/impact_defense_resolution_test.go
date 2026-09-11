package game

import (
	"testing"
	"time"
)

func TestImpactDefenseResolutionCapturesBrokenShieldBeforeRecast(t *testing.T) {
	target := &Entity{ID: "defender", Type: TypePlayer, X: 12, Z: 34, InstanceID: "original",
		Health: 100, ArcaneShieldActive: true, ArcaneShieldHP: 50,
		ArcaneShieldAbsorbed: 20, ArcaneShieldRuneID: "arcaneshield_explosive"}
	target.ArcaneShieldEndTime = time.Now().Add(time.Minute)
	target.Mu.Lock()
	defer target.Mu.Unlock()
	resolved := resolveImpactDefenseLocked(target, 75, time.Now())
	if resolved.damage != 25 || resolved.reflection != 0 || resolved.explosion == nil {
		t.Fatalf("unexpected resolution: %+v", resolved)
	}
	if target.Health != 100 || target.ArcaneShieldHP != 0 || target.ArcaneShieldActive || target.ArcaneShieldAbsorbed != 0 {
		t.Fatal("resolver applied HP damage or failed to commit depletion")
	}
	// A subsequent cast/movement must not rewrite the already-earned reaction.
	target.ArcaneShieldHP, target.ArcaneShieldActive, target.ArcaneShieldRuneID = 200, true, "arcaneshield_reflective"
	target.X, target.Z, target.InstanceID = 56, 78, "new-scene"
	if *resolved.explosion != (impactShieldExplosion{damage: 70, x: 12, z: 34, instanceID: "original", ownerID: "defender"}) {
		t.Fatal("recast or movement changed captured explosion")
	}
}

func TestImpactDefenseResolutionReturnsReflectionWithoutApplyingIt(t *testing.T) {
	target := &Entity{Type: TypePlayer, Health: 100, ArcaneShieldActive: true,
		ArcaneShieldHP: 100, ArcaneShieldRuneID: "arcaneshield_reflective"}
	target.ArcaneShieldEndTime = time.Now().Add(time.Minute)
	target.Mu.Lock()
	defer target.Mu.Unlock()
	resolved := resolveImpactDefenseLocked(target, 75, time.Now())
	if resolved.damage != 0 || resolved.reflection != 22 || resolved.explosion != nil || target.ArcaneShieldHP != 25 || target.ArcaneShieldAbsorbed != 75 || target.Health != 100 {
		t.Fatalf("unexpected reflective resolution: %+v", resolved)
	}
}

func TestImpactDefenseResolutionProtectionDoesNotSpendShield(t *testing.T) {
	now := time.Now()
	target := &Entity{Type: TypePlayer, Health: 100, ArcaneShieldActive: true,
		ArcaneShieldHP: 100, ArcaneShieldRuneID: "arcaneshield_reflective", InvulnerableEndTime: now.Add(time.Second)}
	target.ArcaneShieldEndTime = now.Add(time.Minute)
	target.Mu.Lock()
	defer target.Mu.Unlock()
	resolved := resolveImpactDefenseLocked(target, 75, now)
	if resolved.damage != 0 || resolved.reflection != 0 || resolved.explosion != nil || target.ArcaneShieldHP != 100 || target.ArcaneShieldAbsorbed != 0 {
		t.Fatalf("protection consumed shield or earned retaliation: %+v", resolved)
	}
}
