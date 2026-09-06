package game

import (
	"fmt"
	"strings"
	"testing"
)

func TestChronicleDungeonObjectivesUseActualFamilyEntryLevels(t *testing.T) {
	if err := ValidateDungeonEntrySelection(29, 30, DifficultyNormal); err == nil || !strings.Contains(err.Error(), "dungeon runs begin at level 30") {
		t.Fatalf("generic entry rejection gives misleading preparation guidance: %v", err)
	}
	chapters := map[string]string{ChronicleEarthDungeonID: "verdant_bastion_catacombs", ChronicleWaterDungeonID: "abyssal_well",
		ChronicleFireDungeonID: "molten_core", ChronicleAirDungeonID: "tempest_spire"}
	checked := 0
	for _, quest := range chronicleQuestCatalog() {
		if dungeonType, ok := chapters[quest.ID]; ok {
			level := DungeonEntryLevels()[dungeonType]
			if !strings.HasPrefix(quest.ObjectiveText, fmt.Sprintf("Level %d required", level)) {
				t.Fatalf("%s omits its actual dungeon level %d", quest.ID, level)
			}
			checked++
		}
	}
	if checked != 4 {
		t.Fatalf("expected all four elemental dungeon chapters, got %d", checked)
	}
}

func TestChronicleFirstDungeonExplainsPreparationWithoutChangingObjective(t *testing.T) {
	var chapter Quest
	for _, quest := range chronicleQuestCatalog() {
		if quest.ID == ChronicleEarthDungeonID {
			chapter = quest
		}
	}
	for _, phrase := range []string{"The Dungeon Guide requires level 30 for the Bastion", "Daily contracts are optional", "check your earned equipment"} {
		if !strings.Contains(chapter.Description, phrase) {
			t.Fatalf("first dungeon handoff omits %q", phrase)
		}
	}
	if chapter.Target != "HollowSentinel" || chapter.MaxCount != 1 || chapter.RewardXP != 250000 {
		t.Fatal("preparation guidance changed the dungeon objective or reward")
	}
	old := Quest{ID: chapter.ID, Accepted: true, Count: 1, GrantedGold: 12}
	repaired := copyQuestDefinition(old, chapter)
	if !repaired.Accepted || repaired.Count != 1 || repaired.Completed || repaired.GrantedGold != 12 || repaired.Description != chapter.Description {
		t.Fatal("updated guidance lost saved progress or claimed completion")
	}
}
