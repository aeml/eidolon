package game

import (
	"fmt"
	"testing"
	"time"
)

func TestPaidShieldSlamEnemyStunStopsMovementAndExpires(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("stun-lifecycle-caster", "Fighter")
	p.Level, p.InstanceID, p.X, p.Z = 100, "qa-stun-lifecycle", 60000, 60000
	p.BaseStats = InitialPlayerStats()
	p.UnlockedSkills = []string{"Shield Slam"}
	p.TalentRanks = map[string]int{"FTR_30": 5, "FTR_37": 5}
	p.RecalculateStats()
	p.Mana = p.MaxMana
	w.AddEntity(p)
	e := &Entity{ID: "stun-lifecycle-enemy", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
		State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: 1, Radius: 1.25,
		X: p.X + 4, Z: p.Z, SpawnX: p.X + 4, SpawnZ: p.Z, Speed: 8, Damage: 10}
	w.AddEntity(e)
	if result := w.PerformAbility(p.ID, e.X, e.Z, e.ID, "Shield Slam"); !result.Accepted || !e.Stunned || e.Health >= e.MaxHealth {
		t.Fatal("ordinary paid damaging stun was not applied")
	}
	x, z, lastAttack := e.X, e.Z, e.LastAttackTime
	w.updateEntity(e, .25, []*Entity{p}, &deferredActions{})
	if !e.Stunned || e.X != x || e.Z != z || e.LastAttackTime != lastAttack {
		t.Errorf("stunned enemy moved or attacked before deadline: (%v,%v) -> (%v,%v)", x, z, e.X, e.Z)
	}
	// Move the captured deadline into the past, then exercise the normal tick.
	// The cast-duration matrix separately proves each deadline's real length.
	e.StunEndTime = time.Now().Add(-time.Millisecond)
	w.updateEntity(e, .25, []*Entity{p}, &deferredActions{})
	if e.Stunned {
		t.Error("enemy stun flag survived its deadline")
	}
	if e.X == x && e.Z == z && e.LastAttackTime == lastAttack {
		t.Error("enemy did not resume normal combat/pursuit after stun expired")
	}
}

func TestStunnedActorsStillTakeDamageOverTime(t *testing.T) {
	for _, kind := range []EntityType{TypeEnemy, TypeNPC} {
		t.Run(string(kind), func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			e := &Entity{ID: "stunned-dot", Type: kind, State: "IDLE", Health: 100, MaxHealth: 100,
				Stunned: true, StunEndTime: time.Now().Add(time.Second), Poisoned: true, PoisonDamage: 7,
				PoisonEndTime: time.Now().Add(time.Second)}
			w.AddEntity(e)
			w.updateEntity(e, .1, nil, &deferredActions{})
			if !e.Stunned || e.Health != 93 {
				t.Fatalf("stun suppressed poison: stunned=%v hp=%d", e.Stunned, e.Health)
			}
			e.StunEndTime = time.Now().Add(-time.Millisecond)
			w.updateEntity(e, .1, nil, &deferredActions{})
			if e.Stunned {
				t.Fatal("actor retained expired stun")
			}
		})
	}
}

func TestStunnedSeraphStillExpiresAndCleansUpOwnerLoss(t *testing.T) {
	for _, condition := range []string{"active", "expired", "owner-dead", "owner-disconnected", "owner-moved"} {
		t.Run(condition, func(t *testing.T) {
			w, owner, seraph, target := paidSeraphFixture(t, nil)
			defer w.StopBackground()
			seraph.Stunned, seraph.StunEndTime = true, time.Now().Add(time.Minute)
			switch condition {
			case "expired":
				seraph.CreatedAt = time.Now().Add(-seraph.SummonDuration - time.Second)
			case "owner-dead":
				owner.State = "DEAD"
			case "owner-disconnected":
				owner.Disconnected = true
			case "owner-moved":
				owner.InstanceID = "another-instance"
			}
			x, z := seraph.X, seraph.Z
			deferred := &deferredActions{}
			w.updateEntity(seraph, .25, []*Entity{owner}, deferred)
			if target.Health != target.MaxHealth || seraph.X != x || seraph.Z != z {
				t.Fatal("stunned summon attacked or moved")
			}
			if containsPlayer(deferred.removals, seraph.ID) != (condition != "active") {
				t.Fatalf("stun changed summon cleanup: %v", deferred.removals)
			}
		})
	}
}

func TestTrainedShieldSlamRetainsImmunityAndTargetExclusions(t *testing.T) {
	for _, exclusion := range []string{"immune", "dead", "other-instance", "ally"} {
		t.Run(exclusion, func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", true)
			defer w.StopBackground()
			p.Level, p.UnlockedSkills = 100, []string{"Shield Slam"}
			p.TalentRanks = map[string]int{"FTR_30": 5, "FTR_37": 5}
			p.Mana = 200
			excluded := &Entity{ID: fmt.Sprintf("excluded-%s", exclusion), Type: TypeEnemy,
				InstanceID: p.InstanceID, State: "IDLE", X: target.X, Z: target.Z,
				Health: 10000, MaxHealth: 10000, Scale: 1}
			switch exclusion {
			case "immune":
				excluded.CCImmune = true
			case "dead":
				excluded.State = "DEAD"
			case "other-instance":
				excluded.InstanceID = "other-instance"
			case "ally":
				excluded.Type = TypePlayer
			}
			w.AddEntity(excluded)
			result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shield Slam")
			if !result.Accepted || !target.Stunned || target.Health >= target.MaxHealth || p.Mana != 175 {
				t.Fatal("paid positive control failed")
			}
			if excluded.Stunned || !excluded.StunEndTime.IsZero() || (excluded.Health < excluded.MaxHealth) != (exclusion == "immune") {
				t.Fatalf("excluded target changed: stun=%v hp=%d", excluded.Stunned, excluded.Health)
			}
		})
	}
}
