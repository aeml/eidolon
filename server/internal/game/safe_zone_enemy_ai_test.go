package game

import "testing"

func TestEnemyAcquisitionUsesSceneScopedSafeZones(t *testing.T) {
	for _, tc := range []struct {
		name, scene string
		x, z        float64
		protected   bool
	}{
		{"town-interior", "", 0, 200, true},
		{"town-fence", "", 100, 200, true},
		{"future-shrine", "", 1005, 250, true},
		{"outside-shrine", "", 1011, 250, false},
		{"dungeon-town-coordinates", "test-dungeon", 0, 200, false},
		{"other-scene-shrine-coordinates", "test-dungeon", 1005, 250, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			w.SafeZones = NewSafeZoneRegistry()
			if err := w.SafeZones.Register(SafeZone{ID: "shrine", MinX: 1000, MaxX: 1010, MinZ: 240, MaxZ: 260}); err != nil {
				t.Fatal(err)
			}
			p := newTestPlayer("sanctuary-target", "Wizard")
			p.X, p.Z, p.InstanceID = tc.x, tc.z, tc.scene
			e := &Entity{ID: "sanctuary-observer", Type: TypeEnemy, SubType: "Skeleton", Level: 20,
				X: tc.x - 10, Z: tc.z, SpawnX: tc.x - 10, SpawnZ: tc.z,
				TargetX: tc.x - 15, TargetZ: tc.z, InstanceID: tc.scene,
				State: "IDLE", Health: 100, MaxHealth: 100, Speed: 3,
				Threat: map[string]float64{p.ID: 100}}
			w.AddEntity(p)
			w.AddEntity(e)
			w.updateEntity(e, .01, []*Entity{p}, &deferredActions{})
			chasing := e.TargetX > tc.x-10
			if chasing == tc.protected {
				t.Fatalf("protected=%v but chasing=%v (target %.3f, %.3f)", tc.protected, chasing, e.TargetX, e.TargetZ)
			}
		})
	}
}

func TestEnemyRoamingUsesSceneScopedSafeZones(t *testing.T) {
	for _, tc := range []struct {
		name, scene string
		chasing     bool
	}{{"overworld-roam", "", false}, {"instance-roam", "test-dungeon", false},
		{"overworld-chase", "", true}, {"instance-chase", "test-dungeon", true}} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			w.SafeZones = NewSafeZoneRegistry()
			if err := w.SafeZones.Register(SafeZone{ID: "shrine", MinX: 1000, MaxX: 1010, MinZ: 240, MaxZ: 260}); err != nil {
				t.Fatal(err)
			}
			e := &Entity{ID: "shrine-roamer", Type: TypeEnemy, SubType: "Skeleton", Level: 20,
				X: 999.5, Z: 250, SpawnX: 995, SpawnZ: 250, TargetX: 1005, TargetZ: 250,
				InstanceID: tc.scene, State: "MOVING", Health: 100, MaxHealth: 100, Speed: 3}
			w.AddEntity(e)
			var players []*Entity
			if tc.chasing {
				p := newTestPlayer("outside-shrine-target", "Wizard")
				p.X, p.Z, p.InstanceID = 1015, 250, tc.scene
				w.AddEntity(p)
				players = append(players, p)
			}
			w.updateEntity(e, .25, players, &deferredActions{})
			if tc.scene == "" && e.X != 999.5 {
				t.Fatal("enemy movement entered a registered sanctuary", e.X)
			}
			if tc.scene != "" && e.X <= 1000 {
				t.Fatal("overworld sanctuary blocked ordinary instance movement", e.X)
			}
		})
	}
}

func TestEnemySlamRechecksSanctuaryAtImpact(t *testing.T) {
	for _, protected := range []bool{true, false} {
		w := newTestWorld()
		w.SafeZones = NewSafeZoneRegistry()
		if err := w.SafeZones.Register(SafeZone{ID: "shrine", MinX: 1000, MaxX: 1010, MinZ: 240, MaxZ: 260}); err != nil {
			t.Fatal(err)
		}
		p := newTestPlayer("slam-target", "Wizard")
		p.X, p.Z, p.Health, p.MaxHealth, p.Defense = 998, 250, 100, 100, 0
		e := &Entity{ID: "sanctuary-slam", Type: TypeEnemy, SubType: "DemonOrc", Level: 30,
			X: 999, Z: 250, SpawnX: 999, SpawnZ: 250, Scale: 4,
			State: "IDLE", Health: 100, MaxHealth: 100, Damage: 10}
		w.AddEntity(p)
		w.AddEntity(e)
		w.updateEntity(e, .033, []*Entity{p}, &deferredActions{})
		if e.LastSpecialAttack.IsZero() {
			w.StopBackground()
			t.Fatal("ordinary enemy AI did not begin its slam")
		}
		if protected {
			w.Mu.Lock()
			p.Mu.Lock()
			p.X = 1001 // Move into safety during the actual two-second wind-up.
			p.Mu.Unlock()
			w.Mu.Unlock()
		}
		// Drain the admitted impact without cancelling its timer or advancing time.
		w.backgroundWork.SealWhenIdle()
		w.StopBackground()
		want := 90
		if protected {
			want = 100
		}
		if p.Health != want {
			t.Errorf("protected=%v: impact HP=%d, want%d", protected, p.Health, want)
		}
	}
}
