package game

func (w *World) PerformSelectBranch(playerID, branch string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Allow switching branches freely
	if branch != "A" && branch != "B" && branch != "C" {
		return nil, false
	}

	player.SelectedBranch = branch

	// Update unlocked skills based on level
	w.UpdateUnlockedSkills(player)

	return player, true
}

func (w *World) UpdateUnlockedSkills(player *Entity) {
	if player.SelectedBranch == "" {
		return
	}

	allSkills := getSkillsForBranch(player.SubType, player.SelectedBranch)
	var unlocked []string

	for _, skill := range allSkills {
		reqLevel := 1
		switch skill {
		// Fighter
		case "Whirlwind", "Sweeping Strike", "Berserker Edge":
			reqLevel = 10
		case "Shield Slam", "Earthshaker", "Shattering Charge":
			reqLevel = 20
		case "Iron Fortress", "Unbreakable Grip", "Executioner Spin":
			reqLevel = 30
		case "Guardian Roar", "Juggernaut Charge", "Last Stand Rampage":
			reqLevel = 40

		// Rogue
		case "Backstab", "Fan of Knives", "Smoke Bomb":
			reqLevel = 10
		case "Weak Point Mark", "Serrated Edges", "Poison Coating":
			reqLevel = 20
		case "Shadow Lunge", "Blade Storm", "Tripwire":
			reqLevel = 30
		case "Death Spiral", "Phantom Volley", "Cloak & Vanish":
			reqLevel = 40

		// Wizard
		case "Flame Whip", "Scorch Beam", "Teleport":
			reqLevel = 10
		case "Flame Tornado", "Arcane Missiles", "Arcane Shield":
			reqLevel = 20
		case "Meteor Drop", "Spell Focus", "Gravity Well":
			reqLevel = 30
		case "Inferno Cataclysm", "Dragonfire Lance", "Time Warp":
			reqLevel = 40

		// Cleric
		case "Healing Light", "Radiant Strike", "Blessing of Resolve":
			reqLevel = 10
		case "Guardian Embrace", "Consecrated Ground", "Blessing of Zeal":
			reqLevel = 20
		case "Purifying Wave", "Spirit Guardians Boost", "Mark of Weakness":
			reqLevel = 30
		case "Divine Intervention", "Avenging Seraph", "Heaven's Trumpet":
			reqLevel = 40
		}

		if player.Level >= reqLevel {
			unlocked = append(unlocked, skill)
		}
	}
	player.UnlockedSkills = unlocked
}

func getSkillsForBranch(classType, branch string) []string {
	var skills []string

	switch classType {
	case "Fighter":
		skills = append(skills, "Charge") // Base
		if branch == "A" {
			skills = append(skills, "Whirlwind", "Shield Slam", "Iron Fortress", "Guardian Roar")
		} else if branch == "B" {
			skills = append(skills, "Sweeping Strike", "Earthshaker", "Unbreakable Grip", "Juggernaut Charge")
		} else if branch == "C" {
			skills = append(skills, "Berserker Edge", "Shattering Charge", "Executioner Spin", "Last Stand Rampage")
		}
	case "Rogue":
		skills = append(skills, "Piercing Throw") // Base
		if branch == "A" {
			skills = append(skills, "Backstab", "Weak Point Mark", "Shadow Lunge", "Death Spiral")
		} else if branch == "B" {
			skills = append(skills, "Fan of Knives", "Serrated Edges", "Blade Storm", "Phantom Volley")
		} else if branch == "C" {
			skills = append(skills, "Smoke Bomb", "Poison Coating", "Tripwire", "Cloak & Vanish")
		}
	case "Wizard":
		skills = append(skills, "Fireball") // Base
		if branch == "A" {
			skills = append(skills, "Flame Whip", "Flame Tornado", "Meteor Drop", "Inferno Cataclysm")
		} else if branch == "B" {
			skills = append(skills, "Scorch Beam", "Arcane Missiles", "Spell Focus", "Dragonfire Lance")
		} else if branch == "C" {
			skills = append(skills, "Teleport", "Arcane Shield", "Gravity Well", "Time Warp")
		}
	case "Cleric":
		skills = append(skills, "Spirit Guardians") // Base
		if branch == "A" {
			skills = append(skills, "Healing Light", "Guardian Embrace", "Purifying Wave", "Divine Intervention")
		} else if branch == "B" {
			skills = append(skills, "Radiant Strike", "Consecrated Ground", "Spirit Guardians Boost", "Avenging Seraph")
		} else if branch == "C" {
			skills = append(skills, "Blessing of Resolve", "Blessing of Zeal", "Mark of Weakness", "Heaven's Trumpet")
		}
	}
	return skills
}

func (w *World) PerformUnlockSkill(playerID, skillName string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	if player.SkillPoints <= 0 {
		return nil, false
	}

	allowed := false
	for index, branchSkill := range getSkillsForBranch(player.SubType, player.SelectedBranch) {
		if branchSkill == skillName && player.Level >= index*10 {
			allowed = true
			break
		}
	}
	if !allowed {
		return nil, false
	}

	// Check if already unlocked
	for _, s := range player.UnlockedSkills {
		if s == skillName {
			return nil, false
		}
	}

	player.SkillPoints--
	player.UnlockedSkills = append(player.UnlockedSkills, skillName)
	return player, true
}
