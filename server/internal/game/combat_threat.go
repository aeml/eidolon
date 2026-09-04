package game

func addThreatLocked(enemy *Entity, playerID string, amount float64) {
	if enemy == nil || enemy.Type != TypeEnemy || playerID == "" || amount <= 0 {
		return
	}
	if enemy.Threat == nil {
		enemy.Threat = make(map[string]float64)
	}
	enemy.Threat[playerID] += amount
}

func tauntThreatLocked(enemy *Entity, playerID string) {
	if enemy == nil || playerID == "" {
		return
	}
	if enemy.Threat == nil {
		enemy.Threat = make(map[string]float64)
	}

	maxThreat := 0.0
	for _, v := range enemy.Threat {
		if v > maxThreat {
			maxThreat = v
		}
	}
	// If nobody has threat yet, seed so taunt still works.
	if maxThreat < 1.0 {
		maxThreat = 1.0
	}
	enemy.Threat[playerID] = maxThreat * 1.10
}
