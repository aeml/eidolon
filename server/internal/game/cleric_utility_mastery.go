package game

// Snapshot the caster's named Mastery, not generic damage training or the
// recipient's talents. Stored power applies to the bonus, never to base stats.
// The caller owns the caster lock (or the ability's world mutation lock).
func clericUtilityPowerAtCast(caster *Entity, skill string) float64 {
	id := ""
	switch skill {
	case "Blessing of Resolve":
		id = "CLR_19"
	case "Blessing of Zeal":
		id = "CLR_21"
	case "Mark of Weakness":
		id = "CLR_23"
	default:
		return 1
	}
	training := snapshotCombatAttackerLocked(caster)
	if training == nil {
		return 1
	}
	training.NormalizeTalentRanks()
	return float64(25+training.TalentRanks[id]) / 25
}

// Legacy active blessings have no captured power. Nonfinite/out-of-range
// values also fall back to the ordinary blessing rather than corrupt stats.
func activeClericUtilityPower(active bool, stored float64) float64 {
	if !active {
		return 0
	}
	if stored >= 1 && stored <= 1.2 {
		return stored
	}
	return 1
}

func (e *Entity) ActiveBlessingResolvePower() float64 {
	return activeClericUtilityPower(e.BlessingResolveActive, e.BlessingResolvePower)
}

func (e *Entity) ActiveZealPower() float64 {
	return activeClericUtilityPower(e.ZealActive, e.ZealPower)
}

// Heaven's Trumpet shares this vulnerability slot at 50%; preserve that
// independent rune while bounding invalid values and legacy untyped marks.
func (e *Entity) ActiveMarkWeaknessFactor() float64 {
	if !e.MarkWeakness {
		return 0
	}
	if e.MarkWeaknessFactor > 0 && e.MarkWeaknessFactor <= .5 {
		return e.MarkWeaknessFactor
	}
	return .2
}
