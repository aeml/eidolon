package game

import "testing"

func TestEnemyBasicImpactRechecksReachAfterWindup(t *testing.T) {
	for _, tc := range []struct {
		name, subtype                string
		distance, scale, targetScale float64
		wantHit                      bool
	}{
		{"ordinary contact", "Skeleton", 3, 1, 1, true},
		{"escaped swing", "Skeleton", 3.01, 1, 1, false},
		{"retreated across road", "Skeleton", 15, 1, 1, false},
		{"boss contact", "RootboundWarden", 7.5, 4, 1, true},
		{"escaped boss", "RootboundWarden", 7.51, 4, 1, false},
		{"large target", "Skeleton", 4.5, 1, 2, true},
		{"salesman contact", "DwarfSalesman", 6, 1, 1, true},
		{"escaped salesman", "DwarfSalesman", 6.01, 1, 1, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("impact-target", "Wizard")
			p.X, p.Z, p.Health, p.MaxHealth, p.Defense = 300, 200, 100, 100, 0
			p.Scale = tc.targetScale
			enemy := &Entity{ID: "impact-enemy", Type: TypeEnemy, SubType: tc.subtype,
				X: 301, Z: 200, Health: 100, MaxHealth: 100, Damage: 10, Scale: tc.scale, State: "IDLE"}
			w.AddEntity(p)
			w.AddEntity(enemy)
			// Begins in legal melee contact, then changes during the wind-up.
			// Invoke the real post-delay path synchronously, not a timer guess.
			p.X = enemy.X + tc.distance
			events := 0
			w.OnEvent = func(kind string, _ interface{}) {
				if kind == "damage" {
					events++
				}
			}
			w.applyAttackImpact(enemy.ID, p.ID, "", nil, 0)
			if got := p.Health < 100; got != tc.wantHit || (events > 0) != tc.wantHit {
				t.Fatalf("hit=%v hp=%d events=%d wantHit=%v", got, p.Health, events, tc.wantHit)
			}
		})
	}
}
