package main

import (
	"bytes"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestChronicleFeedbackSaveReturnsUnderWorldCharacterAndSnapshotLocks(t *testing.T) {
	client, player, committer := coalescedSaveFixture(t)
	client.prioritySend = make(chan []byte, 4)
	other := &Client{playerID: "player-other", prioritySend: make(chan []byte, 4)}
	sessionsMu.Lock()
	activeSessions["other"] = other
	sessionsMu.Unlock()
	message := createMessage("chronicle_advance", []byte(`{"chapter":2}`))
	unlockCharacter := lockCharacterWork(client.username)
	world.Mu.Lock()
	player.Mu.Lock()
	client.stateMu.Lock()
	done := make(chan struct{})
	go func() {
		sendChronicleAdvanceAndSave(client.playerID, message)
		close(done)
	}()
	returned := false
	select {
	case <-done:
		returned = true
	case <-time.After(time.Second):
	}
	client.stateMu.Unlock()
	player.Mu.Unlock()
	world.Mu.Unlock()
	unlockCharacter()
	if !returned {
		<-done
		t.Fatal("story feedback re-entered a world, character or snapshot lock")
	}
	if !bytes.Equal(<-client.prioritySend, message) || len(other.prioritySend) != 0 {
		t.Fatal("story presentation changed or leaked to a different recipient")
	}
	if saved := nextCoalescedSave(t, committer); saved.username != client.username {
		t.Fatal("story save did not retain its owner")
	}
	backgroundCharacterWork.SealWhenIdle()
}

func TestChronicleFeedbackSavePersistsDespiteUndeliveredPresentation(t *testing.T) {
	for _, condition := range []string{"full", "closed"} {
		t.Run(condition, func(t *testing.T) {
			client, player, committer := coalescedSaveFixture(t)
			client.prioritySend = make(chan []byte, 1)
			if condition == "full" {
				client.prioritySend <- []byte("previous receipt")
			} else {
				client.closeSendQueues()
			}
			player.Mu.Lock()
			player.Gold = 4321
			player.Quests = []game.Quest{{ID: "completed-story", Category: game.QuestCategoryChronicle,
				Accepted: true, Completed: true, Count: 3, MaxCount: 3, GrantedGold: 25, GrantedXP: 100}}
			player.Mu.Unlock()
			sendChronicleAdvanceAndSave(client.playerID, createMessage("chronicle_advance", []byte(`{"chapter":2}`)))
			saved := nextCoalescedSave(t, committer)
			if saved.character.Gold != 4321 || len(saved.character.Quests) != 1 ||
				!saved.character.Quests[0].Completed || saved.character.Quests[0].GrantedGold != 25 ||
				saved.character.Quests[0].GrantedXP != 100 {
				t.Fatal("undelivered story presentation prevented canonical persistence")
			}
			backgroundCharacterWork.SealWhenIdle()
			if condition == "full" && !bytes.Equal(<-client.prioritySend, []byte("previous receipt")) {
				t.Fatal("pending receipt was replaced by story presentation")
			}
		})
	}
}

func TestChronicleFeedbackSaveRejectsUnboundOrRetiredRecipients(t *testing.T) {
	client, _, committer := coalescedSaveFixture(t)
	client.prioritySend = make(chan []byte, 1)
	message := createMessage("chronicle_advance", []byte(`{"chapter":2}`))
	sendChronicleAdvanceAndSave("", message)
	sendChronicleAdvanceAndSave("player-missing", message)
	sendChronicleAdvanceAndSave(client.playerID, nil)
	client.retired.Store(true)
	sendChronicleAdvanceAndSave(client.playerID, message)
	backgroundCharacterWork.SealWhenIdle()
	if len(client.prioritySend) != 0 || len(committer.records) != 0 {
		t.Fatal("invalid recipient queued presentation or persistence")
	}
}
