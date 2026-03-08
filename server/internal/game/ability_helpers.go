package game

import "time"

const (
	baseActorVisualRadius        = 1.25
	maxAbilityTargetVisualRadius = 5.0
	meteorImpactVisualScale      = 1.65
)

func visualAbilityRadius(effectName string, radius float64) float64 {
	if radius <= 0 {
		return radius
	}

	switch effectName {
	case "Meteor Drop", "Meteor":
		return radius * meteorImpactVisualScale
	default:
		return radius
	}
}

// fireAbilityEvent emits an "ability" event if a listener is registered.
// This replaces the repeated `if w.OnEvent != nil { w.OnEvent("ability", ...) }` pattern.
func (w *World) fireAbilityEvent(sourceID, targetID, skillName string, targetX, targetZ float64) {
	if w.OnEvent != nil {
		w.OnEvent("ability", AbilityEvent{
			SourceID:  sourceID,
			TargetID:  targetID,
			SkillName: skillName,
			TargetX:   targetX,
			TargetZ:   targetZ,
		})
	}
}

// fireDamageEvent emits a "damage" event if a listener is registered.
func (w *World) fireDamageEvent(sourceID, targetID string, amount int) {
	if amount > 0 && sourceID != "" {
		if source, ok := w.Entities[sourceID]; ok && source != nil && source.LifestealBonus > 0 {
			healAmount := int(float64(amount) * source.LifestealBonus)
			if healAmount > 0 {
				source.Health += healAmount
				if source.Health > source.MaxHealth {
					source.Health = source.MaxHealth
				}
			}
		}
	}

	if w.OnEvent != nil {
		w.OnEvent("damage", DamageEvent{
			TargetID: targetID,
			SourceID: sourceID,
			Amount:   amount,
		})
	}
}

// fireHealEvent emits a "heal" event if a listener is registered.
func (w *World) fireHealEvent(sourceID, targetID string, amount int) {
	if w.OnEvent != nil {
		w.OnEvent("heal", HealEvent{
			TargetID: targetID,
			SourceID: sourceID,
			Amount:   amount,
		})
	}
}

func applyHealingDoneBonus(source *Entity, amount int) int {
	if source == nil || amount <= 0 || source.HealingDoneBonus <= 0 {
		return amount
	}
	boosted := int(float64(amount) * (1.0 + source.HealingDoneBonus))
	if boosted < 1 {
		return 1
	}
	return boosted
}

func applyFinalDamage(attacker, target *Entity, baseDamage int, damageType string) int {
	if target == nil || baseDamage <= 0 {
		return 0
	}
	finalDamage, _ := CalculateFinalDamage(attacker, target, baseDamage, damageType)
	target.Health -= finalDamage
	return finalDamage
}

func (w *World) fireTelegraphEvent(sourceID string, x, z, radius float64, duration time.Duration) {
	if w.OnEvent != nil {
		w.OnEvent("telegraph", TelegraphEvent{
			SourceID: sourceID,
			X:        x,
			Z:        z,
			Radius:   radius,
			Duration: duration.Seconds(),
		})
	}
}

// delayedIdleReset schedules a goroutine that resets the given entity's state
// from "ATTACKING" back to "IDLE" after 1 second. Used by Wizard cast animations.
func (w *World) delayedIdleReset(playerID string) {
	go func(pid string) {
		time.Sleep(1 * time.Second)
		w.Mu.Lock()
		if p, ok := w.Entities[pid]; ok && p.State == "ATTACKING" {
			p.State = "IDLE"
		}
		w.Mu.Unlock()
	}(playerID)
}

// expandedAbilityRadius increases the grid query for AoEs so we do not miss
// large targets whose centers sit just outside the VFX edge.
func expandedAbilityRadius(effectName string, radius float64) float64 {
	if radius <= 0 {
		return radius
	}
	return visualAbilityRadius(effectName, radius) + maxAbilityTargetVisualRadius
}

func entityVisualRadius(target *Entity) float64 {
	if target == nil {
		return 0
	}
	if target.Radius > 0 {
		return target.Radius
	}
	if target.Type != TypeEnemy && target.Type != TypePlayer && target.Type != TypeNPC {
		return 0
	}
	scale := target.Scale
	if scale <= 0 {
		scale = 1.0
	}
	return baseActorVisualRadius * scale
}

func withinAbilityRadius(effectName string, originX, originZ float64, target *Entity, radius float64) bool {
	if target == nil {
		return false
	}
	effectiveRadius := visualAbilityRadius(effectName, radius) + entityVisualRadius(target)
	dx := originX - target.X
	dz := originZ - target.Z
	return (dx*dx + dz*dz) <= effectiveRadius*effectiveRadius
}
