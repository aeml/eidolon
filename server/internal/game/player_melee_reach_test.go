package game

import "testing"

func TestPlayerMeleeAdmissionAndImpactUseBodyReach(t *testing.T) {
	for _, class := range []string{"Fighter", "Cleric"} {
		for _, distance := range []float64{3, 3.001, 4, 8} {
			t.Run(class+"/admission", func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("melee-attacker", class)
				p.X, p.Z = 300, 200
				e := &Entity{ID: "melee-target", Type: TypeEnemy, SubType: "Skeleton", X: 300 + distance, Z: 200, Health: 100, MaxHealth: 100, Scale: 1, State: "IDLE"}
				w.AddEntity(p)
				w.AddEntity(e)
				_, accepted := w.PerformAttack(p.ID, e.ID)
				if accepted != (distance <= 3) {
					t.Fatalf("distance %v accepted=%v", distance, accepted)
				}
			})
			t.Run(class+"/impact", func(t *testing.T) {
				w := newTestWorld()
				p := newTestPlayer("melee-attacker", class)
				p.X, p.Z, p.Damage = 300, 200, 20
				e := &Entity{ID: "melee-target", Type: TypeEnemy, SubType: "Skeleton", X: 300 + distance, Z: 200, Health: 100, MaxHealth: 100, Scale: 1, State: "IDLE"}
				w.AddEntity(p)
				w.AddEntity(e)
				w.applyAttackImpact(p.ID, e.ID, "", nil, 0)
				if hit := e.Health < 100; hit != (distance <= 3) {
					t.Fatalf("distance %v hit=%v", distance, hit)
				}
			})
		}
	}
}

func TestPlayerBasicReachUsesAuthoritativeLargeBodyAndRetainsRangedClasses(t *testing.T) {
	for _, tc := range []struct {
		class                                          string
		radius, targetRadius, scale, targetScale, want float64
	}{
		{"Fighter", 1.25, 8, 1, 4, 9.75}, {"Cleric", 2.5, 3.75, 2, 3, 6.75},
		{"Wizard", 1.25, 1.25, 1, 1, 16}, {"Rogue", 1.25, 1.25, 1, 1, 16},
	} {
		if got := basicAttackReach(TypePlayer, tc.class, tc.scale, tc.targetScale, tc.radius, tc.targetRadius); got != tc.want {
			t.Fatalf("%s reach %v want %v", tc.class, got, tc.want)
		}
	}
}
