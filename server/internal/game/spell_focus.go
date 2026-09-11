package game

// ActiveSpellFocusMultiplier reads the paid cast's stored charge. Legacy active
// charges without a stored value retain the original untrained 2.5 multiplier.
// Training is captured at activation, not re-read when the charge is consumed.
func (e *Entity) ActiveSpellFocusMultiplier() float64 {
	if e == nil || !e.SpellFocusActive {
		return 1
	}
	if e.SpellFocusMultiplier >= 2.5 && e.SpellFocusMultiplier <= 3 {
		return e.SpellFocusMultiplier
	}
	return 2.5
}
