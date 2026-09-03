package game

import (
	"math"
	"time"
)

const (
	baseActorVisualRadius        = 1.25
	maxAbilityTargetVisualRadius = 5.0
	meteorImpactVisualScale      = 1.65
	spiritGuardiansBaseRadius    = 16.0
	spiritGuardiansBoostRadius   = 20.0
	spiritGuardiansExpandedScale = 1.5
)

func spiritGuardiansRadius(boosted bool, runeID string) float64 {
	radius := spiritGuardiansBaseRadius
	if boosted {
		radius = spiritGuardiansBoostRadius
	}
	if runeID == "spirits_expanded" {
		radius *= spiritGuardiansExpandedScale
	}
	return radius
}

// consumePersistentDuration keeps production ability timing unchanged while
// allowing an explicitly allowlisted QA character to exercise join-in-progress
// reconstruction through an otherwise normal authoritative cast.
func consumePersistentDuration(player *Entity, normal time.Duration) time.Duration {
	if player == nil || player.QAPersistentDuration <= normal {
		return normal
	}
	duration := player.QAPersistentDuration
	player.QAPersistentDuration = 0
	return duration
}

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
	actualLifesteal := 0
	if amount > 0 && sourceID != "" {
		if source, ok := w.Entities[sourceID]; ok && source != nil {
			source.Mu.Lock()
			healAmount := applyHealingReceived(source, int(float64(amount)*source.LifestealBonus))
			if healAmount > 0 {
				previousHealth := source.Health
				source.Health += healAmount
				if source.Health > source.MaxHealth {
					source.Health = source.MaxHealth
				}
				actualLifesteal = source.Health - previousHealth
			}
			source.Mu.Unlock()
		}
	}

	if w.OnEvent != nil {
		w.OnEvent("damage", DamageEvent{
			TargetID: targetID,
			SourceID: sourceID,
			Amount:   amount,
		})
	}
	if actualLifesteal > 0 {
		w.fireHealEvent(sourceID, sourceID, actualLifesteal)
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

// applyHealingReceived applies target-side healing modifiers. Poison Coating's
// client contract is a 50% reduction and follows the poison itself, including
// spread poison and projectile-applied poison.
func applyHealingReceived(target *Entity, amount int) int {
	if target == nil || amount <= 0 {
		return amount
	}
	// The allowlisted near-death release check must remain at one health until
	// a real hostile hit arrives. This also covers healing from an already
	// replicated zone or ally, not just the normal global regeneration tick.
	if time.Now().Before(target.QAHealthRegenPausedUntil) {
		return 0
	}
	if target.Poisoned {
		amount /= 2
		if amount < 1 {
			amount = 1
		}
	}
	return amount
}

func applyFinalDamage(attacker, target *Entity, baseDamage int, damageType string) int {
	if target == nil || baseDamage <= 0 {
		return 0
	}
	finalDamage, _ := CalculateFinalDamage(attacker, target, baseDamage, damageType)
	target.Health -= finalDamage
	target.LastDamageType = damageType
	return finalDamage
}

func (w *World) fireTelegraphEvent(sourceID string, x, z, radius float64, duration time.Duration) {
	if w.OnEvent != nil {
		w.OnEvent("telegraph", TelegraphEvent{
			SourceID:   sourceID,
			X:          x,
			Z:          z,
			Radius:     radius,
			Duration:   duration.Seconds(),
			Attack:     "spell_impact",
			ThreatTier: "danger",
			Label:      "IMPACT",
		})
	}
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

func validDirectAbilityTarget(player, target *Entity, maxRange float64, allowedTypes ...EntityType) bool {
	if player == nil || target == nil || player.InstanceID != target.InstanceID || target.State == "DEAD" {
		return false
	}
	typeAllowed := false
	for _, allowedType := range allowedTypes {
		if target.Type == allowedType {
			typeAllowed = true
			break
		}
	}
	if !typeAllowed {
		return false
	}
	if maxRange <= 0 {
		return true
	}
	return math.Hypot(target.X-player.X, target.Z-player.Z) <= maxRange+entityVisualRadius(target)
}

func (w *World) spreadPoison(source, primaryTarget *Entity, damage int, endTime time.Time) {
	if w == nil || source == nil || primaryTarget == nil || damage <= 0 {
		return
	}
	const radius = 5.0
	primaryTarget.Mu.RLock()
	primaryID, originX, originZ, instanceID := primaryTarget.ID, primaryTarget.X, primaryTarget.Z, primaryTarget.InstanceID
	primaryTarget.Mu.RUnlock()
	for _, target := range w.Grid.Nearby(originX, originZ, radius+maxAbilityTargetVisualRadius, instanceID) {
		if target.ID == primaryID {
			continue
		}
		target.Mu.Lock()
		if target.Type == TypeEnemy && target.State != "DEAD" && withinAbilityRadius("Poison Spread", originX, originZ, target, radius) {
			target.Poisoned = true
			target.PoisonDamage = damage
			target.PoisonSourceID = source.ID
			target.PoisonEndTime = endTime
		}
		target.Mu.Unlock()
	}
}
