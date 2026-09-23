package game

// Reward anchors are independent of saved level thresholds. Integer interpolation
// keeps every stronger enemy worth at least as much as the previous level;
// switching percentage bands abruptly would make boundary enemies worse rewards.
// This is the100-hour tuning candidate, not measured human completion time.
func ordinaryExperienceBudget(level int) int {
	level = max(1, min(MaxPlayerLevel, level))
	anchors := [...]struct{ level, xp int }{{1, 5}, {10, 26}, {30, 65}, {60, 170}, {80, 250}, {100, 380}}
	for i := 1; i < len(anchors); i++ {
		left, right := anchors[i-1], anchors[i]
		if level <= right.level {
			return left.xp + (level-left.level)*(right.xp-left.xp)/(right.level-left.level)
		}
	}
	return anchors[len(anchors)-1].xp
}

// Content level owns the XP budget. The recipient's level never inflates a
// trivial enemy's reward. Boss XP is a personal encounter award; ordinary/elite
// XP remains a shared nearby-party pool. No stored level/XP migration is needed.
func combatExperienceBudget(enemyLevel, runLevel int, boss, elite bool) int {
	if boss {
		level := enemyLevel
		if runLevel > 0 {
			level = runLevel
		}
		// Personal award, worth eight ordinary kills. Repeated dungeon bosses
		// must not pay a percentage of a level on top of their room/quest awards.
		return ordinaryExperienceBudget(level) * 8
	}
	budget := ordinaryExperienceBudget(enemyLevel)
	if elite {
		budget *= 3
	}
	return budget
}

func recipientCombatExperience(base int, boss bool, eligiblePlayers int, difficulty float64) int {
	if boss || eligiblePlayers <= 1 {
		return int(float64(base) * difficulty)
	}
	total := int(float64(base) * (1 + .1*float64(eligiblePlayers)) * difficulty)
	return total / eligiblePlayers
}
