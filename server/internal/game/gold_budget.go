package game

// Ordinary kills should fund gradual purchases, not several full build resets
// per hunt. Preserve boss purses; elites pay twice the ordinary range. Party,
// difficulty and earned Fortune modifiers still use the normal reward path.
func combatGoldBounds(level int, boss, elite bool) (int, int) {
	if level <= 0 {
		return 0, 0
	}
	if boss {
		return 10, level*10 + 9
	}
	minimum, maximum := 10, level*2+9
	if elite {
		minimum *= 2
		maximum *= 2
	}
	return minimum, maximum
}
