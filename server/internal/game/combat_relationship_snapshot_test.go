package game

import (
	"sync"
	"testing"
)

func TestAttackImpactRelationshipPreservesCombatRules(t *testing.T) {
	for _, tc := range []struct {
		name                                          string
		kind                                          EntityType
		town, differentInstance, party, flagged, want bool
	}{
		{"hostile-enemy", TypeEnemy, false, false, false, false, true},
		{"town-enemy", TypeEnemy, true, false, false, false, false},
		{"other-instance", TypeEnemy, false, true, false, false, false},
		{"friendly-npc", TypeNPC, false, false, false, false, false},
		{"unflagged-player", TypePlayer, false, false, false, false, false},
		{"flagged-player", TypePlayer, false, false, false, true, true},
		{"flagged-town", TypePlayer, true, false, false, true, false},
		{"flagged-party", TypePlayer, false, false, true, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := &Entity{ID: "a", Type: TypePlayer, X: 800, Z: 250}
			b := &Entity{ID: "b", Type: tc.kind, X: 801, Z: 250}
			if tc.town {
				a.X, a.Z, b.X, b.Z = 0, 200, 1, 200
			}
			if tc.differentInstance {
				b.InstanceID = "another-instance"
			}
			if tc.party {
				a.PartyID, b.PartyID = "party", "party"
			}
			w := newPvPTestWorld(a, b)
			w.PvP.OpenWorldFlag[a.ID], w.PvP.OpenWorldFlag[b.ID] = tc.flagged, tc.flagged
			if got := w.canDamageAtImpact(a.ID, b.ID); got != tc.want {
				t.Fatalf("damage permission = %v, want %v", got, tc.want)
			}
			if w.canDamageAtImpact(a.ID, a.ID) || w.canDamageAtImpact(a.ID, "missing") {
				t.Fatal("self or absent target became attackable")
			}
		})
	}
}

func BenchmarkAttackImpactRelationshipSnapshot(b *testing.B) {
	a := &Entity{ID: "a", Type: TypePlayer, X: 800, Z: 250}
	target := &Entity{ID: "b", Type: TypeEnemy, X: 801, Z: 250}
	w := newPvPTestWorld(a, target)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if !w.canDamageAtImpact(a.ID, target.ID) {
			b.Fatal("hostile target lost")
		}
	}
}

func TestAttackImpactRelationshipWhileActorsTransition(t *testing.T) {
	a := &Entity{ID: "a", Type: TypePlayer, X: 200, Z: 200}
	b := &Entity{ID: "b", Type: TypePlayer, X: 201, Z: 200}
	w := newPvPTestWorld(a, b)
	var writers sync.WaitGroup
	start := make(chan struct{})
	for _, actor := range []*Entity{a, b} {
		writers.Add(1)
		go func(actor *Entity) {
			defer writers.Done()
			<-start
			for i := 0; i < 2000; i++ {
				// Same ownership order as scene restoration. No PvP consent is
				// granted: every delayed impact must remain harmless.
				w.Mu.Lock()
				actor.Mu.Lock()
				actor.InstanceID = []string{"", "finished-arena"}[i%2]
				actor.X, actor.Z = float64(i%300), float64(i%400)
				actor.PartyID = []string{"", "allies"}[i%2]
				actor.Mu.Unlock()
				w.Mu.Unlock()
			}
		}(actor)
	}
	close(start)
	for i := 0; i < 2000; i++ {
		w.applyAttackImpact(a.ID, b.ID, "finished-arena", nil, 0)
	}
	writers.Wait()
	if a.Health != a.MaxHealth || b.Health != b.MaxHealth {
		t.Fatal("a stale impact damaged players without PvP consent")
	}
}
