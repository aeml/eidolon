package game

import (
	"fmt"
	"math"
	"testing"
)

// Forecast only, not simulated combat or an earned save. These explicit mixed
// activity rates include ordinary travel/recovery time:90 ordinary kills/hour,
// three elites/hour, one boss/four hours,1.5 room clears/hour. A coordinated
// four-player party is assumed to kill ordinary/elite enemies three times as
// fast, then uses the actual shared pool. Difficulty is Normal, Fortune and
// dailies are zero. Rest uptime and throughput are varied, not assumed measured.
// Story payouts follow catalog order at the listed content/entry level; their
// objective kills are included in mixed combat, NOT paid a second time here.
func campaignPacingForecast(size int, speed, restUptime float64, oldRewards bool) (float64, [5]float64, int) {
	level, xp, hours := 1, 0.0, 0.0
	var bands [5]float64
	quests := chronicleQuestCatalog()
	next := 0
	gate := func(q Quest) int {
		if hunt, ok := chronicleHuntByID(q.ID); ok {
			return hunt.MinEnemyLevel
		}
		for _, chapter := range ChronicleInvestigationCatalog() {
			if chapter.ID == q.ID {
				switch chapter.Realm {
				case "earth":
					return 3
				case "water":
					return 40
				case "fire":
					return 70
				case "air":
					return 70
				}
			}
		}
		switch q.ID {
		case "chronicle_01_bell_below":
			return 1
		case "chronicle_02_seeds_first_grove":
			return 3
		case ChronicleEarthDungeonID:
			return 30
		case "chronicle_04_pearls_without_tides":
			return 50
		case ChronicleWaterDungeonID:
			return 60
		case "chronicle_06_ash_refuses_cool", "chronicle_08_feathers_thunder", ChronicleFireDungeonID, ChronicleAirDungeonID:
			return 70
		case ChronicleEarthRestoredID, ChronicleWaterRestoredID, ChronicleFireRestoredID, ChronicleAirRestoredID:
			return 80
		default:
			return 100 // The expedition and finale cannot help reach their own gate.
		}
	}
	for level < MaxPlayerLevel {
		for next < len(quests) && gate(quests[next]) <= level && gate(quests[next]) < 100 {
			xp += float64(quests[next].RewardXP)
			next++
		}
		threshold := float64(experienceRequiredForLevel(level))
		if xp >= threshold {
			xp -= threshold
			level++
			continue
		}
		common := combatExperienceBudget(level, 0, false, false)
		elite := combatExperienceBudget(level, 0, false, true)
		boss := combatExperienceBudget(level, level, true, false)
		if oldRewards {
			common, elite, boss = int(threshold)*10/100, int(threshold)*20/100, int(threshold)*35/100
		}
		groupRate := 1.0
		if size == 4 {
			groupRate = 3
		}
		// Average the exact rounded rested/unrested production receipts.
		averageKill := func(base int, boss bool) float64 {
			plain := recipientCombatExperience(base, boss, size, 1)
			rested := wellRestedKillXP(&Entity{Type: TypePlayer, WellRestedSeconds: MaxWellRestedSeconds}, plain)
			return float64(plain)*(1-restUptime) + float64(rested)*restUptime
		}
		dungeonRate := 0.0
		if level >= 30 { // No dungeon income before the first entry gate.
			dungeonRate = .25*averageKill(boss, true) + 1.5*float64(max(50, level*10))
		}
		rate := speed * (groupRate*(90*averageKill(common, false)+3*averageKill(elite, false)) + dungeonRate)
		duration := (threshold - xp) / rate
		hours += duration
		band := 0
		switch {
		case level >= 80:
			band = 4
		case level >= 60:
			band = 3
		case level >= 30:
			band = 2
		case level >= 10:
			band = 1
		}
		bands[band] += duration
		xp = 0
		level++
	}
	return hours, bands, next
}

func TestCampaignPacingForecastUsesActualSourcesAndExplicitAssumptions(t *testing.T) {
	for _, size := range []int{1, 4} {
		for _, speed := range []float64{.75, 1, 1.25} {
			for _, rested := range []float64{0, .5, 1} {
				t.Run(fmt.Sprintf("party%d/rate%.2f/rest%.1f", size, speed, rested), func(t *testing.T) {
					hours, bands, chapters := campaignPacingForecast(size, speed, rested, false)
					before, _, _ := campaignPacingForecast(size, speed, rested, true)
					if chapters != 29 || hours <= before || math.IsNaN(hours) || math.IsInf(hours, 0) {
						t.Fatalf("invalid forecast: hours=%v old=%v chapters=%d", hours, before, chapters)
					}
					if speed == 1 && rested == .5 && (hours < 85 || hours > 120) {
						t.Fatalf("reference forecast outside initial100-hour design envelope: %.1f", hours)
					}
					t.Logf("PACING_FORECAST party=%d rate=%.2f rest=%.1f old_hours=%.1f candidate_hours=%.1f bands_1_10_30_60_80_100=%v story_claims=%d dailies=0 measured=false", size, speed, rested, before, hours, bands, chapters)
				})
			}
		}
	}
}
