package game

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestBossVictoryDeathHandoffPrecedesAllLegacyRewardsAndCheckpoint(t *testing.T) {
	for _, reject := range []bool{true, false} {
		t.Run(fmt.Sprint(reject), func(t *testing.T) {
			w, instance, players, input := bossVictoryCaptureFixture(t)
			party := w.CreateParty(players[0].ID)
			for _, player := range players[1:] {
				if err := w.JoinParty(party.ID, player.ID); err != nil {
					t.Fatal(err)
				}
			}
			beforeGold := players[0].Gold
			seen := make(chan database.BossVictoryOperation, 1)
			w.OnBossReward = func(RewardSummaryEvent, *WeeklyRaidCompletionEvent) error {
				t.Error("shared boss handoff also entered the old post-grant save path")
				return nil
			}
			w.OnEvent = func(kind string, value interface{}) {
				if kind == "inventory_update" || kind == "reward_summary" || kind == "weekly_raid_complete" {
					t.Error("shared handoff published unsaved legacy reward feedback")
				}
			}
			w.OnBossVictory = func(op database.BossVictoryOperation) error {
				// Lock-taking APIs prove the actual worker released scene locks.
				player := w.GetEntityCopy(players[0].ID)
				instance.Mu.RLock()
				cleared := instance.RoomState.Rooms[1].Cleared
				instance.Mu.RUnlock()
				if cleared || player.Gold != beforeGold || player.Quests[0].Count != 2 || len(player.PendingBossLoot) != 0 || len(op.Participants) != 4 || op.Validate() != nil {
					t.Error("handoff followed unsaved credits/checkpoint or lost a downed member")
				}
				if reject {
					seen <- op
					return errors.New("shared preparation acknowledgement unknown")
				}
				// Modeled boundary only; root tests cover strong-save replies.
				if err := w.RetainConfirmedBossVictoryPlan(op); err != nil {
					return err
				}
				if err := w.ConfirmBossVictoryProgress(op); err != nil {
					return err
				}
				for _, participant := range op.Participants {
					if found, _, changed, err := w.ApplyBossVictoryCharacterEffect(participant.PlayerID, op); !found || !changed || err != nil {
						return fmt.Errorf("recipient apply: found=%v changed=%v err=%v", found, changed, err)
					}
				}
				seen <- op
				return nil
			}
			boss := &Entity{ID: input.bossID, SubType: input.bossType, Type: TypeEnemy, InstanceID: instance.ID,
				Level: 30, X: 100, SpawnX: 100, Health: 1, MaxHealth: 1, State: "IDLE"}
			w.AddEntity(boss)
			boss.Mu.Lock()
			w.handleDeath(boss, players[0], nil)
			boss.Mu.Unlock()
			var op database.BossVictoryOperation
			select {
			case op = <-seen:
			case <-time.After(3 * time.Second):
				t.Fatal("death worker did not reach unlocked shared-victory handoff")
			}
			w.StopBackground()
			if reject {
				if instance.RoomState.Rooms[1].Cleared || players[0].Gold != beforeGold || players[0].Quests[0].Count != 2 || !w.dungeonRoomHasPendingCombatRewards(instance.ID, instance.Layout.Rooms[1]) {
					t.Fatal("unknown preparation fell through to grants or released reservation")
				}
			} else {
				participant, _ := database.BossVictoryRecipientFor(op, players[0].Name)
				if !instance.RoomState.Rooms[1].Cleared || players[0].Gold != beforeGold+participant.Gold || players[0].Quests[0].Count != 3 || w.dungeonRoomHasPendingCombatRewards(instance.ID, instance.Layout.Rooms[1]) {
					t.Fatal("accepted effect doubled legacy credit or stranded reservation")
				}
			}
			w.Mu.RLock()
			defer w.Mu.RUnlock()
			for _, entity := range w.Entities {
				if entity.Type == TypeLoot && entity.InstanceID == instance.ID {
					t.Fatal("shared handoff also published random legacy ground drops")
				}
			}
		})
	}
}
