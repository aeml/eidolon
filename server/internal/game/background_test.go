package game

import (
	"testing"
	"time"
)

func TestWorldStopCancelsRealPendingAttack(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("stop-attacker", "Wizard")
	player.X, player.Z, player.AttackCooldown = 200, 200, 10*time.Second
	enemy := &Entity{ID: "stop-target", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE", X: 205, Z: 200, Health: 100, MaxHealth: 100}
	w.AddEntity(player)
	w.AddEntity(enemy)
	if _, ok := w.PerformAttack(player.ID, enemy.ID); !ok {
		t.Fatal("real attack was not admitted")
	}
	started := time.Now()
	w.StopBackground()
	if time.Since(started) > time.Second {
		t.Fatal("shutdown waited for the attack timer instead of cancelling it")
	}
	if enemy.Health != 100 {
		t.Fatal("cancelled attack applied damage")
	}
	if w.runBackground(func() { t.Error("late mutation") }) {
		t.Fatal("closed world accepted late work")
	}
}

func TestWorldStopDrainsNestedEarnedCompletions(t *testing.T) {
	w := newTestWorld()
	entered, release, stopped := make(chan struct{}), make(chan struct{}), make(chan struct{})
	gold := 0
	w.runBackground(func() {
		close(entered)
		<-release
		w.runBackground(func() { gold += 43 })
	})
	<-entered
	go func() { w.StopBackground(); close(stopped) }()
	<-w.backgroundDone()
	select {
	case <-stopped:
		t.Fatal("earned completion was discarded")
	default:
	}
	close(release)
	select {
	case <-stopped:
	case <-time.After(time.Second):
		t.Fatal("nested completion drain stuck")
	}
	if gold != 43 {
		t.Fatal("nested earned reward did not finish")
	}
}

func TestWorldStopCancelsActiveCrystalVigil(t *testing.T) {
	w := NewWorld(nil)
	w.InstanceLayouts["shutdown-raid"] = &DungeonInstance{ID: "shutdown-raid", DungeonType: "earth_crystal_raid", RunLevel: 70, Difficulty: DifficultyNormal}
	started := make(chan struct{}, 1)
	w.OnEvent = func(kind string, value interface{}) {
		if kind == "crystal_repair" && value.(CrystalRepairEvent).Stage == "wave_start" {
			started <- struct{}{}
		}
	}
	if !w.StartCrystalRepair("shutdown-raid", "earth_crystal_raid", []string{"hero"}, 20000, 20000) {
		t.Fatal("vigil did not start")
	}
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("vigil never reached a live wave")
	}
	w.StopBackground()
	state := w.CrystalRepairs["shutdown-raid"]
	if state.Completed || state.Wave != 1 {
		t.Fatal("shutdown awarded an unfinished repair")
	}
}

func TestShutdownPvPCancelsUnfinishedButPreservesDecidedMatch(t *testing.T) {
	for _, decided := range []bool{false, true} {
		t.Run(map[bool]string{false: "unfinished", true: "decided"}[decided], func(t *testing.T) {
			a := &Entity{ID: "a", Type: TypePlayer, X: 12, Z: 20, MaxMana: 100}
			b := &Entity{ID: "b", Type: TypePlayer, X: 15, Z: 20, MaxMana: 100}
			w := newPvPTestWorld(a, b)
			match := startTestPvPMatch(w, PvPModeArena1v1, []string{a.ID}, []string{b.ID})
			if decided {
				w.PvP.Matches[match.ID].FirstTo = 1
				w.ResolvePvPDeath(b.ID, a.ID) // Schedules a delayed result callback.
			}
			w.StopBackground()
			w.FinishPvPForShutdown()
			if w.HasPvPMatch(a.ID) || a.InstanceID != "" || b.InstanceID != "" || a.X != 12 || b.X != 15 || a.Mana != 100 {
				t.Fatal("shutdown did not use the existing PvP exit/restoration path")
			}
			if len(w.PvP.DeserterUntil) != 0 {
				t.Fatal("maintenance applied a deserter penalty")
			}
			if !decided && len(w.PvP.Profiles) != 0 {
				t.Fatal("unfinished match awarded ranked results")
			}
			if decided && (w.PvP.Profiles[a.ID].Wins != 1 || w.PvP.Profiles[b.ID].Losses != 1) {
				t.Fatal("already decided ranked result lost")
			}
			w.FinishPvPForShutdown()
			if decided && w.PvP.Profiles[a.ID].Wins != 1 {
				t.Fatal("shutdown duplicated ranked result")
			}
		})
	}
}
