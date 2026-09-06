package game

import "testing"

func TestDungeonEntryLevelsMatchesAuthorityAndIsIsolated(t *testing.T) {
	levels := DungeonEntryLevels()
	for dungeonType, level := range levels {
		if ValidateDungeonTypeEntry(level, dungeonType) != nil || ValidateDungeonTypeEntry(level-1, dungeonType) == nil {
			t.Fatalf("invalid advertised gate for %s: %d", dungeonType, level)
		}
	}
	levels["abyssal_well"] = 1
	delete(levels, "verdant_bastion_catacombs")
	if DungeonEntryLevels()["abyssal_well"] != 60 || DungeonEntryLevels()["verdant_bastion_catacombs"] != 30 {
		t.Fatal("menu snapshot mutated the authoritative entry gates")
	}
}
