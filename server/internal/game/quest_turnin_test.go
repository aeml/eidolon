package game

import "testing"

func TestQuestActionsRequireCorrectGiverAndRewardOnlyOnce(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "turnin", Type: TypePlayer, X: -20, Z: 200, Level: 1, Health: 100, MaxHealth: 100}
	w.AddEntity(player)
	w.GenerateDailyQuests(player.ID)
	id := "chronicle_01_bell_below"
	if _, ok := w.PerformAcceptQuest(player.ID, id); ok {
		t.Fatal("daily giver accepted story quest")
	}
	player.X, player.Z = 20, 215
	if _, ok := w.PerformAcceptQuest(player.ID, id); !ok {
		t.Fatal("wizard did not accept story quest")
	}
	if _, ok := w.PerformCompleteQuest(player.ID, id); ok {
		t.Fatal("unfinished quest rewarded")
	}
	for i := 0; i < 3; i++ {
		w.UpdateQuestProgress(player, "Skeleton")
	}
	if player.Experience != 0 || questByID(t, player, id).Completed {
		t.Fatal("progress awarded XP or completed quest")
	}
	player.InstanceID = "dungeon-test"
	if _, ok := w.PerformCompleteQuest(player.ID, id); ok {
		t.Fatal("remote dungeon turn-in accepted")
	}
	player.InstanceID, player.X = "", -20
	if _, ok := w.PerformCompleteQuest(player.ID, id); ok {
		t.Fatal("wrong giver rewarded story quest")
	}
	player.X = 20
	if _, ok := w.PerformCompleteQuest(player.ID, id); !ok {
		t.Fatal("manual turn-in rejected")
	}
	level, xp := player.Level, player.Experience
	if _, ok := w.PerformCompleteQuest(player.ID, id); ok || player.Level != level || player.Experience != xp {
		t.Fatal("duplicate turn-in rewarded")
	}
	if questByID(t, player, "chronicle_02_seeds_first_grove").Accepted {
		t.Fatal("next quest auto-accepted")
	}
	player.X, player.Z = -20, 200
	if _, ok := w.PerformAcceptQuest(player.ID, "daily_skeleton"); !ok {
		t.Fatal("daily giver rejected daily")
	}
	for i := 0; i < 100; i++ {
		w.UpdateQuestProgress(player, "Skeleton")
	}
	if questByID(t, player, "daily_skeleton").Completed {
		t.Fatal("daily auto-completed")
	}
	if _, ok := w.PerformCompleteQuest(player.ID, "daily_skeleton"); !ok {
		t.Fatal("daily manual turn-in rejected")
	}
}

func TestCollectionTurnInRequiresPhysicalItemsAndPreservesSavedReadyState(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "collector", Type: TypePlayer, X: 20, Z: 215, Inventory: make([]Item, MaxInventorySize)}
	completedChronicleThrough(player, 1)
	w.AddEntity(player)
	quest := questByID(t, player, "chronicle_02_seeds_first_grove")
	quest.Count = quest.MaxCount
	ensureChronicleLocked(player)
	if questByID(t, player, quest.ID).Completed {
		t.Fatal("reconciliation auto-completed saved ready state")
	}
	if _, ok := w.PerformCompleteQuest(player.ID, quest.ID); ok {
		t.Fatal("collection without inventory was rewarded")
	}
	player.Inventory[0] = Item{ID: "chronicle-item-test", Name: quest.Target, Stack: quest.MaxCount, MaxStack: quest.MaxCount}
	if _, ok := w.PerformCompleteQuest(player.ID, quest.ID); !ok {
		t.Fatal("valid collection turn-in failed")
	}
	if player.Inventory[0].ID != "" {
		t.Fatal("turn-in failed to consume materials")
	}
}

func TestWizardIsASeparateVisibleTownNPC(t *testing.T) {
	w := NewWorld(nil)
	wizard := w.GetEntityCopy("story-wizard-1")
	if wizard == nil || wizard.Name != "Archmage Ilyra" || wizard.SubType != "StoryWizard" || wizard.X != 20 || wizard.Z != 215 {
		t.Fatalf("missing town wizard: %+v", wizard)
	}
	daily := w.GetEntityCopy("quest-npc-1")
	if daily == nil || daily.X != -20 || daily.Z != 200 {
		t.Fatal("daily quest giver moved from open doorway")
	}
}
