package game

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestDungeonRoomCheckpointWaitsForEveryConcurrentKillEffect(t *testing.T) {
	for _, worldLocked := range []bool{false, true} {
		t.Run(fmt.Sprint(worldLocked), func(t *testing.T) {
			w, instance, players, _ := frozenRoomRewardFixture(t, "")
			defer w.StopBackground()
			for _, player := range players {
				player.Quests = []Quest{{ID: "room-kills", Type: "KILL", Target: "Goblin", MaxCount: 2, Accepted: true}}
			}
			paused, release := make(chan struct{}), make(chan struct{})
			var releaseOnce sync.Once
			unblock := func() { releaseOnce.Do(func() { close(release) }) }
			defer unblock() // Release the paused actor before draining work on failure.
			w.OnQuestUpdate = func(playerID string, _ []Quest) {
				if playerID == players[0].ID {
					close(paused)
					<-release
				}
			}
			cleared := make(chan database.DungeonRoomRewardOperation, 2)
			w.OnDungeonRoomReward = func(op database.DungeonRoomRewardOperation) error {
				for _, player := range players[:2] {
					player.Mu.RLock()
					ready := player.Gold > 99 && player.Experience > 0 && player.Quests[0].Count == 1
					player.Mu.RUnlock()
					if !ready {
						t.Error("room checkpoint preceded an earned kill's currency or quest effects")
					}
				}
				cleared <- op
				return w.ConfirmDungeonRoomRewardProgress(op)
			}
			kill := func(index int) *Entity {
				enemy := &Entity{ID: fmt.Sprintf("concurrent-room-kill-%d", index), Type: TypeEnemy, SubType: "Goblin", Level: 40,
					InstanceID: instance.ID, X: 100, SpawnX: 100, Health: 1, MaxHealth: 1, State: "IDLE"}
				w.AddEntity(enemy)
				return enemy
			}
			first, second := kill(0), kill(1)
			die := func(enemy, player *Entity) {
				if worldLocked {
					w.Mu.Lock()
				}
				enemy.Mu.Lock()
				w.handleDeathWithWorldLock(enemy, player, nil, worldLocked)
				enemy.Mu.Unlock()
				if worldLocked {
					w.Mu.Unlock()
				}
			}
			die(first, players[0])
			select {
			case <-paused:
			case <-time.After(3 * time.Second):
				t.Fatal("first ordinary kill did not reach its quest mutation")
			}
			die(second, players[1])
			deadline := time.Now().Add(3 * time.Second)
			for {
				w.dungeonCombatRewardMu.Lock()
				_, secondPending := w.dungeonCombatRewards[second.ID]
				w.dungeonCombatRewardMu.Unlock()
				if !secondPending {
					break
				}
				if time.Now().After(deadline) {
					t.Fatal("independent kill failed to finish")
				}
				time.Sleep(time.Millisecond)
			}
			// Even removal of a transient corpse cannot erase its unfinished effects.
			w.Mu.Lock()
			delete(w.Entities, first.ID)
			w.Mu.Unlock()
			if w.markDungeonRoomClearedIfDefeated(instance.ID, second.ID, 100, 0) {
				t.Fatal("second death bypassed the first unfinished reward worker")
			}
			select {
			case <-cleared:
				t.Fatal("room acknowledged while an earlier kill was still pending")
			default:
			}
			unblock()
			w.StopBackground()
			if len(cleared) != 1 || !instance.RoomState.Rooms[1].Cleared || !instance.RoomState.Rooms[1].Rewarded {
				t.Fatal("finished concurrent kills did not produce exactly one confirmed room checkpoint")
			}
			w.dungeonCombatRewardMu.Lock()
			pending := len(w.dungeonCombatRewards)
			w.dungeonCombatRewardMu.Unlock()
			if pending != 0 {
				t.Fatal("finished deaths leaked reward reservations")
			}
		})
	}
}

func TestDungeonRoomPendingKillDoesNotBlockAnotherRoomOrInstance(t *testing.T) {
	w, instance, _, _ := frozenRoomRewardFixture(t, "")
	enemy := &Entity{ID: "other-room-pending", Type: TypeEnemy, InstanceID: instance.ID, SpawnX: 200}
	w.beginDungeonCombatRewardLocked(enemy)
	if w.dungeonRoomHasPendingCombatRewards(instance.ID, instance.Layout.Rooms[1]) ||
		w.dungeonRoomHasPendingCombatRewards("other-run", instance.Layout.Rooms[2]) ||
		!w.dungeonRoomHasPendingCombatRewards(instance.ID, instance.Layout.Rooms[2]) {
		t.Fatal("unfinished effects blocked the wrong encounter")
	}
	w.endDungeonCombatReward(enemy.ID)
	if w.dungeonRoomHasPendingCombatRewards(instance.ID, instance.Layout.Rooms[2]) {
		t.Fatal("finished effect remained pending")
	}
}
