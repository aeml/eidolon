package main

import (
	"encoding/json"
	"errors"
	"testing"

	"eidolon-server/internal/game"
)

func adminTeleportRecoveryFixture(t *testing.T) (*adminRecoveryStore, *testCharacterCommitter, *game.Entity) {
	t.Helper()
	store, committer := setupAdminRecovery(t, game.AdminGrant{Action: MsgAdminTeleport})
	world = game.NewWorld(nil)
	player := &game.Entity{ID: "player-recipient", Name: "recipient", Type: game.TypePlayer,
		SubType: "Wizard", Level: 30, Health: 17, Mana: 9, Gold: 100, State: "IDLE", X: 40, Z: 250}
	world.AddEntity(player)
	plan, err := world.PlanAdminTeleport(player.ID, "town", "")
	if err != nil {
		t.Fatal(err)
	}
	store.op.Payload, err = json.Marshal(plan)
	if err != nil {
		t.Fatal(err)
	}
	return store, committer, player
}

func TestAdminTeleportFullSaveRecoveryDoesNotMoveTwice(t *testing.T) {
	store, committer, player := adminTeleportRecoveryFixture(t)
	committer.fail = errors.New("database unavailable")
	if _, err := completeAdminOperationLocked(store.op); err == nil {
		t.Fatal("failed save acknowledged")
	}
	if player.X != -1.25 || player.Z != 200 || store.finishes != 0 {
		t.Fatal("wrong landing or premature audit")
	}
	pending, err := characterSaveJournal.Read("recipient")
	if err != nil || pending == nil {
		t.Fatal("teleport missing durable character snapshot", err)
	}
	saved, err := pending.Character()
	if err != nil || saved.AdminOperationReceipts[store.op.ID] != store.op.Fingerprint || saved.Gold != 100 || saved.Resources.Health != 17 || saved.Resources.Mana != 9 {
		t.Fatal("teleport receipt lost or resources changed", err)
	}
	// Newer authoritative state must survive recovery and audit retries.
	player.X, player.Z, player.Health, player.State = 40, 250, 0, "DEAD"
	committer.fail = nil
	store.finishError = errors.New("audit unavailable")
	if _, err := completeAdminOperationLocked(store.op); err == nil {
		t.Fatal("audit failure acknowledged")
	}
	store.finishError = nil
	completed, err := completeAdminOperationLocked(store.op)
	if err != nil || completed.Audit.Result != "success" || len(committer.ids) != 2 || player.X != 40 || player.Health != 0 {
		t.Fatal("audit recovery resaved, moved or revived recipient", err)
	}
	finishes := store.finishes
	if _, err := completeAdminOperationLocked(store.op); err != nil || len(committer.ids) != 2 || store.finishes != finishes {
		t.Fatal("completed replay performed work", err)
	}
}

func TestAdminTeleportRestartAcknowledgesSavedEffectButNeverMovesOfflinePlayer(t *testing.T) {
	for _, applied := range []bool{false, true} {
		t.Run(map[bool]string{false: "unapplied", true: "saved-before-crash"}[applied], func(t *testing.T) {
			store, committer, player := adminTeleportRecoveryFixture(t)
			store.character = characterSnapshotForSave("recipient", player)
			if applied {
				committer.fail = errors.New("database unavailable")
				if _, err := completeAdminOperationLocked(store.op); err == nil {
					t.Fatal("failed save acknowledged")
				}
			}
			world = nil
			failedCharacterSaves.users = make(map[string]bool)
			committer.fail = nil
			completed, err := completeAdminOperationLocked(store.op)
			if err != nil {
				t.Fatal(err)
			}
			if applied {
				if completed.Audit.Result != "success" || store.character.AdminOperationReceipts[store.op.ID] != store.op.Fingerprint || len(committer.ids) != 2 {
					t.Fatal("restart lost already-journaled teleport")
				}
			} else if completed.Audit.Result != "denied" || len(committer.ids) != 0 || len(store.character.AdminOperationReceipts) != 0 {
				t.Fatal("unapplied intent moved an offline character")
			}
		})
	}
}
