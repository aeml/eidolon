package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Ordinary password login, quest turn-in, item claim and cold process reload.
// Only the ready objectives/predecessors are prepared; no admin reward command.
func TestQuestItemRewardsActualTurnInReconnectAndSingleClaim(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	fixture.X, fixture.Z = 20, 215
	fixture.Level, fixture.XP = 9, game.ExperienceRequiredForLevel(9)-1
	fixture.Inventory = []database.Item{{ID: "retain-item", Name: "Retained sword", Type: "WEAPON", Slot: "mainHand", Rarity: "Uncommon", Level: 1, Stack: 1, MaxStack: 1, StatScaleVersion: game.ItemStatScaleVersion}}
	catalogWorld := game.NewWorld(nil)
	catalogPlayer := &game.Entity{ID: "quest-catalog", Type: game.TypePlayer, Level: 9}
	catalogWorld.AddEntity(catalogPlayer)
	catalogWorld.GenerateDailyQuests(catalogPlayer.ID)
	// Chronicle only exposes the next chapter. Prepare its first predecessor
	// here to obtain the ordinary second chapter's definition, not a second catalog.
	for i := range catalogPlayer.Quests {
		if catalogPlayer.Quests[i].Category == game.QuestCategoryChronicle {
			catalogPlayer.Quests[i].Accepted, catalogPlayer.Quests[i].Completed = true, true
		}
	}
	catalogWorld.GenerateDailyQuests(catalogPlayer.ID)
	catalog := characterSnapshotForSave("quest-catalog", catalogWorld.GetEntityCopy(catalogPlayer.ID)).Quests
	catalogWorld.StopBackground()
	var reward database.Quest
	for _, quest := range catalog {
		if quest.Category != game.QuestCategoryChronicle {
			continue
		}
		if quest.RewardChoiceLevel > 0 && (reward.ID == "" || quest.Chapter < reward.Chapter) {
			reward = quest
		}
	}
	if reward.ID == "" {
		t.Fatal("catalog has no periodic item reward")
	}
	fixture.Quests = nil
	for _, quest := range catalog {
		if quest.Category != game.QuestCategoryChronicle || quest.Chapter >= reward.Chapter {
			continue
		}
		quest.Accepted, quest.Completed = true, true
		fixture.Quests = append(fixture.Quests, quest)
	}
	reward.Accepted, reward.Count, reward.RewardXP = true, reward.MaxCount, 1
	if reward.Type == "INVESTIGATE" {
		reward.InvestigationMask = (1 << reward.MaxCount) - 1
	}
	fixture.Quests = append(fixture.Quests, reward)
	if reward.Type == "COLLECT" {
		fixture.Inventory = append(fixture.Inventory, database.Item{ID: "prepared-quest-material", Name: reward.Target, Stack: reward.MaxCount, MaxStack: reward.MaxCount})
	}
	if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 738, "-save-journal-dir", dir)
	connection := resourceOpenCharacter(t, address, fixture.Name, password)
	var buildReceipt struct {
		OK      bool   `json:"ok"`
		Message string `json:"message"`
	}
	resourceSend(t, connection, MsgSelectBranch, map[string]string{"branch": "B", "requestId": "before-level10"})
	resourceReadMessage(t, connection, "build_action", &buildReceipt)
	if buildReceipt.OK || !strings.Contains(buildReceipt.Message, "level 10") {
		t.Fatal("ordinary level9 specialization selection was admitted")
	}
	var before []game.Quest
	resourceSend(t, connection, MsgRequestQuests, struct{}{})
	resourceReadMessage(t, connection, MsgQuestUpdate, &before)
	ready := false
	for _, quest := range before {
		if quest.ID == reward.ID {
			ready = quest.Accepted && !quest.Completed && quest.Count == quest.MaxCount && quest.RewardChoiceLevel == reward.RewardChoiceLevel
		}
	}
	if !ready {
		t.Fatal("prepared ordinary chapter is not ready after authoritative login reconciliation")
	}
	resourceSend(t, connection, MsgCompleteQuest, CompleteQuestPayload{QuestID: reward.ID})
	var quests []game.Quest
	readImmediateQuestTurnIn(t, connection, &quests)
	var offers []game.Item
	for _, quest := range quests {
		if quest.ID == reward.ID {
			offers = quest.RewardChoices
		}
	}
	if len(offers) != 6 {
		t.Fatal("ordinary turn-in did not confirm six saved offers")
	}
	for _, item := range offers {
		if item.Level != reward.RewardChoiceLevel || item.Rarity == game.RarityCommon {
			t.Fatal("invalid quest-level rarity", item.Level, item.Rarity)
		}
	}
	resourceSend(t, connection, MsgSelectBranch, map[string]string{"branch": "B", "requestId": "at-level10"})
	resourceReadMessage(t, connection, "build_action", &buildReceipt)
	if !buildReceipt.OK {
		t.Fatal("ordinary level10 specialization selection was rejected", buildReceipt.Message)
	}
	// The new marker is published before a quest can issue new persisted value.
	version, err := repo.SchemaVersion(t.Context())
	if err != nil || version != database.CurrentSchemaVersion || version < 26 {
		t.Fatal("quest custody is not fenced from older writers", version, err)
	}
	if previous := os.Getenv("EIDOLON_QUEST_PREVIOUS_BINARY"); previous != "" {
		if !filepath.IsAbs(previous) {
			t.Fatal("previous writer must be an explicitly owned absolute binary")
		}
		before, err := repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
		if err != nil {
			t.Fatal(err)
		}
		ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
		output, oldError := exec.CommandContext(ctx, previous, "--check-schema", "--mongo-uri", uri).CombinedOutput()
		cancel()
		if oldError == nil || !strings.Contains(string(output), fmt.Sprintf("database schema %d is newer than this server supports (25)", database.CurrentSchemaVersion)) {
			t.Fatalf("previous writer did not refuse newer quest custody: %v %s", oldError, output)
		}
		after, err := repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
		if err != nil || !reflect.DeepEqual(before.Quests, after.Quests) || !reflect.DeepEqual(before.Inventory, after.Inventory) {
			t.Fatal("previous writer preflight changed quest/bag custody", err)
		}
		t.Logf("PREVIOUS_WRITER_SCHEMA25_REFUSED_SCHEMA%d_WITHOUT_QUEST_OR_BAG_WRITES", database.CurrentSchemaVersion)
	} else {
		t.Log("Previous-writer executable proof not enabled; current schema marker remains checked")
	}
	_ = connection.Close()
	stop()
	saved, err := repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil || saved == nil || saved.Level != 10 || saved.XP != 0 || saved.SelectedBranch != "B" {
		t.Fatal("prepared level9 turn-in did not reach specialization unlock", err)
	}
	address, stop = compatStartServer(t, binary, uri, 739, "-save-journal-dir", dir)
	connection = resourceOpenCharacter(t, address, fixture.Name, password)
	resourceSend(t, connection, MsgRequestQuests, struct{}{})
	resourceReadMessage(t, connection, MsgQuestUpdate, &quests)
	for _, quest := range quests {
		if quest.ID == reward.ID && !reflect.DeepEqual(quest.RewardChoices, offers) {
			t.Fatal("fresh login rerolled saved offers")
		}
	}
	chosen := offers[4]
	request := CompleteQuestPayload{QuestID: reward.ID, ItemID: chosen.ID}
	resourceSend(t, connection, MsgClaimQuestItem, request)
	var bag []game.Item
	resourceReadMessage(t, connection, MsgInventory, &bag)
	resourceReadMessage(t, connection, MsgQuestUpdate, &quests)
	found := false
	for _, item := range bag {
		if item.ID == chosen.ID {
			found = reflect.DeepEqual(item, chosen)
		}
	}
	if !found {
		t.Fatal("ordinary claim did not deliver exact chosen equipment")
	}
	resourceSend(t, connection, MsgClaimQuestItem, request)
	resourceReadMessage(t, connection, MsgError, nil)
	_ = connection.Close()
	stop()
	saved, err = repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for _, item := range saved.Inventory {
		if item.ID == chosen.ID {
			count += item.Stack
		}
	}
	if count != 1 || saved.EP != fixture.EP || saved.Equipment["chest"].ID != fixture.Equipment["chest"].ID {
		t.Fatal("claim/replay changed custody or unrelated equipment/wallet")
	}
	for _, quest := range saved.Quests {
		if quest.ID == reward.ID && (quest.ClaimedRewardID != chosen.ID || len(quest.RewardChoices) != 0) {
			t.Fatal("cold claim receipt missing")
		}
	}
}
