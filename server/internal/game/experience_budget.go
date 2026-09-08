package game

// Content level owns the experimental XP budget. The recipient's level never
// inflates a trivial enemy's reward. Boss XP is a personal encounter award;
// ordinary/elite XP remains a shared nearby-party pool with the party bonus.
func combatExperienceBudget(enemyLevel, runLevel int, boss, elite bool) int {
	level, percent := enemyLevel, 10
	if elite {
		percent = 20
	}
	if boss {
		percent = 35
		if runLevel > 0 {
			level = runLevel
		}
	}
	return experienceRequiredForLevel(level) * percent / 100
}

func recipientCombatExperience(base int, boss bool, eligiblePlayers int, difficulty float64) int {
	if boss || eligiblePlayers <= 1 {
		return int(float64(base) * difficulty)
	}
	total := int(float64(base) * (1 + .1*float64(eligiblePlayers)) * difficulty)
	return total / eligiblePlayers
}
