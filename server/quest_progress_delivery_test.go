package main

import (
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func questProgressFixture(t *testing.T, blocked ...int) (*Client, *game.Entity, *coalescedSaveCommitter) {
	t.Helper()
	client, player, committer := coalescedSaveFixture(t, blocked...)
	client.prioritySend = make(chan []byte, 8)
	player.Quests = []game.Quest{{ID: "earned-quest", Type: "KILL", Target: "Skeleton", Accepted: true, Count: 1, MaxCount: 10}}
	world.OnQuestProgress = requestQuestProgressSave
	world.OnQuestUpdate = func(string, []game.Quest) { t.Error("earned quest update bypassed the saved-image path") }
	return client, player, committer
}

func readSavedQuestProgress(t *testing.T, client *Client) []game.Quest {
	t.Helper()
	select {
	case data := <-client.prioritySend:
		var message Message
		var quests []game.Quest
		if json.Unmarshal(data, &message) != nil || message.Type != MsgQuestUpdate || json.Unmarshal(message.Payload, &quests) != nil {
			t.Fatal("invalid saved quest progress packet", string(data))
		}
		return quests
	case <-time.After(time.Second):
		t.Fatal("saved quest progress was not acknowledged")
		return nil
	}
}

func TestQuestProgressDeliveryReturnsUnderSceneAndAccountLocksWithoutPrematureFeedback(t *testing.T) {
	client, player, committer := questProgressFixture(t, 1)
	unlock := lockCharacterWork(client.username)
	world.Mu.Lock()
	player.Mu.Lock()
	client.stateMu.Lock()
	done := make(chan struct{})
	go func() {
		world.UpdateQuestProgress(player, "Skeleton")
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
	unlock()
	if !returned {
		<-done
		t.Fatal("quest callback re-entered held scene/account/snapshot locks")
	}
	image := nextCoalescedSave(t, committer)
	if len(client.prioritySend) != 0 || image.character.Quests[0].Count != 2 {
		t.Fatal("quest progress was acknowledged before the full save returned")
	}
	committer.barriers[1].release()
	backgroundCharacterWork.SealWhenIdle()
	quests := readSavedQuestProgress(t, client)
	if quests[0].Count != 2 || quests[0].Completed || client.questSaveConfirmed != client.questSaveRequested {
		t.Fatal("saved quest acknowledgement lost progress or automatically completed the quest")
	}
}

func TestQuestProgressDeliveryBurstKeepsNewerProgressOutOfEarlierAcknowledgement(t *testing.T) {
	client, player, committer := questProgressFixture(t, 1, 2)
	requestQuestProgressSave(player.ID)
	first := nextCoalescedSave(t, committer)
	player.Mu.Lock()
	player.Quests[0].Count, player.Gold = 7, 109
	player.Inventory = []game.Item{{ID: "independent-earned", Type: game.ItemWeapon, Stats: map[string]int{"damage": 73}}}
	player.Mu.Unlock()
	var producers sync.WaitGroup
	for range 8 {
		producers.Add(1)
		go func() {
			defer producers.Done()
			for range 64 {
				requestQuestProgressSave(player.ID)
			}
		}()
	}
	producers.Wait()
	if len(client.prioritySend) != 0 {
		t.Fatal("burst bypassed the save barrier")
	}
	committer.barriers[1].release()
	second := nextCoalescedSave(t, committer)
	if first.character.Quests[0].Count != 1 || second.character.Quests[0].Count != 7 || second.character.Gold != 109 || second.character.Inventory[0].ID != "independent-earned" {
		t.Fatal("coalesced progress overwrote later independent character state")
	}
	if quests := readSavedQuestProgress(t, client); quests[0].Count != 1 {
		t.Fatal("old acknowledged image leaked a newer unconfirmed quest count")
	}
	committer.barriers[2].release()
	backgroundCharacterWork.SealWhenIdle()
	if quests := readSavedQuestProgress(t, client); quests[0].Count != 7 {
		t.Fatal("newer progress was swallowed by the earlier save")
	}
	if len(committer.records) != 2 || client.questSaveRequested != 513 || client.questSaveConfirmed != 513 {
		t.Fatal("one quest save was queued per burst request or a generation was lost")
	}
}

func TestQuestProgressDeliveryRejectedSaveReopensJournalAndConfirmsLatestWholeState(t *testing.T) {
	client, player, committer := questProgressFixture(t)
	journalDir := t.TempDir()
	var err error
	characterSaveJournal, err = database.OpenCharacterSaveJournal(journalDir)
	if err != nil {
		t.Fatal(err)
	}
	committer.fail = errors.New("quest image acknowledgement unavailable")
	requestQuestProgressSave(player.ID)
	backgroundCharacterWork.SealWhenIdle()
	if len(client.prioritySend) != 0 || client.questSaveConfirmed != 0 {
		t.Fatal("failed quest save was acknowledged")
	}
	characterSaveJournal, err = database.OpenCharacterSaveJournal(journalDir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := characterSaveJournal.Read(client.username)
	if err != nil || pending == nil {
		t.Fatal("failed quest save lost its actual filesystem journal", err)
	}
	image, err := pending.Character()
	if err != nil || image.Quests[0].Count != 1 {
		t.Fatal("journal did not retain the complete quest image", err)
	}
	// Simulate later legitimate progress while the write is pending. Recovery
	// must commit the latest whole live image rather than restoring old counts.
	player.Mu.Lock()
	player.Quests[0].Count, player.Gold = 4, 109
	player.Mu.Unlock()
	committer.mu.Lock()
	committer.fail = nil
	committer.mu.Unlock()
	unlock := lockCharacterWork(client.username)
	err = retryPendingCharacterSaveLocked(client.username)
	unlock()
	if err != nil {
		t.Fatal(err)
	}
	quests := readSavedQuestProgress(t, client)
	latest := committer.records[len(committer.records)-1].character
	if quests[0].Count != 4 || latest.Quests[0].Count != 4 || latest.Gold != 109 || len(client.prioritySend) != 0 {
		t.Fatal("successful recovery acknowledged old progress or lost an independent credit")
	}
}

func TestQuestProgressDeliveryOtherAccountAndReplacementKeepTheirOwnFeedback(t *testing.T) {
	client, player, committer := questProgressFixture(t, 1)
	requestQuestProgressSave(player.ID)
	nextCoalescedSave(t, committer)
	other := &Client{username: "save-other", playerID: "player-save-other", prioritySend: make(chan []byte, 4)}
	otherPlayer := &game.Entity{ID: other.playerID, Type: game.TypePlayer, SubType: "Fighter", Level: 30,
		Quests: []game.Quest{{ID: "other-quest", Type: "KILL", Accepted: true, Count: 3, MaxCount: 8}}}
	world.AddEntity(otherPlayer)
	sessionsMu.Lock()
	activeSessions[other.username] = other
	sessionsMu.Unlock()
	requestQuestProgressSave(other.playerID)
	if next := nextCoalescedSave(t, committer); next.username != other.username {
		t.Fatal("unrelated quest owner waited for a blocked account")
	}
	if quests := readSavedQuestProgress(t, other); quests[0].ID != "other-quest" || quests[0].Count != 3 {
		t.Fatal("quest progress leaked between accounts")
	}
	// A retired source must not send a save receipt to its replacement socket.
	replacement := &Client{username: client.username, playerID: client.playerID, prioritySend: make(chan []byte, 4)}
	sessionsMu.Lock()
	activeSessions[client.username] = replacement
	sessionsMu.Unlock()
	client.retired.Store(true)
	committer.barriers[1].release()
	backgroundCharacterWork.SealWhenIdle()
	if len(client.prioritySend) != 0 || len(replacement.prioritySend) != 0 {
		t.Fatal("retired owner published its receipt to a stale or replacement socket")
	}
}

func TestQuestProgressDeliveryCrystalRepairUsesSavedQuestImageWithoutGrantingTurnIn(t *testing.T) {
	client, player, committer := questProgressFixture(t, 1)
	player.Quests = []game.Quest{{ID: game.ChronicleEarthRestoredID, Type: "REPAIR", Target: "EarthCrystal", Category: game.QuestCategoryChronicle,
		Accepted: true, Count: 0, MaxCount: 1, RewardGold: 300, RewardXP: 234}}
	beforeGold, beforeXP := player.Gold, player.Experience
	player.Mu.Lock()
	updated := world.UpdateChronicleEventProgress(player, "REPAIR", "EarthCrystal")
	player.Mu.Unlock()
	image := nextCoalescedSave(t, committer)
	if !updated || image.character.Quests[0].Count != 1 || image.character.Quests[0].Completed || len(client.prioritySend) != 0 {
		t.Fatal("repair credit auto-completed its quest or bypassed persistence")
	}
	committer.barriers[1].release()
	backgroundCharacterWork.SealWhenIdle()
	quests := readSavedQuestProgress(t, client)
	if quests[0].Count != 1 || quests[0].Completed || player.Gold != beforeGold || player.Experience != beforeXP {
		t.Fatal("repair acknowledgement paid a manual-turn-in reward")
	}
}

func TestQuestProgressDeliveryMenuAndInvestigationRepliesRequireSavedEvidence(t *testing.T) {
	for _, investigate := range []bool{false, true} {
		t.Run(map[bool]string{false: "menu", true: "investigation"}[investigate], func(t *testing.T) {
			client, player, committer := questProgressFixture(t)
			player.LastDailyQuest = time.Now()
			var payload []byte
			if investigate {
				chapter := game.ChronicleInvestigationCatalog()[0]
				site := chapter.Sites[0]
				player.X, player.Z = site.X, site.Z
				player.Quests = []game.Quest{{ID: chapter.ID, Type: "INVESTIGATE", Category: game.QuestCategoryChronicle, Accepted: true, MaxCount: 1}}
				world.AddEntity(&game.Entity{ID: site.EntityID, Type: game.TypeNPC, SubType: "ChronicleSite", X: site.X, Z: site.Z})
				payload, _ = json.Marshal(map[string]string{"entityId": site.EntityID})
			}
			committer.fail = errors.New("explicit evidence save unavailable")
			unlock := lockCharacterWork(client.username)
			if investigate {
				client.handleChronicleInspection(payload)
			} else {
				client.handleQuestSnapshotRequest()
			}
			unlock()
			backgroundCharacterWork.SealWhenIdle()
			messages := drainSentMessages(client.prioritySend)
			if len(messages) != 1 || messages[0].Type != MsgError {
				t.Fatal("explicit read/inspection bypassed the saved-evidence barrier", messages)
			}
			if pending, err := characterSaveJournal.Read(client.username); err != nil || pending == nil {
				t.Fatal("explicit request lost its complete journal image", err)
			}
			committer.mu.Lock()
			committer.fail = nil
			committer.mu.Unlock()
			unlock = lockCharacterWork(client.username)
			if investigate {
				client.handleChronicleInspection(payload)
			} else {
				client.handleQuestSnapshotRequest()
			}
			unlock()
			messages = drainSentMessages(client.prioritySend)
			if len(messages) != 1 && !investigate || investigate && len(messages) != 2 || messages[0].Type != MsgQuestUpdate ||
				investigate && messages[1].Type != MsgChronicleDiscovery {
				t.Fatal("saved reread omitted its ordered quest/evidence replies", messages)
			}
			last := committer.records[len(committer.records)-1].character
			if investigate && (last.Quests[0].Count != 1 || last.Quests[0].InvestigationMask == 0 || last.Quests[0].Completed) {
				t.Fatal("saved investigation lost personal evidence or auto-completed its quest")
			}
		})
	}
}
