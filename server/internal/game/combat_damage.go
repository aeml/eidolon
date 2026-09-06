package game

import "math/rand"

// CalculateFinalDamage applies unique effects and set bonuses to outgoing damage.
// Parameters:
//   - attacker: the entity dealing damage (must have lock held or be safe to read)
//   - target: the entity receiving damage (must have lock held or be safe to read)
//   - baseDamage: the raw damage amount before modifiers
//   - damageType: type of damage ("physical", "fire", "poison", "holy", "arcane", etc.)
//
// Returns the final damage amount and whether it was a lucky crit.
func CalculateFinalDamage(attacker, target *Entity, baseDamage int, damageType string) (int, bool) {
	if attacker == nil || baseDamage <= 0 {
		return baseDamage, false
	}

	finalDamage := baseDamage
	isCrit := false

	// The four restored Eidolons take an active role in Malachar's encounter.
	// Health-derived phases make the modifier apply consistently to melee,
	// projectiles, zones, and every class ability that uses this damage funnel.
	if attacker.SubType == "UmbraPrime" && target != nil && target.Type == TypePlayer {
		switch darkKingPhase(attacker.Health, attacker.MaxHealth) {
		case 1:
			finalDamage = finalDamage * 80 / 100 // Orun shelters the raid.
		case 2:
			finalDamage = finalDamage * 90 / 100 // Neris softens the undertow.
		}
	}
	if target != nil && target.SubType == "UmbraPrime" && attacker.Type == TypePlayer {
		switch darkKingPhase(target.Health, target.MaxHealth) {
		case 3:
			finalDamage = finalDamage * 125 / 100 // Pyralis exposes the false king.
		case 4:
			finalDamage = finalDamage * 135 / 100 // Aeral carries the final assault.
		}
	}

	// Unique Effect: lucky - 10% chance for double damage
	if attacker.HasUniqueEffect("lucky") {
		if rand.Float64() < 0.10 {
			finalDamage *= 2
			isCrit = true
		}
	}

	if attacker.CritChanceBonus > 0 && rand.Float64() < attacker.CritChanceBonus {
		finalDamage *= 2
		isCrit = true
	}

	// Unique Effect: executioner - +25% damage vs targets below 25% HP
	if attacker.HasUniqueEffect("executioner") && target != nil {
		if target.MaxHealth > 0 && target.Health <= target.MaxHealth/4 {
			finalDamage = finalDamage * 125 / 100
		}
	}

	// Set Bonus: Warlord's Fury 6pc (ironFortressDamage) - Double damage during Iron Fortress
	if attacker.HasAnySetBonus("ironFortressDamage") && attacker.IronFortressActive {
		finalDamage *= 2
	}

	// Set Bonus: Shadow's Embrace 4pc (backstabAnyAngle) is handled in Backstab ability itself
	if target != nil && target.MarkWeakness {
		factor := target.MarkWeaknessFactor
		if factor <= 0 {
			factor = 0.20
		}
		finalDamage = int(float64(finalDamage) * (1.0 + factor))
	}

	// Apply damage type bonuses from socketed gems and set bonuses.
	switch damageType {
	case "poison":
		if attacker.PoisonDamageBonus > 0 {
			finalDamage = int(float64(finalDamage) * (1.0 + attacker.PoisonDamageBonus))
		}
	case "fire":
		if attacker.FireDamageBonus > 0 {
			finalDamage = int(float64(finalDamage) * (1.0 + attacker.FireDamageBonus))
		}
	case "holy":
		if attacker.HolyDamageBonus > 0 {
			finalDamage = int(float64(finalDamage) * (1.0 + attacker.HolyDamageBonus))
		}
	}
	finalDamage = ScalePvPDamage(attacker, target, finalDamage)

	return finalDamage, isCrit
}

// ApplyDamageReflect handles damage reflection from set bonuses and unique effects.
// Call this after damage is dealt to reflect damage back to attacker.
// Returns the reflected damage amount.
func ApplyDamageReflect(attacker, defender *Entity, damageDealt int) int {
	if defender == nil || attacker == nil || damageDealt <= 0 {
		return 0
	}

	reflectedDamage := 0

	// Unique Effect: thorns - Reflect 10% damage taken
	if defender.HasUniqueEffect("thorns") {
		reflectedDamage += damageDealt * 10 / 100
	}

	// Set Bonus: Bulwark of Ages 4pc (damageReflect) - 5% damage reflect
	if defender.HasAnySetBonus("damageReflect") {
		reflectedDamage += damageDealt * 5 / 100
	}

	return reflectedDamage
}

// snapshotCombatAttackerLocked captures the mutable attacker fields consulted
// by delayed damage calculation. The caller must hold attacker.Mu. Keeping a
// value snapshot avoids holding two entity locks in opposite orders while an
// attack and retaliation resolve concurrently.
func snapshotCombatAttackerLocked(attacker *Entity) *Entity {
	if attacker == nil {
		return nil
	}
	snapshot := &Entity{
		ID:                  attacker.ID,
		InstanceID:          attacker.InstanceID,
		Type:                attacker.Type,
		SubType:             attacker.SubType,
		Health:              attacker.Health,
		MaxHealth:           attacker.MaxHealth,
		RaidPhase:           attacker.RaidPhase,
		Damage:              attacker.Damage,
		Stats:               attacker.Stats,
		CritChanceBonus:     attacker.CritChanceBonus,
		PoisonDamageBonus:   attacker.PoisonDamageBonus,
		FireDamageBonus:     attacker.FireDamageBonus,
		HolyDamageBonus:     attacker.HolyDamageBonus,
		IronFortressActive:  attacker.IronFortressActive,
		PoisonCoatingActive: attacker.PoisonCoatingActive,
		QAGuaranteedLoot:    attacker.QAGuaranteedLoot,
	}
	snapshot.ActiveUniqueEffects = append([]string(nil), attacker.ActiveUniqueEffects...)
	if attacker.ActiveSetBonuses != nil {
		snapshot.ActiveSetBonuses = make(map[string]map[string]int, len(attacker.ActiveSetBonuses))
		for setID, bonuses := range attacker.ActiveSetBonuses {
			bonusCopy := make(map[string]int, len(bonuses))
			for key, value := range bonuses {
				bonusCopy[key] = value
			}
			snapshot.ActiveSetBonuses[setID] = bonusCopy
		}
	}
	return snapshot
}
