package game

// Capture only the named Mastery. Generic skill damage is applied by the hit
// consumer and must not be applied a second time by a stat buff. Normalize a
// private copy so legacy rank aliases work without mutating the saved build.
func fighterDamageBuffMultiplierAtCast(caster *Entity, skill string) float64 {
	id, base := "FTR_19", 1.5
	if skill == "Last Stand Rampage" {
		id, base = "FTR_25", 3
	} else if skill != "Berserker Edge" {
		return 1
	}
	training := snapshotCombatAttackerLocked(caster)
	if training == nil {
		return base
	}
	training.NormalizeTalentRanks()
	// Algebraically base*(1+.04*rank), without rounding 1.8/3.6 downward
	// through a chained fractional multiplication before damage truncation.
	return base * float64(25+training.TalentRanks[id]) / 25
}

func activeDamageBuffMultiplier(active bool, stored, base, maximum float64) float64 {
	if !active {
		return 1
	}
	if stored >= base && stored <= maximum {
		return stored
	}
	// Legacy active buffs had no stored strength. Invalid values must not
	// grant an unbounded multiplier or poison the character's derived stats.
	return base
}

func (e *Entity) ActiveBerserkerModeMultiplier() float64 {
	return activeDamageBuffMultiplier(e.BerserkerModeActive, e.BerserkerModeMultiplier, 1.5, 1.8)
}

func (e *Entity) ActiveLastStandMultiplier() float64 {
	return activeDamageBuffMultiplier(e.LastStandActive, e.LastStandMultiplier, 3, 3.6)
}
