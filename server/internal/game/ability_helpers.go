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
func (w *World) fireAbilityEvent(sourceID, targetID, skillName string, targetX, targetZ float64, shapes ...AbilityShape) {
	if w.OnEvent != nil {
		event := AbilityEvent{
			SourceID:  sourceID,
			TargetID:  targetID,
			SkillName: skillName,
			TargetX:   targetX,
			TargetZ:   targetZ,
		}
		if len(shapes) > 0 {
			event.Radius, event.Arc = shapes[0].Radius, shapes[0].Arc
			event.ShapeResolved = true
		}
		w.OnEvent("ability", event)
	}
}

func (w *World) fireProjectileImpactEvent(event ProjectileImpactEvent) {
	if w.OnEvent != nil {
		w.OnEvent("projectile_impact", event)
	}
}

// Keep targeting and movement separate: old clients still receive the same aim
// point, while new clients can commit even a sub-three-unit authoritative blink.
func (w *World) fireAbilityLandingEvent(sourceID, targetID, skillName string, targetX, targetZ float64, landing AbilityLanding) {
	if w.OnEvent != nil {
		w.OnEvent("ability", AbilityEvent{SourceID: sourceID, TargetID: targetID, SkillName: skillName,
			TargetX: targetX, TargetZ: targetZ, Landing: &landing})
	}
}

// Callers pass the live combat owner, not a damage snapshot. This helper is
// used both inside locked ability dispatch and by unlocked periodic effects:
// looking up the world map here would race loot insertion, while taking the
// world lock again would deadlock the already-locked callers.
func (w *World) fireDamageEvent(source *Entity, targetID string, amount int, kind, instanceID string) {
	sourceID := ""
	if source != nil {
		sourceID = source.ID
	}
	actualLifesteal := 0
	lifestealInstanceID := instanceID
	if amount > 0 && sourceID != "" {
		source.Mu.Lock()
		if lifestealInstanceID == "" {
			lifestealInstanceID = source.InstanceID
		}
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

	if w.OnEvent != nil {
		w.OnEvent("damage", DamageEvent{
			TargetID: targetID, SourceID: sourceID, Amount: amount,
			Kind: kind, InstanceID: instanceID,
		})
	}
	if actualLifesteal > 0 {
		w.fireHealEvent(sourceID, sourceID, actualLifesteal, "lifesteal", lifestealInstanceID)
	}
}

// fireHealEvent emits a "heal" event if a listener is registered.
func (w *World) fireHealEvent(sourceID, targetID string, amount int, kind, instanceID string) {
	if w.OnEvent != nil {
		w.OnEvent("heal", HealEvent{
			TargetID: targetID, SourceID: sourceID, Amount: amount,
			Kind: kind, InstanceID: instanceID,
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

// applyAbilityHealingBonus composes spell talents with the existing equipment
// rounding. Receiving-target modifiers and overheal clamps remain at the caller.
// Renewal stores this already-modified cast amount; do not apply it again there.
func applyAbilityHealingBonus(source *Entity, skillName string, amount int) int {
	amount = applyHealingDoneBonus(source, amount)
	if source == nil || amount <= 0 {
		return amount
	}
	bonus := math.Max(0, source.GetSkillBonus(skillName).SkillHealing)
	return int(math.Floor(float64(amount)*(1+bonus) + 1e-9))
}

// resolveAbilityEffectDuration snapshots applicable duration ranks at cast time,
// after authored rune changes. It never scales cooldowns, impact delays, movement
// locks or the already-resolved remaining timer replicated to clients.
func resolveAbilityEffectDuration(source *Entity, skillName string, base time.Duration) time.Duration {
	if source == nil || base <= 0 {
		return base
	}
	return scaleAbilityEffectDuration(base, source.GetSkillBonus(skillName).SkillDuration)
}

// Also accepts a bonus captured before travel or a delayed impact. It must not
// read a potentially changed build when the effect finally reaches its target.
func scaleAbilityEffectDuration(base time.Duration, bonus float64) time.Duration {
	if base <= 0 {
		return base
	}
	return time.Duration(math.Round(float64(base) * (1 + math.Max(0, bonus))))
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

func applyFinalDamage(attacker, target *Entity, baseDamage int, damageType string, skills ...string) int {
	skillName := ""
	if len(skills) > 0 {
		skillName = skills[0]
	}
	return applyFinalDamageWithCritical(attacker, target, baseDamage, damageType, skillName, false)
}

func applyFinalDamageWithCritical(attacker, target *Entity, baseDamage int, damageType, skillName string, guaranteedCritical bool) int {
	if target == nil || baseDamage <= 0 {
		return 0
	}
	finalDamage, _ := calculateFinalDamageWithCritical(attacker, target, baseDamage, damageType, skillName, guaranteedCritical)
	finalDamage = damageWithinDarkKingPhase(target, finalDamage)
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

// ReplicatedBodyRadius exposes the existing authoritative combat footprint to
// client movement. Call under the entity's read lock (or on an owned snapshot).
// BodyRadius carries the value through stripped broadcast copies, whose private
// Radius field is intentionally omitted for actors.
func (e *Entity) ReplicatedBodyRadius() float64 {
	if e == nil {
		return 0
	}
	if e.BodyRadius > 0 {
		return e.BodyRadius
	}
	if e.Type != TypeEnemy && e.Type != TypePlayer && e.Type != TypeNPC {
		return 0
	}
	return entityVisualRadius(e)
}

// Meteor geometry is captured by the cast, not reconstructed from the owner's
// current/private ranks. Copies carry it even when private Radius is stripped.
func (e *Entity) ReplicatedImpactRadius() float64 {
	if e == nil || e.Type != TypeProjectile || e.SubType != "Meteor" {
		return 0
	}
	if e.ImpactRadius > 0 {
		return e.ImpactRadius
	}
	return visualAbilityRadius("Meteor", e.Radius)
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

// Area effects use a private canonical-floor snapshot. Callers may hold the
// target lock here; geometry checks must not acquire instance locks under it.
func withinDungeonAbilityRadius(rects []DungeonWalkRect, effectName string, originX, originZ float64, target *Entity, radius float64) bool {
	if !withinAbilityRadius(effectName, originX, originZ, target, radius) {
		return false
	}
	return dungeonEffectReachesTarget(rects, originX, originZ, target)
}

func dungeonEffectReachesTarget(rects []DungeonWalkRect, originX, originZ float64, target *Entity) bool {
	if target == nil {
		return false
	}
	_, _, blocked := firstDungeonWalkRectWallHit(rects, originX, originZ, target.X, target.Z)
	return !blocked
}

// Check the clamped ground destination before spending resources or consuming
// a combo. A destination in another room is not legal through a solid wall.
func (w *World) validDungeonGroundCastTarget(player *Entity, x, z float64) bool {
	if player == nil || math.IsNaN(x) || math.IsNaN(z) || math.IsInf(x, 0) || math.IsInf(z, 0) {
		return false
	}
	_, _, blocked := w.firstDungeonWallHit(player.InstanceID, player.X, player.Z, x, z)
	return !blocked
}

func validDirectAbilityTarget(w *World, player, target *Entity, maxRange float64, allowedTypes ...EntityType) bool {
	if player == nil || target == nil || player.InstanceID != target.InstanceID || target.State == "DEAD" {
		return false
	}
	typeAllowed := false
	offensive := false
	for _, allowedType := range allowedTypes {
		if allowedType == TypeEnemy {
			offensive = true
		}
		if target.Type == allowedType {
			typeAllowed = true
			break
		}
	}
	if !typeAllowed {
		if !offensive || target.Type != TypePlayer {
			return false
		}
	}
	if offensive && !w.CanDamage(player, target) {
		return false
	}
	if !offensive && target.Type == TypePlayer && w.CombatRelationship(player, target) == RelationshipHostile {
		return false
	}
	inRange := maxRange <= 0 || math.Hypot(target.X-player.X, target.Z-player.Z) <= maxRange+entityVisualRadius(target)
	if !inRange {
		return false
	}
	if offensive {
		// Range alone cannot authorize a hostile target in the room behind a
		// solid wall. Friendly support and noncanonical instances retain their
		// existing rules; real doorways remain valid paths.
		_, _, blocked := w.firstDungeonWallHit(player.InstanceID, player.X, player.Z, target.X, target.Z)
		return !blocked
	}
	return true
}

func (w *World) spreadPoison(source, primaryTarget *Entity, damage int, endTime time.Time) {
	if w == nil || source == nil || primaryTarget == nil || damage <= 0 {
		return
	}
	const radius = 5.0
	primaryTarget.Mu.RLock()
	primaryID, originX, originZ, instanceID := primaryTarget.ID, primaryTarget.X, primaryTarget.Z, primaryTarget.InstanceID
	primaryTarget.Mu.RUnlock()
	walkRects := w.dungeonWalkRectsSnapshot(instanceID)
	for _, target := range w.Grid.Nearby(originX, originZ, radius+maxAbilityTargetVisualRadius, instanceID) {
		if target.ID == primaryID {
			continue
		}
		target.Mu.Lock()
		if w.CanDamage(source, target) && target.State != "DEAD" && withinDungeonAbilityRadius(walkRects, "Poison Spread", originX, originZ, target, radius) {
			target.Poisoned = true
			target.PoisonDamage = damage
			target.PoisonSourceID = source.ID
			target.PoisonEndTime = endTime
		}
		target.Mu.Unlock()
	}
}
