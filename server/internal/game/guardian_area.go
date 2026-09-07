package game

// GuardianEmbraceAreaRadius is the active aura's cast-time snapshot. Old active
// fixtures without the field retain the original 10m base, not a private rank
// inference. The caller holds the entity lock or owns the unpublished entity.
func (e *Entity) GuardianEmbraceAreaRadius() float64 {
	if e == nil || !e.GuardianEmbraceActive {
		return 0
	}
	if e.GuardianEmbraceRadius > 0 {
		return e.GuardianEmbraceRadius
	}
	return 10
}
