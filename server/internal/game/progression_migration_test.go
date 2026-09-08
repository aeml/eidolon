package game

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"testing"
)

//go:embed testdata/progression_v2.json
var progressionV2Fixture []byte

func TestProgressionBridgeSupportsFutureClientFixture(t *testing.T) {
	var fixture struct {
		Version      int
		Requirements []int
	}
	if err := json.Unmarshal(progressionV2Fixture, &fixture); err != nil {
		t.Fatal(err)
	}
	if fixture.Version != MaxSupportedProgressionVersion || len(fixture.Requirements) != MaxPlayerLevel {
		t.Fatal("invalid shared curve fixture")
	}
	for index, value := range fixture.Requirements {
		if progressionRequirement(2, index+1) != value {
			t.Fatalf("shared curve differs at level %d", index+1)
		}
	}
}

func TestProgressionBridgeSupportedVersionTwoThresholds(t *testing.T) {
	total := 0
	for level := 1; level <= 100; level++ {
		want := 100 + 25*(level-1)*(level-1)
		if progressionRequirement(2, level) != want {
			t.Fatalf("level %d threshold does not match the bounded candidate", level)
		}
		if level < 100 {
			total += want
		}
	}
	if total != 7_973_625 {
		t.Fatalf("candidate total %d", total)
	}
}

func TestProgressionMigrationPreservesEveryLevelAndFractionOnce(t *testing.T) {
	for level := 1; level < 100; level++ {
		oldMax := legacyExperienceRequiredForLevel(level)
		for _, xp := range []int{0, oldMax / 4, oldMax / 2, oldMax - 1} {
			for _, version := range []int{0, 1} {
				migrated, err := MigrateSavedProgression(level, xp, version)
				// The bridge retains curve1: reconnect is exact identity. Avoid
				// overflowing the test oracle by multiplying two legacy values.
				wantXP := xp
				if err != nil || migrated.Level != level || migrated.XP != wantXP || migrated.PendingLevels != 0 || migrated.ResonanceXP != 0 {
					t.Fatalf("level=%d xp=%d version=%d: %+v / %v", level, xp, version, migrated, err)
				}
				again, err := MigrateSavedProgression(migrated.Level, migrated.XP, CurrentProgressionVersion)
				if err != nil || again != migrated {
					t.Fatalf("repeated migration changes progress: %+v -> %+v", migrated, again)
				}
			}
		}
	}
}

func TestProgressionMigrationHonorsPendingOldLevelsAndCapOverflow(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, level := range []int{29, 99, 100} {
			t.Run(fmt.Sprintf("%s/%d", class, level), func(t *testing.T) {
				oldMax := legacyExperienceRequiredForLevel(level)
				xp := oldMax + 123
				migrated, err := MigrateSavedProgression(level, xp, 0)
				if err != nil {
					t.Fatal(err)
				}
				player := newTestPlayer("migration", class)
				player.BaseStats = applyLevelGrowth(canonicalBaseStatsForClass(class), level)
				player.BaseStats.Strength += 7 // Preserve a historic allocation too.
				player.Gold, player.SkillPoints = 987, 3
				player.ResonanceLevel, player.ResonancePoints, player.ResonanceXP = 4, 1, ResonanceXPPerLevel-50
				player.ResonanceRanks = map[string]int{"ward": 3}
				player.ApplySavedProgression(migrated)
				wantLevel := min(level+1, 100)
				if player.Level != wantLevel || player.Experience >= player.MaxExperience && wantLevel < 100 {
					t.Fatalf("invalid migrated XP: %+v", migrated)
				}
				wantStats := applyLevelGrowth(canonicalBaseStatsForClass(class), wantLevel)
				wantStats.Strength += 7
				if player.BaseStats != wantStats || player.Gold != 987 || player.SkillPoints != 3 || player.ResonanceRanks["ward"] != 3 {
					t.Fatal("migration changed unrelated earned state")
				}
				if level == 99 {
					if player.ResonanceLevel != 5 || player.ResonancePoints != 2 || player.ResonanceXP != 73 {
						t.Fatal("pending cap overflow lost or duplicated")
					}
				} else if player.ResonanceLevel != 4 || player.ResonancePoints != 1 || player.ResonanceXP != ResonanceXPPerLevel-50 {
					t.Fatal("bar sentinel or ordinary remainder became Resonance")
				}
			})
		}
	}
}

func TestProgressionMigrationRejectsUnsupportedSaves(t *testing.T) {
	for _, values := range [][3]int{{0, 0, 0}, {101, 0, 0}, {50, -1, 0}, {50, 0, -1}, {50, 0, 3}, {99, 1 << 53, 0}} {
		if _, err := MigrateSavedProgression(values[0], values[1], values[2]); err == nil {
			t.Fatalf("accepted unsupported save %v", values)
		}
	}
}

func TestProgressionCompatibilityRollbackPreservesLevelAndFraction(t *testing.T) {
	for level := 1; level < 100; level++ {
		newMax := progressionRequirement(2, level)
		for _, xp := range []int{0, newMax / 2, newMax - 1} {
			rollback, err := migrateSavedProgressionToVersion(level, xp, 2, 1)
			if err != nil || rollback.Level != level || rollback.PendingLevels != 0 || rollback.ResonanceXP != 0 {
				t.Fatalf("rollback: %+v / %v", rollback, err)
			}
			want := int(int64(xp) * int64(legacyExperienceRequiredForLevel(level)) / int64(newMax))
			if rollback.XP != want {
				t.Fatalf("rollback fraction at %d: %d != %d", level, rollback.XP, want)
			}
			again, err := migrateSavedProgressionToVersion(level, rollback.XP, 1, 1)
			if err != nil || again != rollback {
				t.Fatalf("bridge reconnect level=%d changed %+v -> %+v (%v)", level, rollback, again, err)
			}
		}
	}
	for _, source := range []int{0, 1, 2} {
		for _, target := range []int{1, 2} {
			got, err := migrateSavedProgressionToVersion(100, progressionRequirement(max(1, source), 100), source, target)
			if err != nil || got.Level != 100 || got.XP != progressionRequirement(target, 100) || got.ResonanceXP != 0 {
				t.Fatal("rollback converted capped sentinel into Resonance")
			}
		}
	}
}
