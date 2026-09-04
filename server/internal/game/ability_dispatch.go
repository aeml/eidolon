package game

import "time"

type AbilityResult struct {
	SkillName         string  `json:"skillName"`
	Accepted          bool    `json:"accepted"`
	Reason            string  `json:"reason,omitempty"`
	Mana              int     `json:"mana"`
	CooldownRemaining float64 `json:"cooldownRemaining"`
}

func (w *World) GetAbilityCooldownSnapshot(playerID string) (map[string]float64, bool) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	cooldowns := make(map[string]float64, len(player.Cooldowns))
	for skillName, readyAt := range player.Cooldowns {
		if remaining := time.Until(readyAt).Seconds(); remaining > 0 {
			cooldowns[skillName] = remaining
		}
	}
	return cooldowns, true
}

func (w *World) PerformAbility(playerID string, targetX, targetZ float64, targetID string, skillName string) AbilityResult {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return AbilityResult{SkillName: skillName, Reason: "player_not_found"}
	}
	result := AbilityResult{SkillName: skillName, Mana: player.Mana}
	if player.State == "DEAD" {
		result.Reason = "dead"
		return result
	}
	if player.State == "JUMPING" || player.IsCharging {
		result.Reason = "action_locked"
		return result
	}
	if player.Stunned {
		result.Reason = "crowd_controlled"
		return result
	}
	stateBeforeAbility := player.State

	// Default skill names if not provided (Legacy support)
	if skillName == "" {
		switch player.SubType {
		case "Fighter":
			skillName = "Charge"
		case "Wizard":
			skillName = "Fireball"
		case "Rogue":
			skillName = "Piercing Throw"
		case "Cleric":
			skillName = "Spirit Guardians"
		}
	}
	result.SkillName = skillName

	// Lazy init cooldowns
	if player.Cooldowns == nil {
		player.Cooldowns = make(map[string]time.Time)
	}

	// Check Specific Cooldown
	if readyAt, ok := player.Cooldowns[skillName]; ok {
		if remaining := time.Until(readyAt); remaining > 0 {
			result.Reason = "cooldown"
			result.CooldownRemaining = remaining.Seconds()
			return result
		}
	}

	// Check Global Cooldown (0.5s)
	// Apply Cooldown Reduction to GCD? Maybe not necessary for GCD, but let's keep it snappy.
	gcd := 500 * time.Millisecond
	if time.Since(player.LastAbilityTime) < gcd {
		result.Reason = "global_cooldown"
		return result
	}

	abilityCommitted := false
	authoritativeCooldown := time.Duration(0)
	setCooldown := func(duration time.Duration) {
		if player.CooldownReduction > 0 {
			duration = time.Duration(float64(duration) * (1.0 - player.CooldownReduction))
		}
		if duration > 0 {
			player.Cooldowns[skillName] = time.Now().Add(duration)
		} else {
			delete(player.Cooldowns, skillName)
		}
		player.LastAbilityTime = time.Now()
		authoritativeCooldown = duration
		abilityCommitted = true
	}

	// Check if skill is unlocked
	isUnlocked := false
	for _, s := range player.UnlockedSkills {
		if s == skillName {
			isUnlocked = true
			break
		}
	}
	// Fallback: Always allow base skills if UnlockedSkills is empty or not found
	if !isUnlocked {
		if (player.SubType == "Fighter" && skillName == "Charge") ||
			(player.SubType == "Rogue" && skillName == "Piercing Throw") ||
			(player.SubType == "Wizard" && skillName == "Fireball") ||
			(player.SubType == "Cleric" && skillName == "Spirit Guardians") {
			isUnlocked = true
		}
	}

	if !isUnlocked {
		result.Reason = "locked"
		return result
	}

	// Combo System: Check if this skill completes a combo
	now := time.Now()
	previousCombo := player.ActiveCombo
	previousComboEndTime := player.ActiveComboEndTime
	var activatedCombo *ComboDef
	if player.LastSkillUsed != "" && now.Sub(player.LastSkillTime) <= ComboWindow {
		combo := GetComboForSkills(player.SubType, player.LastSkillUsed, skillName)
		if combo != nil {
			player.ActiveCombo = combo.Effect
			player.ActiveComboEndTime = now.Add(10 * time.Second) // Combo effect lasts 10 seconds or until consumed
			activatedCombo = combo
		}
	}

	consumeSpellFocus := player.SubType == "Wizard" && player.SpellFocusActive && isWizardDamageSkill(skillName)

	// Class Specific Logic
	switch player.SubType {
	case "Fighter":
		w.performFighterAbility(player, targetX, targetZ, targetID, skillName, setCooldown)
	case "Wizard":
		w.performWizardAbility(player, targetX, targetZ, targetID, skillName, setCooldown)
	case "Rogue":
		w.performRogueAbility(player, targetX, targetZ, targetID, skillName, setCooldown)
	case "Cleric":
		w.performClericAbility(player, targetX, targetZ, targetID, skillName, setCooldown)
	}

	if !abilityCommitted {
		// A handler can reject for mana, range, target, or an ability-specific
		// requirement. Failed attempts must not consume/activate combos.
		player.ActiveCombo = previousCombo
		player.ActiveComboEndTime = previousComboEndTime
		result.Mana = player.Mana
		result.Reason = "requirements_not_met"
		return result
	}
	if consumeSpellFocus {
		player.SpellFocusActive = false
		player.SpellFocusEndTime = time.Time{}
	}

	// Record combo history and publish the combo only after the cast commits.
	player.LastSkillUsed = skillName
	player.LastSkillTime = now
	if activatedCombo != nil && w.OnEvent != nil {
		w.OnEvent("combo", map[string]interface{}{
			"playerID":  player.ID,
			"comboID":   activatedCombo.ID,
			"comboName": activatedCombo.Name,
		})
	}
	player.ActivateSwiftIfEquipped()

	// Ability events drive cast animation independently from logical movement.
	// Preserve the pre-cast locomotion state for ordinary abilities so a server
	// snapshot cannot stop or rewind a player who cast while moving. Charge
	// variants keep ATTACKING because their server-owned movement is deliberate.
	if player.State == "ATTACKING" && !player.IsCharging {
		player.State = stateBeforeAbility
	}

	result.Accepted = true
	result.Mana = player.Mana
	result.CooldownRemaining = authoritativeCooldown.Seconds()
	return result
}
