package game

import (
	"math"
	"testing"
)

func TestProgressionBridgeDoesNotActivateNewCurve(t *testing.T) {
	if CurrentProgressionVersion != 1 || MaxSupportedProgressionVersion != 2 {
		t.Fatal("bridge must retain version one while accepting version two saves")
	}
	for level := 1; level <= MaxPlayerLevel; level++ {
		want := int(100 * math.Pow(1.2, float64(level-1)))
		if experienceRequiredForLevel(level) != want || progressionRequirement(CurrentProgressionVersion, level) != want {
			t.Fatalf("live exponential threshold changed at %d", level)
		}
	}
}

func TestProgressionBridgePublicLoginMigrationRollsBackVersionTwo(t *testing.T) {
	for level := 1; level < MaxPlayerLevel; level++ {
		for _, xp := range []int{0, progressionRequirement(2, level) / 2, progressionRequirement(2, level) - 1} {
			result, err := MigrateSavedProgression(level, xp, 2)
			want := int(int64(xp) * int64(experienceRequiredForLevel(level)) / int64(progressionRequirement(2, level)))
			if err != nil || result.Level != level || result.XP != want || result.PendingLevels != 0 || result.ResonanceXP != 0 {
				t.Fatalf("public login conversion level=%d xp=%d: %+v %v", level, xp, result, err)
			}
			for repeat := 0; repeat < 3; repeat++ {
				again, err := MigrateSavedProgression(result.Level, result.XP, CurrentProgressionVersion)
				if err != nil || again != result {
					t.Fatalf("bridge reconnect changed progress: %+v -> %+v (%v)", result, again, err)
				}
			}
		}
	}
}
