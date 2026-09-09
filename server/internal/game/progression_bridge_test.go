package game

import (
	"math"
	"testing"
)

func TestActiveProgressionRetainsLegacyBridgeThresholds(t *testing.T) {
	if CurrentProgressionVersion != 2 || MaxSupportedProgressionVersion != 2 {
		t.Fatal("coordinated candidate must activate version two while retaining legacy support")
	}
	for level := 1; level <= MaxPlayerLevel; level++ {
		want := int(100 * math.Pow(1.2, float64(level-1)))
		if progressionRequirement(1, level) != want {
			t.Fatalf("legacy exponential threshold changed at %d", level)
		}
	}
}

func TestProgressionBridgeRollbackRetainsVersionTwoFractions(t *testing.T) {
	for level := 1; level < MaxPlayerLevel; level++ {
		for _, xp := range []int{0, progressionRequirement(2, level) / 2, progressionRequirement(2, level) - 1} {
			result, err := migrateSavedProgressionToVersion(level, xp, 2, 1)
			want := int(int64(xp) * int64(progressionRequirement(1, level)) / int64(progressionRequirement(2, level)))
			if err != nil || result.Level != level || result.XP != want || result.PendingLevels != 0 || result.ResonanceXP != 0 {
				t.Fatalf("public login conversion level=%d xp=%d: %+v %v", level, xp, result, err)
			}
			for repeat := 0; repeat < 3; repeat++ {
				again, err := migrateSavedProgressionToVersion(result.Level, result.XP, 1, 1)
				if err != nil || again != result {
					t.Fatalf("bridge reconnect changed progress: %+v -> %+v (%v)", result, again, err)
				}
			}
		}
	}
}
