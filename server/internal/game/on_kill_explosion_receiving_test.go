package game

import (
	"fmt"
	"testing"
	"time"
)

// Trigger the actual gear effect through normal attack admission and its
// scheduled killing blow. These fixtures test mechanics, not earned gear.
func killWithExplosiveGear(t *testing.T, w *World, source, victim *Entity) {
	t.Helper()
	source.Damage = 1000
	source.ActiveUniqueEffects = []string{"explosive"}
	source.AttackCooldown = 100 * time.Millisecond
	if _, accepted := w.PerformAttack(source.ID, victim.ID); !accepted {
		t.Fatal("ordinary killing attack rejected")
	}
	w.backgroundWork.SealWhenIdle()
	if victim.State != "DEAD" || victim.Health != 0 {
		t.Fatal("real attack did not trigger a death")
	}
}

func TestGearExplosionRespectsDungeonWalls(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprintf("doorway=%v", doorway), func(t *testing.T) {
			w, source, beyond := directSkillWallFixture("Fighter", doorway)
			t.Cleanup(w.StopBackground)
			victim := &Entity{ID: "gear-corpse", Type: TypeEnemy, SubType: "Skeleton", InstanceID: source.InstanceID,
				X: source.X - 1, Z: source.Z, State: "IDLE", Health: 1, MaxHealth: 1}
			near := &Entity{ID: "gear-same-side", Type: TypeEnemy, SubType: "Imp", InstanceID: source.InstanceID,
				X: source.X - 2, Z: source.Z, State: "IDLE", Health: 10000, MaxHealth: 10000}
			w.AddEntity(victim)
			w.AddEntity(near)
			killWithExplosiveGear(t, w, source, victim)
			if near.Health != 9500 {
				t.Fatal("same-side positive control lost the stored 50% damage budget", near.Health)
			}
			want := 10000
			if doorway {
				want = 9500
			}
			if beyond.Health != want {
				t.Fatalf("explosion crossed a wall or failed through a doorway: hp=%d want=%d", beyond.Health, want)
			}
		})
	}
}

func TestGearExplosionUsesBodyRadiusAndEnemyOnlyRecipients(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	source := newTestPlayer("gear-source", "Fighter")
	source.InstanceID, source.X = "gear-radius", 20000
	w.AddEntity(source)
	victim := &Entity{ID: "gear-corpse", Type: TypeEnemy, SubType: "Skeleton", InstanceID: source.InstanceID,
		X: source.X + 1, State: "IDLE", Health: 1, MaxHealth: 1}
	w.AddEntity(victim)
	for i, tc := range []struct {
		dx, dz float64
		kind   EntityType
		want   int
	}{
		{6.2, 0, TypeEnemy, 9500}, // Body overlaps the five-unit blast.
		{6.3, 0, TypeEnemy, 10000},
		{4.9, 4.9, TypeEnemy, 10000}, // Inside grid cells, outside circular reach.
		{1, 0, TypePlayer, 10000},
		{2, 0, TypeNPC, 10000},
	} {
		target := &Entity{ID: fmt.Sprintf("gear-recipient-%d", i), Type: tc.kind, SubType: "Imp", InstanceID: source.InstanceID,
			X: victim.X + tc.dx, Z: victim.Z + tc.dz, State: "IDLE", Scale: 1, Health: 10000, MaxHealth: 10000}
		w.AddEntity(target)
		defer func() {
			if target.Health != tc.want {
				t.Errorf("recipient%d hp=%d want=%d", i, target.Health, tc.want)
			}
		}()
	}
	killWithExplosiveGear(t, w, source, victim)
}

func TestGearExplosionUsesReceivingStateAndThreatWithoutRerolling(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	source := newTestPlayer("gear-source", "Fighter")
	source.InstanceID, source.X, source.CritChanceBonus = "gear-receiving", 20000, 1
	w.AddEntity(source)
	victim := &Entity{ID: "gear-corpse", Type: TypeEnemy, SubType: "Skeleton", InstanceID: source.InstanceID,
		X: source.X + 1, State: "IDLE", Health: 1, MaxHealth: 1}
	target := &Entity{ID: "gear-receiver", Type: TypeEnemy, SubType: "Imp", InstanceID: source.InstanceID,
		X: source.X + 2, State: "IDLE", Health: 10000, MaxHealth: 10000,
		SanctuaryDamageReduction: true, SanctuaryEndTime: time.Now().Add(time.Minute),
		ActiveUniqueEffects: []string{"thorns"}}
	w.AddEntity(victim)
	w.AddEntity(target)
	killWithExplosiveGear(t, w, source, victim)
	if target.Health != 9600 || source.Health != 460 || target.Threat[source.ID] != 400 {
		t.Fatalf("stored explosion skipped defenses/threat or rerolled outgoing: target=%d source=%d threat=%v", target.Health, source.Health, target.Threat)
	}
}

func TestPaidSmiteGearExplosionPreservesLethalReflectionAndCastReceipt(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	source := newTestPlayer("smite-gear-source", "Cleric")
	source.InstanceID, source.X = "smite-gear", 20000
	source.Health, source.Damage = 1, 1000
	source.UnlockedSkills = []string{"Smite"}
	source.ActiveUniqueEffects = []string{"explosive"}
	victim := &Entity{ID: "smite-gear-corpse", Type: TypeEnemy, SubType: "Skeleton", InstanceID: source.InstanceID,
		X: source.X + 2, State: "IDLE", Health: 1, MaxHealth: 1}
	receiver := &Entity{ID: "smite-gear-receiver", Type: TypeEnemy, SubType: "Imp", InstanceID: source.InstanceID,
		X: source.X + 4, State: "IDLE", Health: 10000, MaxHealth: 10000,
		ActiveUniqueEffects: []string{"thorns"}}
	for _, actor := range []*Entity{source, victim, receiver} {
		w.AddEntity(actor)
	}
	mana := source.Mana
	result := w.PerformAbility(source.ID, victim.X, victim.Z, victim.ID, "Smite")
	if !result.Accepted || result.CooldownRemaining <= 0 || source.Mana >= mana {
		t.Fatalf("world-locked paid killing cast lost its receipt: %+v", result)
	}
	if victim.State != "DEAD" || receiver.Health != 9500 || source.State != "DEAD" || source.Health != 0 {
		t.Fatalf("lethal reaction or cast bookkeeping disagreed: victim=%s receiver=%d source=%s/%d", victim.State, receiver.Health, source.State, source.Health)
	}
}
