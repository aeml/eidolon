package game

import (
	"testing"
	"time"
)

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

func TestUmbralNexusIsCapBoundAndUsesSharedDungeonRuntime(t *testing.T) {
	if err := ValidateDungeonTypeEntry(99, "umbral_nexus"); err == nil {
		t.Fatal("Umbral Nexus unlocked before level cap")
	}
	if err := ValidateDungeonTypeEntry(100, "umbral_nexus"); err != nil {
		t.Fatalf("cap-level Umbral Nexus rejected: %v", err)
	}
	if err := ValidateDungeonTypeEntry(100, "invented"); err == nil {
		t.Fatal("unknown dungeon type was accepted")
	}

	world := NewWorld(nil)
	instanceID := world.CreateDungeon("endgame-party", "umbral_nexus", DifficultyMythic, 100)
	instance, ok := world.getDungeonInstance(instanceID)
	if !ok || instance.RoomState == nil || len(instance.Layout.Rooms) != 7 {
		t.Fatalf("Umbral Nexus did not use production room state: %+v", instance)
	}
	if instance.Layout.Rooms[len(instance.Layout.Rooms)-1].Type != "boss" {
		t.Fatal("Umbral Nexus route does not end in a boss room")
	}
	for _, entity := range world.Entities {
		if entity.InstanceID == instanceID && entity.Type == TypeEnemy && entity.Level != 100 {
			t.Fatalf("endgame enemy spawned at run level %d", entity.Level)
		}
	}
}

func TestPartyDungeonReentryReusesLiveInstanceAndExpiresEmptyRun(t *testing.T) {
	w := NewWorld(nil)
	first := w.CreateDungeon("party-reentry", "umbral_nexus", DifficultyMythic, MaxPlayerLevel)
	second := w.CreateDungeon("party-reentry", "molten_core", DifficultyNormal, 70)
	if second != first || w.GetInstanceType(second) != "umbral_nexus" {
		t.Fatalf("live party instance was replaced: first=%s second=%s type=%s", first, second, w.GetInstanceType(second))
	}
	instance, _ := w.getDungeonInstance(first)
	instance.Mu.Lock()
	instance.EmptySince = time.Now().Add(-6 * time.Minute)
	instance.Mu.Unlock()
	third := w.CreateDungeon("party-reentry", "molten_core", DifficultyNormal, 70)
	if third == first || w.GetInstanceType(third) != "molten_core" {
		t.Fatalf("expired party instance was not replaced: first=%s third=%s type=%s", first, third, w.GetInstanceType(third))
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

func TestDungeonRunLevelStatMultipliersScaleByTier(t *testing.T) {
	health30, damage30 := DungeonRunLevelStatMultipliers(30)
	if health30 != 1.0 || damage30 != 1.0 {
		t.Fatalf("expected run level 30 to be baseline scaling, got health=%.2f damage=%.2f", health30, damage30)
	}

	health60, damage60 := DungeonRunLevelStatMultipliers(60)
	if health60 <= health30 || damage60 <= damage30 {
		t.Fatalf("expected run level 60 to scale above baseline, got health=%.2f damage=%.2f", health60, damage60)
	}

	health100, damage100 := DungeonRunLevelStatMultipliers(100)
	if health100 <= health60 || damage100 <= damage60 {
		t.Fatalf("expected run level 100 to scale above run level 60, got health=%.2f damage=%.2f", health100, damage100)
	}

	healthLow, damageLow := DungeonRunLevelStatMultipliers(1)
	if healthLow != 1.0 || damageLow != 1.0 {
		t.Fatalf("expected values below dungeon unlock level to clamp to baseline, got health=%.2f damage=%.2f", healthLow, damageLow)
	}
}
