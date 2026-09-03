package game

import "fmt"

const (
	MaxPlayerLevel               = 100
	DungeonUnlockLevel           = 30
	EndgameDifficultyUnlockLevel = MaxPlayerLevel
)

var dungeonRunLevelBands = []int{30, 40, 50, 60, 70, 80, 90, 100}

func DungeonRunLevelBands() []int {
	bands := make([]int, len(dungeonRunLevelBands))
	copy(bands, dungeonRunLevelBands)
	return bands
}

func CanAccessDungeon(playerLevel int) bool {
	return playerLevel >= DungeonUnlockLevel
}

func HighestUnlockedDungeonRunLevel(playerLevel int) int {
	if !CanAccessDungeon(playerLevel) {
		return 0
	}
	best := 0
	for _, band := range dungeonRunLevelBands {
		if playerLevel >= band {
			best = band
		}
	}
	return best
}

func AvailableDungeonRunLevelsForPlayer(playerLevel int) []int {
	highest := HighestUnlockedDungeonRunLevel(playerLevel)
	if highest == 0 {
		return []int{}
	}
	levels := []int{}
	for _, band := range dungeonRunLevelBands {
		if band <= highest {
			levels = append(levels, band)
		}
	}
	return levels
}

func CanSelectDungeonRunLevel(playerLevel int, runLevel int) bool {
	if !CanAccessDungeon(playerLevel) {
		return false
	}
	for _, band := range dungeonRunLevelBands {
		if band == runLevel {
			return runLevel <= HighestUnlockedDungeonRunLevel(playerLevel)
		}
	}
	return false
}

func IsEndgameDifficultyUnlocked(playerLevel int) bool {
	return playerLevel >= EndgameDifficultyUnlockLevel
}

func IsDungeonDifficultyUnlocked(playerLevel int, difficulty DungeonDifficulty) bool {
	switch difficulty {
	case DifficultyNormal:
		return CanAccessDungeon(playerLevel)
	case DifficultyHeroic, DifficultyMythic:
		return IsEndgameDifficultyUnlocked(playerLevel)
	default:
		return false
	}
}

func ValidateDungeonEntrySelection(playerLevel int, runLevel int, difficulty DungeonDifficulty) error {
	if !CanAccessDungeon(playerLevel) {
		return fmt.Errorf("all dungeons unlock at level %d", DungeonUnlockLevel)
	}
	if !CanSelectDungeonRunLevel(playerLevel, runLevel) {
		return fmt.Errorf("you have not unlocked level %d dungeon runs yet", runLevel)
	}
	if !IsDungeonDifficultyUnlocked(playerLevel, difficulty) {
		return fmt.Errorf("heroic and mythic unlock at level %d", EndgameDifficultyUnlockLevel)
	}
	return nil
}

func DungeonRunLevelStatMultipliers(runLevel int) (healthMult float64, damageMult float64) {
	if runLevel <= DungeonUnlockLevel {
		return 1.0, 1.0
	}

	baseline := balancedEnemyBaseStats(DungeonUnlockLevel)
	target := balancedEnemyBaseStats(runLevel)
	return float64(target.Vitality) / float64(baseline.Vitality),
		float64(target.Strength) / float64(baseline.Strength)
}
