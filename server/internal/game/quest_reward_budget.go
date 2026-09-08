package game

// Experimental coordinated-curve budgets. Quotes belong to content, never the
// recipient's level. Gold is deliberate purchasing income, not XP divided by a
// magic constant. Accepted saves retain their original quotes in quests.go.
type questRewardBudget struct{ XP, Gold int }

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
		// Two percent of a level per objective: a 20% bonus before individual
		// kill rounding. Daily hunts remain optional hundred-kill tasks.
		return questRewardBudget{contentExperiencePercent(level, 2*count), max(100, level*count/10)}
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
	// Generic, regional AND difficulty dailies can overlap. Each pays four
	// percent per boss, versus the encounter's personal 35% base reward.
	return questRewardBudget{contentExperiencePercent(level, 4*count) * multiplier, level * count * 4 * multiplier}
}
