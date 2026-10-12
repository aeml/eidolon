package game

// Coordinated content budgets use authored levels, with a safety ceiling for
// under-level turn-ins. Gold is deliberate purchasing income, not XP divided by a
// magic constant. Paid receipts are never rewritten by a balance refresh.
type questRewardBudget struct{ XP, Gold int }

// Story rewards use the same share of the XP bar at the authored content
// level. Dungeon chapters pay more, without using turn-ins to bridge entire
// enemy bands. These terms also cap unpaid pre-balance saved quotes.
func chronicleRewardTerms(id string) (level, percent int, found bool) {
	if chapter, ok := chronicleExpeditionByID(id); ok {
		return chapter.ContentLevel, 75, true
	}
	if hunt, ok := chronicleHuntByID(id); ok {
		return hunt.ContentLevel, 75, true
	}
	if _, ok := darkRealmChapterByID(id); ok {
		return 100, 75, true
	}
	percent = 75
	switch id {
	case "chronicle_01_bell_below":
		return 1, 100, true // The three-kill introduction teaches the first level-up.
	case "chronicle_earth_keepers_house":
		level = 3
	case "chronicle_02_seeds_first_grove":
		level = 12
	case "chronicle_earth_returning_scar":
		level = 25
	case "chronicle_water_flood_shelter":
		level = 45
	case "chronicle_04_pearls_without_tides":
		level = 50
	case "chronicle_water_false_reflection":
		level = 55
	case "chronicle_fire_cold_kiln", "chronicle_06_ash_refuses_cool", "chronicle_air_weatherkeeper", "chronicle_08_feathers_thunder":
		level = 70
	case "chronicle_fire_obedient_ember":
		level = 75
	case "chronicle_air_stolen_horizon":
		level = 80
	case ChronicleEarthDungeonID, ChronicleEarthRestoredID:
		level, percent = 30, 125
	case ChronicleWaterDungeonID, ChronicleWaterRestoredID:
		level, percent = 60, 125
	case ChronicleFireDungeonID, ChronicleAirDungeonID, ChronicleFireRestoredID, ChronicleAirRestoredID:
		level, percent = 70, 125
	case ChronicleGateOpenedID:
		level, percent = 100, 125
	case ChronicleDarkKingID:
		level, percent = 100, 175
	default:
		return 0, 0, false
	}
	return level, percent, true
}

func rebalanceUnpaidQuestExperience(player *Entity, quest *Quest) {
	if quest.Completed {
		return
	}
	if level, percent, known := chronicleRewardTerms(quest.ID); known {
		quest.RewardXP = min(quest.RewardXP, contentExperiencePercent(level, percent))
	}
	boundQuestExperience(player, quest)
}

// An under-level party member or optional catch-up chapter must never skip
// more than two levels. Store the bounded quote before acceptance/turn-in so
// the displayed reward and completion receipt agree. Completed receipts and
// level-cap Resonance payouts are historical and remain untouched.
func boundQuestExperience(player *Entity, quest *Quest) bool {
	if quest.Completed || player.Level < 1 || player.Level >= MaxPlayerLevel {
		return false
	}
	ceiling := experienceRequiredForLevel(player.Level) + experienceRequiredForLevel(player.Level+1)
	if quest.RewardXP <= ceiling {
		return false
	}
	quest.RewardXP = ceiling
	return true
}

func contentExperiencePercentForQuest(id string) int {
	level, percent, _ := chronicleRewardTerms(id)
	return contentExperiencePercent(level, percent)
}

func contentExperiencePercent(level, percent int) int {
	return experienceRequiredForLevel(level) * percent / 100
}

func chronicleRewardBudget(id string) questRewardBudget {
	switch id {
	case "chronicle_01_bell_below":
		return questRewardBudget{100, 100}
	case "chronicle_02_seeds_first_grove":
		return questRewardBudget{1600, 100}
	case "chronicle_04_pearls_without_tides":
		return questRewardBudget{contentExperiencePercent(50, 40), 600}
	case "chronicle_06_ash_refuses_cool", "chronicle_08_feathers_thunder":
		return questRewardBudget{contentExperiencePercent(70, 40), 1000}
	case ChronicleEarthDungeonID:
		return questRewardBudget{contentExperiencePercent(30, 50), 300}
	case ChronicleWaterDungeonID:
		return questRewardBudget{contentExperiencePercent(60, 50), 600}
	case ChronicleFireDungeonID, ChronicleAirDungeonID:
		return questRewardBudget{contentExperiencePercent(70, 50), 700}
	case ChronicleEarthRestoredID:
		return questRewardBudget{contentExperiencePercent(30, 125), 600}
	case ChronicleWaterRestoredID:
		return questRewardBudget{contentExperiencePercent(60, 125), 1200}
	case ChronicleFireRestoredID, ChronicleAirRestoredID:
		return questRewardBudget{contentExperiencePercent(70, 125), 1400}
	case ChronicleGateOpenedID:
		return questRewardBudget{contentExperiencePercent(100, 75), 2000}
	case ChronicleDarkKingID:
		return questRewardBudget{contentExperiencePercent(100, 200), 5000}
	default:
		return questRewardBudget{}
	}
}

// Use the authored lower edge of each enemy band, not a player's current level.
var dailyHuntContentLevels = map[string]int{
	"Skeleton": 10, "Imp": 20, "DemonOrc": 30, "Construct": 40, "InfernoTitan": 50,
	"MountainTroll": 50, "AquaGolem": 55, "Siren": 60, "FrostGuardian": 65,
	"SandstormDjinn": 70, "MagmaGolem": 75, "ScorchedWraith": 80, "InfernalBehemoth": 85, "PhoenixSentinel": 90,
	"StormHarpy": 70, "CloudElemental": 75, "ThunderRoc": 80, "TempestGiant": 85, "CycloneAvatar": 90,
}

func dailyRewardBudget(target string, count int) questRewardBudget {
	if count <= 0 {
		return questRewardBudget{}
	}
	if level, found := dailyHuntContentLevels[target]; found {
		// Fresh ordinary contracts use the same fraction of their authored
		// level as ordinary story work. Accepted saved quotes stay bounded at
		// turn-in; the larger, independent Gold purse is unchanged.
		return questRewardBudget{contentExperiencePercent(level, 75), max(100, level*count/5)}
	}
	level, multiplier := 0, 1
	switch target {
	case "DungeonBoss", "VerdantBastionBoss":
		level = 30
	case "AbyssalWellBoss":
		level = 60
	case "MoltenCoreBoss", "TempestSpireBoss":
		level = 70
	case "DungeonBossHeroic":
		level, multiplier = 100, 2
	case "DungeonBossMythic":
		level, multiplier = 100, 4
	}
	if level == 0 {
		return questRewardBudget{}
	}
	// Repeatable generic, regional and difficulty contracts overlap on the
	// same bosses. Keep their combined bonus within the existing run budget;
	// the separately earned story dungeon chapter pays 125% of its level bar.
	return questRewardBudget{combatExperienceBudget(level, level, true, false) * count * multiplier / 10, level * count * 4 * multiplier}
}
