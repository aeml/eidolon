package game

import (
	"fmt"
	"math"
)

// This curve is experimental until sources and the authored campaign are tuned
// together. The candidate worktree must not be released as a curve-only patch.
const CurrentProgressionVersion = 2
const MaxSupportedProgressionVersion = 2

type SavedProgression struct {
	Level, XP, MaxXP, PendingLevels, ResonanceXP int
}

func legacyExperienceRequiredForLevel(level int) int {
	return int(100 * math.Pow(1.2, float64(max(1, level)-1)))
}

func progressionRequirement(version, level int) int {
	level = max(1, min(level, MaxPlayerLevel))
	if version == 1 {
		return legacyExperienceRequiredForLevel(level)
	}
	return 100 + 25*(level-1)*(level-1)
}

// MigrateSavedProgression is pure: callers can reject unsupported/corrupt saves
// before registering an entity or writing anything back. Version zero denotes
// pre-versioned exponential saves. Never reinterpret their raw XP on curve 2.
func MigrateSavedProgression(level, xp, version int) (SavedProgression, error) {
	return migrateSavedProgressionToVersion(level, xp, version, CurrentProgressionVersion)
}

// A compatibility release can retain curve 1 while understanding curve-2
// saves. That release must precede activation, so rollback also preserves the
// stored level and fraction rather than reading new XP on the old curve.
func migrateSavedProgressionToVersion(level, xp, version, targetVersion int) (SavedProgression, error) {
	if version < 0 || version > MaxSupportedProgressionVersion || targetVersion < 1 || targetVersion > MaxSupportedProgressionVersion {
		return SavedProgression{}, fmt.Errorf("unsupported progression version %d", version)
	}
	if level < 1 || level > MaxPlayerLevel || xp < 0 || int64(xp) > 1<<53-1 {
		return SavedProgression{}, fmt.Errorf("invalid saved progression")
	}
	result := SavedProgression{Level: level}
	if level == MaxPlayerLevel {
		// XP at an already-capped level is a bar sentinel, not unclaimed XP.
		result.XP = progressionRequirement(targetVersion, level)
		result.MaxXP = result.XP
		return result, nil
	}
	if version == 0 {
		version = 1
	}
	oldRequirement := func(level int) int { return progressionRequirement(version, level) }
	// Old room rewards could leave a save above its threshold. Honor those
	// already-earned levels on the OLD curve before preserving the remainder.
	for result.Level < MaxPlayerLevel && xp >= oldRequirement(result.Level) {
		xp -= oldRequirement(result.Level)
		result.Level++
		result.PendingLevels++
	}
	result.MaxXP = progressionRequirement(targetVersion, result.Level)
	if result.Level == MaxPlayerLevel {
		result.XP, result.ResonanceXP = result.MaxXP, xp
		return result, nil
	}
	// Same-version reconnect is identity. Multiplying two large legacy values
	// before dividing can overflow int64 even though the final XP would fit.
	result.XP = xp
	if version != targetVersion {
		// Cross-version conversion always has one bounded-curve factor, so
		// the product fits int64 without floating-point fraction drift.
		result.XP = int(int64(xp) * int64(result.MaxXP) / int64(oldRequirement(result.Level)))
	}
	return result, nil
}

// ApplySavedProgression runs once during login, before the entity is published.
// Existing stats (including any historic allocations) and spent points survive;
// only previously unprocessed earned levels add the normal growth delta.
func (player *Entity) ApplySavedProgression(progress SavedProgression) {
	player.Level, player.Experience, player.MaxExperience = progress.Level, progress.XP, progress.MaxXP
	player.BaseStats = applyLevelGrowth(player.BaseStats, progress.PendingLevels+1)
	player.addResonanceExperienceLocked(progress.ResonanceXP)
}
