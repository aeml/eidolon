package game

// Active cast snapshots. Legacy active entities retain the original rune/boost
// radius, without inferring a new radius from later talent allocations.
func (e *Entity) SpiritAreaRadius() float64 {
	if e == nil || !e.SpiritsActive {
		return 0
	}
	if e.SpiritRadius > 0 {
		return e.SpiritRadius
	}
	return spiritGuardiansRadius(e.SpiritsBoosted, e.SpiritGuardiansRuneID)
}

func (e *Entity) ActiveSpiritRune() string {
	if e == nil || !e.SpiritsActive {
		return ""
	}
	return e.SpiritGuardiansRuneID
}
