package game

import "testing"

func TestTownRecoveryCancelsOldDungeonForcedMovement(t *testing.T) {
	for _, respawn := range []bool{false, true} {
		w := NewWorld(nil)
		player := newTestPlayer("town-recovery", "Fighter")
		player.InstanceID = "old-dungeon"
		player.X, player.Y, player.Z = 20000, 7, 20000
		player.IsCharging = true
		player.ChargeStartX, player.ChargeStartZ = 20000, 20000
		player.ChargeTargetX, player.ChargeTargetZ = 20030, 20000
		player.JumpDuration, player.JumpElapsed, player.JumpProgress = 0.35, 0.2, 0.5
		player.TargetID = "old-boss"
		w.AddEntity(player)
		if respawn {
			w.PerformRespawn(player.ID)
		} else {
			w.PerformRecall(player.ID)
		}
		w.updateEntity(player, 0.05, nil, &deferredActions{})
		if player.IsCharging || player.JumpDuration != 0 || player.TargetID != "" || player.InstanceID != "" || player.X != -1.25 || player.Y != 0 || player.Z != 200 {
			t.Fatalf("respawn=%t old movement survived town recovery: x=%f y=%f z=%f charging=%t jump=%f target=%s", respawn, player.X, player.Y, player.Z, player.IsCharging, player.JumpDuration, player.TargetID)
		}
	}
}
