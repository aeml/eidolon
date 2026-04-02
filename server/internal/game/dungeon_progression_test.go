package game

import "testing"

func TestDungeonProgressionAccessAndBands(t *testing.T) {
	if CanAccessDungeon(29) {
		t.Fatalf("expected level 29 to have no dungeon access")
	}
	if !CanAccessDungeon(30) {
		t.Fatalf("expected level 30 to unlock dungeons")
	}

	bands30 := AvailableDungeonRunLevelsForPlayer(30)
	if len(bands30) != 1 || bands30[0] != 30 {
		t.Fatalf("expected level 30 bands [30], got %v", bands30)
	}

	bands47 := AvailableDungeonRunLevelsForPlayer(47)
	if len(bands47) != 2 || bands47[0] != 30 || bands47[1] != 40 {
		t.Fatalf("expected level 47 bands [30 40], got %v", bands47)
	}

	if CanSelectDungeonRunLevel(47, 50) {
		t.Fatalf("expected level 47 to be unable to select run level 50")
	}
	if !CanSelectDungeonRunLevel(100, 100) {
		t.Fatalf("expected level 100 to be able to select run level 100")
	}
}

func TestDungeonProgressionEndgameDifficulties(t *testing.T) {
	if IsEndgameDifficultyUnlocked(99) {
		t.Fatalf("expected level 99 to not unlock endgame difficulties")
	}
	if !IsEndgameDifficultyUnlocked(100) {
		t.Fatalf("expected level 100 to unlock endgame difficulties")
	}

	if IsDungeonDifficultyUnlocked(99, DifficultyHeroic) {
		t.Fatalf("expected heroic to be locked before max level")
	}
	if IsDungeonDifficultyUnlocked(99, DifficultyMythic) {
		t.Fatalf("expected mythic to be locked before max level")
	}
	if !IsDungeonDifficultyUnlocked(100, DifficultyHeroic) {
		t.Fatalf("expected heroic to unlock at max level")
	}
	if !IsDungeonDifficultyUnlocked(100, DifficultyMythic) {
		t.Fatalf("expected mythic to unlock at max level")
	}
}

func TestDungeonProgressionValidateSelection(t *testing.T) {
	if err := ValidateDungeonEntrySelection(29, 30, DifficultyNormal); err == nil {
		t.Fatalf("expected level 29 normal selection to fail")
	}
	if err := ValidateDungeonEntrySelection(30, 30, DifficultyNormal); err != nil {
		t.Fatalf("expected level 30 normal selection to pass, got %v", err)
	}
	if err := ValidateDungeonEntrySelection(47, 50, DifficultyNormal); err == nil {
		t.Fatalf("expected locked run level to fail")
	}
	if err := ValidateDungeonEntrySelection(99, 100, DifficultyHeroic); err == nil {
		t.Fatalf("expected heroic before max level to fail")
	}
	if err := ValidateDungeonEntrySelection(100, 100, DifficultyMythic); err != nil {
		t.Fatalf("expected max-level mythic selection to pass, got %v", err)
	}
}

func TestCreateDungeonStoresRunLevel(t *testing.T) {
	w := NewWorld(nil)
	instanceID := w.CreateDungeon("party-1", "verdant_bastion_catacombs", DifficultyNormal, 40)

	inst, ok := w.InstanceLayouts[instanceID]
	if !ok {
		t.Fatalf("expected instance %s to exist", instanceID)
	}
	if inst.RunLevel != 40 {
		t.Fatalf("expected run level 40, got %d", inst.RunLevel)
	}
}
