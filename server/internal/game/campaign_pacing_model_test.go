package game

import (
	"fmt"
	"math"
	"testing"
)

// Design forecast, NOT measured human playtime. Pay chapters AFTER objectives.
// Explicit mixed-activity rates include recovery/travel:90 ordinary kills and
// 3 elites/hour; after level30,2 bosses and8 rooms/hour. A four-player party has
// 3x combat throughput and the real shared pool. No dailies or Fortune.
// Reading/travel:4 minutes/site; dungeon:35 minutes; raid:40; collection:40%.
func campaignPacingForecast(size int, speed, restUptime float64) (float64, [5]float64, int) {
	level, xp, hours := 1, 0.0, 0.0
	var bands [5]float64
	groupRate := 1.0
	if size == 4 {
		groupRate = 3
	}
	averageKill := func(base int, boss bool) float64 {
		plain := recipientCombatExperience(base, boss, size, 1)
		rested := wellRestedKillXP(&Entity{Type: TypePlayer, WellRestedSeconds: MaxWellRestedSeconds}, plain)
		return float64(plain)*(1-restUptime) + float64(rested)*restUptime
	}
	award := func(amount float64) {
		xp += amount
		for level < MaxPlayerLevel && xp >= float64(experienceRequiredForLevel(level)) {
			xp -= float64(experienceRequiredForLevel(level))
			level++
		}
	}
	elapse := func(duration float64) {
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
		hours += duration
		bands[band] += duration
	}
	prepare := func(target int) {
		for level < target {
			rate := groupRate * (90*averageKill(combatExperienceBudget(level, 0, false, false), false) +
				3*averageKill(combatExperienceBudget(level, 0, false, true), false))
			if level >= 30 {
				rate += 2*averageKill(combatExperienceBudget(level, level, true, false), true) + 8*float64(max(50, level*10))
			}
			remaining := float64(experienceRequiredForLevel(level)) - xp
			elapse(remaining / (rate * speed))
			award(remaining + .000001)
		}
	}
	chapters := 0
	for _, q := range chronicleQuestCatalog() {
		gate, enemyLevel, kills, duration, encounterXP := 1, 1, 0.0, 0.0, 0.0
		if hunt, ok := chronicleHuntByID(q.ID); ok {
			gate, enemyLevel, kills = max(1, hunt.MinEnemyLevel-4), hunt.MinEnemyLevel, float64(hunt.Count)
		} else {
			switch q.ID {
			case "chronicle_01_bell_below":
				kills = float64(q.MaxCount)
			case "chronicle_02_seeds_first_grove":
				enemyLevel, kills = 3, float64(q.MaxCount)/.4
			case "chronicle_04_pearls_without_tides":
				enemyLevel, kills = 50, float64(q.MaxCount)/.4
			case "chronicle_06_ash_refuses_cool", "chronicle_08_feathers_thunder":
				enemyLevel, kills = 70, float64(q.MaxCount)/.4
			case ChronicleEarthDungeonID, ChronicleWaterDungeonID, ChronicleFireDungeonID, ChronicleAirDungeonID:
				gate = map[string]int{ChronicleEarthDungeonID: 30, ChronicleWaterDungeonID: 60, ChronicleFireDungeonID: 70, ChronicleAirDungeonID: 70}[q.ID]
				duration = 35.0 / 60
				encounterXP = 5*averageKill(combatExperienceBudget(gate, gate, true, false), true) + 10*float64(gate*10)
			case ChronicleEarthRestoredID, ChronicleWaterRestoredID, ChronicleFireRestoredID, ChronicleAirRestoredID:
				for _, raid := range elementalRaidDefinitions {
					if raid.RestoredQuest == q.ID {
						gate = raid.RequiredLevel
						break
					}
				}
				duration = 40.0 / 60
				encounterXP = averageKill(combatExperienceBudget(gate, gate, true, false), true)
			default:
				found := false
				for _, chapter := range ChronicleInvestigationCatalog() {
					if chapter.ID == q.ID && chapter.Realm != "dark" {
						duration, found = float64(len(chapter.Sites))*4/60, true
						break
					}
				}
				if !found {
					prepare(100)
					return hours, bands, chapters // Dark Realm cannot pay its own entry gate.
				}
			}
		}
		prepare(gate)
		elapse((duration + kills/(90*groupRate)) / speed)
		award(kills*averageKill(combatExperienceBudget(enemyLevel, 0, false, false), false) + encounterXP + float64(q.RewardXP))
		chapters++
	}
	prepare(100)
	return hours, bands, chapters
}

func TestCampaignPacingForecastUsesActualSourcesAndExplicitAssumptions(t *testing.T) {
	for _, size := range []int{1, 4} {
		for _, speed := range []float64{.75, 1, 1.25} {
			for _, rested := range []float64{0, .5, 1} {
				t.Run(fmt.Sprintf("party%d/rate%.2f/rest%.1f", size, speed, rested), func(t *testing.T) {
					hours, bands, chapters := campaignPacingForecast(size, speed, rested)
					if chapters != 29 || hours <= 0 || math.IsNaN(hours) || math.IsInf(hours, 0) {
						t.Fatalf("invalid forecast: hours=%v chapters=%d", hours, chapters)
					}
					if speed == 1 && rested == .5 && (hours < 85 || hours > 120) {
						t.Errorf("reference forecast outside100-hour design envelope: %.1f", hours)
					}
					if size == 1 && speed == 1 && rested == .5 && (bands[0]+bands[1] < 2 || bands[0]+bands[1] > 3) {
						t.Errorf("first-dungeon forecast outside2–3-hour envelope: %.2f", bands[0]+bands[1])
					}
					t.Logf("PACING_FORECAST party=%d rate=%.2f rest=%.1f hours=%.1f bands_1_10_30_60_80_100=%v story_claims=%d dailies=0 measured=false", size, speed, rested, hours, bands, chapters)
				})
			}
		}
	}
}
