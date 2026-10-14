package game

import "time"

const (
	spellFocusReservoir   = "spellfocus_reservoir"
	spellFocusAegis       = "spellfocus_aegis"
	spellFocusOverchannel = "spellfocus_overchannel"
)

type spellFocusPlan struct {
	runeID                string
	charges               int
	multiplier, wardScale float64
}

func planSpellFocus(runeID string, trainedMultiplier float64) spellFocusPlan {
	plan := spellFocusPlan{charges: 1, multiplier: trainedMultiplier, wardScale: 1}
	switch runeID {
	case spellFocusReservoir:
		// Split the SAME trained bonus between two paid casts. The original
		// spell's baseline damage is not counted twice as a mastery bonus.
		plan.runeID, plan.charges = runeID, 2
		plan.multiplier = 1 + (trainedMultiplier-1)/2
	case spellFocusAegis:
		plan.runeID, plan.wardScale = runeID, 2
		plan.multiplier = 1 + (trainedMultiplier-1)*.6
	case spellFocusOverchannel:
		plan.runeID, plan.wardScale = runeID, 0
		plan.multiplier = 1 + (trainedMultiplier-1)*1.25
	}
	return plan
}

func (e *Entity) ActiveSpellFocusCharges() int {
	if e == nil || !e.SpellFocusActive {
		return 0
	}
	if e.SpellFocusRuneID == spellFocusReservoir && e.SpellFocusCharges == 2 {
		return 2
	}
	// Existing active entities with no counter retain one charge.
	return 1
}

func (e *Entity) clearSpellFocus() {
	e.SpellFocusActive = false
	e.SpellFocusEndTime = time.Time{}
	e.SpellFocusMultiplier, e.SpellFocusCharges, e.SpellFocusRuneID = 0, 0, ""
}

func (e *Entity) consumeSpellFocus() {
	remaining := e.ActiveSpellFocusCharges() - 1
	if remaining <= 0 {
		e.clearSpellFocus()
		return
	}
	e.SpellFocusCharges = remaining
}

// ActiveSpellFocusMultiplier reads the paid cast's stored charge. Legacy active
// charges without a stored value retain the original untrained 2.5 multiplier.
// Training is captured at activation, not re-read when the charge is consumed.
func (e *Entity) ActiveSpellFocusMultiplier() float64 {
	if e == nil || !e.SpellFocusActive {
		return 1
	}
	minimum, maximum := 2.5, 3.0
	switch e.SpellFocusRuneID {
	case spellFocusReservoir:
		minimum, maximum = 1.75, 2
	case spellFocusAegis:
		minimum, maximum = 1.9, 2.2
	case spellFocusOverchannel:
		minimum, maximum = 2.875, 3.5
	}
	if e.SpellFocusMultiplier >= minimum && e.SpellFocusMultiplier <= maximum {
		return e.SpellFocusMultiplier
	}
	return minimum
}
