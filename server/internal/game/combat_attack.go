package game

import (
	"math"
	"math/rand"
	"time"
)

// Shared admission/impact reach, including the visible bodies of large actors.
func basicAttackReach(kind EntityType, subtype string, scale, targetScale float64) float64 {
	reach := 3.0
	if kind == TypePlayer {
		reach = 4
		if subtype == "Wizard" || subtype == "Rogue" {
			reach = 16
		}
	} else if subtype == "DwarfSalesman" {
		reach = 6
	}
	if scale > 1 {
		reach += (scale - 1) * 1.5
	}
	if targetScale > 1 {
		reach += (targetScale - 1) * 1.5
	}
	return reach
}

func (w *World) PerformAttack(attackerID, targetID string) (int, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	attacker, ok := w.Entities[attackerID]
	if !ok {
		return 0, false
	}
	attacker.Mu.RLock()
	attackerBlocked := attacker.State == "DEAD" || attacker.State == "JUMPING" || attacker.IsCharging || attacker.Stunned
	attackerInstanceID := attacker.InstanceID
	attackerType := attacker.Type
	attackerSubType := attacker.SubType
	attackerX, attackerZ := attacker.X, attacker.Z
	attackerScale := attacker.Scale
	attackCooldown := attacker.AttackCooldown
	lastAttackTime := attacker.LastAttackTime
	attacker.Mu.RUnlock()
	if attackerBlocked || time.Since(lastAttackTime) < attackCooldown {
		return 0, false
	}

	target, ok := w.Entities[targetID]
	if !ok {
		return 0, false
	}
	target.Mu.RLock()
	targetBlocked := target.State == "DEAD"
	targetInstanceID := target.InstanceID
	targetType := target.Type
	targetX, targetZ := target.X, target.Z
	targetScale := target.Scale
	target.Mu.RUnlock()
	if targetBlocked || attackerInstanceID != targetInstanceID {
		return 0, false
	}

	if !w.CanDamage(attacker, target) {
		return 0, false
	}

	// NO NPC ATTACKS
	if targetType == TypeNPC || targetType == TypeForge || targetType == TypeStash {
		return 0, false
	}

	// Check Range (Simple distance check)
	dx := attackerX - targetX
	dz := attackerZ - targetZ
	dist := math.Sqrt(dx*dx + dz*dz)

	attackRange := basicAttackReach(attackerType, attackerSubType, attackerScale, targetScale)

	if dist > attackRange {
		return 0, false
	}
	walkRects := w.dungeonWalkRectsSnapshot(attackerInstanceID)
	if _, _, blocked := firstDungeonWalkRectWallHit(walkRects, attackerX, attackerZ, targetX, targetZ); blocked {
		return 0, false
	}

	// Commit atomically after validation. Recheck the mutable action gates in
	// case a parallel world tick applied crowd control during target validation.
	attacker.Mu.Lock()
	if attacker.State == "DEAD" || attacker.State == "JUMPING" || attacker.IsCharging || attacker.Stunned ||
		time.Since(attacker.LastAttackTime) < attacker.AttackCooldown {
		attacker.Mu.Unlock()
		return 0, false
	}
	attacker.LastAttackTime = time.Now()
	attacker.State = "ATTACKING"
	delay := time.Duration(float64(attacker.AttackCooldown) * 0.35)
	missChance := attacker.AccuracyReduction
	attacker.Mu.Unlock()
	if w.OnEvent != nil {
		w.OnEvent("attack", AttackEvent{
			SourceID: attackerID,
			TargetID: targetID,
			TargetX:  targetX,
			TargetZ:  targetZ,
		})
	}

	w.runBackground(func() {
		if !w.waitBackground(delay) {
			return
		}
		w.applyAttackImpact(attackerID, targetID, attackerInstanceID, walkRects, missChance)
	})
	return 0, true
}

// applyAttackImpact is the actual post-wind-up damage path. Geometry is a
// private snapshot taken before actor locking at attack admission.
func (w *World) applyAttackImpact(attID, tgtID, attackerInstanceID string, walkRects []DungeonWalkRect, blindedMissChance float64) {

	// Use fine-grained locking instead of global lock
	att := w.GetEntity(attID)
	if att == nil {
		return
	}
	tgt := w.GetEntity(tgtID)
	if tgt == nil {
		return
	}
	if !w.CanDamage(att, tgt) {
		return
	}
	if blindedMissChance > 0 && rand.Float64() < blindedMissChance {
		return
	}
	att.Mu.Lock()
	// An accepted wind-up is not permission to land a swing while stunned.
	// This does not remove projectiles already launched or alter boss immunity.
	if att.State == "DEAD" || att.Stunned || att.InstanceID != attackerInstanceID {
		att.Mu.Unlock()
		return
	}
	impactX, impactZ, impactScale := att.X, att.Z, att.Scale
	cloakBonus := att.CloakNextAttackBonus
	if att.Type == TypePlayer && cloakBonus > 0 {
		att.CloakNextAttackBonus = 0
		att.StealthActive = false // Break stealth on attack
		att.CloakSwiftSpeedBonus = false
		att.RecalculateStats()
	}
	attackerSnapshot := snapshotCombatAttackerLocked(att)
	att.Mu.Unlock()
	qaDeterministicEncounter := attackerSnapshot.Type == TypePlayer && attackerSnapshot.QAGuaranteedLoot
	poisonSpreads := attackerSnapshot.HasAnySetBonus("poisonSpread")
	impacts := &abilityImpactContext{world: w}
	defer impacts.flush() // HP/death bookkeeping precedes lock-free retaliation.

	// Lock target for modification
	tgt.Mu.Lock()
	if tgt.State == "DEAD" || tgt.InstanceID != attackerInstanceID {
		tgt.Mu.Unlock()
		return
	}
	// Enemy melee is avoidable during its wind-up. A legal attack start must
	// not reserve damage against a player who has since escaped its reach.
	// Player attacks, projectiles and separately telegraphed boss abilities
	// retain their existing resolution rules.
	if attackerSnapshot.Type == TypeEnemy && math.Hypot(tgt.X-impactX, tgt.Z-impactZ) >
		basicAttackReach(attackerSnapshot.Type, attackerSnapshot.SubType, impactScale, tgt.Scale) {
		tgt.Mu.Unlock()
		return
	}
	// A valid wind-up is not permission to hit through a wall after either
	// actor moves. The copied geometry needs no instance lock here.
	if _, _, blocked := firstDungeonWalkRectWallHit(walkRects, impactX, impactZ, tgt.X, tgt.Z); blocked {
		tgt.Mu.Unlock()
		return
	}
	poisonApplied := false
	poisonBudget := statusDamageBudget{}
	poisonEndTime := time.Time{}

	defense := tgt.Defense - tgt.ArmorReduction
	if defense < 0 {
		defense = 0
	}

	// Bosses ignore 50% of defense
	bosses := map[string]bool{
		"InfernoTitan": true, "Siren": true, "FrostGuardian": true,
		"MountainTroll": true, "AquaGolem": true, "RootboundWarden": true,
		"BriarMatron": true, "RustboundColossus": true, "HollowSentinel": true,
		"Avenging Seraph": true,
	}
	if bosses[attackerSnapshot.SubType] {
		defense = defense / 2
	}

	damage := attackerSnapshot.Damage - defense
	if damage < 1 {
		damage = 1
	}
	if qaDeterministicEncounter && tgt.Type == TypeEnemy && damage < tgt.Health {
		damage = tgt.Health
	}

	// Cloak Prepared Ambush rune: next attack deals +100% damage
	if cloakBonus > 0 {
		damage = int(float64(damage) * (1.0 + cloakBonus))
	}

	// Compute the final outgoing budget once, before receiving defenses.
	// Shields must see criticals and PvP scaling/caps just like an HP hit does.
	damage, _ = CalculateFinalDamage(attackerSnapshot, tgt, damage, "physical")

	// The allowlisted near-death gate still uses a normal hostile AI swing,
	// range check, cooldown, and asynchronous damage path. Once its explicit
	// waypoint protection has been removed, do not let a residual fractional
	// mitigation or absorb round that already-minimal real hit back to zero.
	qaNearDeathHit := tgt.Type == TypePlayer && tgt.Health == 1 &&
		time.Now().Before(tgt.QAHealthRegenPausedUntil) && tgt.InvulnerableEndTime.IsZero() &&
		tgt.QAWaypointProtectionEndTime.IsZero()
	actualDamage := impacts.receiveDamageLocked(attackerSnapshot.ID, tgt, damage, "physical", time.Now())
	if qaNearDeathHit && actualDamage < 1 {
		actualDamage = 1
		tgt.Health--
	}

	if attackerSnapshot.Type == TypePlayer && tgt.Type == TypeEnemy {
		addThreatLocked(tgt, attackerSnapshot.ID, float64(actualDamage))
	}

	// Apply On-Hit Effects
	if attackerSnapshot.PoisonCoatingActive {
		tgt.Poisoned = true
		poisonBudget = rawStatusBudget(attackerSnapshot, "Poison Coating", 8+attackerSnapshot.Stats.Dexterity/2, "poison")
		tgt.PoisonDamage = poisonBudget.forTarget(attackerSnapshot, tgt)
		tgt.PoisonSourceID = attackerSnapshot.ID
		tgt.PoisonEndTime = time.Now().Add(resolveAbilityEffectDuration(attackerSnapshot, "Poison Coating", 8*time.Second))
		poisonApplied = true
		poisonEndTime = tgt.PoisonEndTime
	}

	isDead := tgt.Health <= 0
	tgt.Mu.Unlock() // Unlock target before event/death handling to avoid holding too long?
	// No, handleDeath expects target to be locked?
	// Let's check handleDeath contract.
	// In updateProjectiles, target IS locked.
	// So we should keep it locked or re-lock.

	if w.OnEvent != nil {
		w.OnEvent("damage", DamageEvent{TargetID: tgt.ID, SourceID: attackerSnapshot.ID, Amount: actualDamage, Kind: "physical", InstanceID: attackerSnapshot.InstanceID})
	}
	if poisonApplied && poisonSpreads {
		w.spreadPoison(attackerSnapshot, tgt, poisonBudget, poisonEndTime)
	}

	if isDead {
		tgt.Mu.Lock() // Re-lock for death handling
		// Double check if still dead (race condition?)
		if tgt.Health <= 0 && tgt.State != "DEAD" {
			w.handleDeath(tgt, att, nil)
		}
		tgt.Mu.Unlock()
	}
}
