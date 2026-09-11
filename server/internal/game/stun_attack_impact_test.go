package game

import (
	"testing"
	"time"
)

func TestPaidStunBlocksAlreadyStartedEnemySwing(t *testing.T) {
	for _, expired := range []bool{false, true} {
		name := "active stun cancels impact"
		if expired {
			name = "expired stun permits impact"
		}
		t.Run(name, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			p := newTestPlayer("stun-impact-target", "Fighter")
			p.Level, p.InstanceID, p.X, p.Z = 100, "qa-stun-impact", 60000, 60000
			p.UnlockedSkills = []string{"Shield Slam"}
			p.Mana, p.Health, p.MaxHealth, p.Defense = 200, 100, 100, 0
			w.AddEntity(p)
			e := &Entity{ID: "stun-impact-enemy", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
				State: "IDLE", X: p.X + 2, Z: p.Z, SpawnX: p.X + 2, SpawnZ: p.Z,
				Health: 10000, MaxHealth: 10000, Damage: 10, Scale: 1, AttackCooldown: time.Hour}
			w.AddEntity(e)
			if _, ok := w.PerformAttack(e.ID, p.ID); !ok {
				t.Fatal("ordinary enemy wind-up was not accepted")
			}
			if result := w.PerformAbility(p.ID, e.X, e.Z, e.ID, "Shield Slam"); !result.Accepted || !e.Stunned {
				t.Fatal("ordinary paid stun was not accepted during enemy wind-up")
			}
			if expired {
				e.StunEndTime = time.Now().Add(-time.Millisecond)
				w.updateEntity(e, 0, nil, &deferredActions{})
				if e.Stunned {
					t.Fatal("normal expiry did not release stun")
				}
			}
			health := p.Health
			// Exercise the actual post-wind-up path synchronously. The hour-long
			// fixture cooldown keeps its scheduled callback from racing this
			// check; StopBackground cancels that owned pending callback.
			w.applyAttackImpact(e.ID, p.ID, p.InstanceID, nil, 0)
			if damaged := p.Health < health; damaged != expired {
				t.Fatalf("post-wind-up impact damaged=%v with expired=%v", damaged, expired)
			}
		})
	}
}
