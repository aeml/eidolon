package game

import (
	"math"
	"math/rand"
	"time"
)

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

	attackRange := 3.0 // Default enemy melee range
	if attackerType == TypePlayer {
		attackRange = 4.0
		if attackerSubType == "Wizard" || attackerSubType == "Rogue" {
			attackRange = 16.0
		}
	} else if attackerSubType == "DwarfSalesman" {
		attackRange = 6.0
	}

	// Adjust the selected base range for large attackers and targets.
	if attackerScale > 1.0 {
		attackRange += (attackerScale - 1.0) * 1.5
	}

	// Also adjust range for target's scale (allows melee to hit large bosses)
	if targetScale > 1.0 {
		attackRange += (targetScale - 1.0) * 1.5
	}

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

	go func() {
		time.Sleep(delay)
		w.applyAttackImpact(attackerID, targetID, attackerInstanceID, walkRects, missChance)
	}()
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
	if att.State == "DEAD" || att.InstanceID != attackerInstanceID {
		att.Mu.Unlock()
		return
	}
	impactX, impactZ := att.X, att.Z
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

	// Lock target for modification
	tgt.Mu.Lock()
	if tgt.State == "DEAD" || tgt.InstanceID != attackerInstanceID {
		tgt.Mu.Unlock()
		return
	}
	// A valid wind-up is not permission to hit through a wall after either
	// actor moves. The copied geometry needs no instance lock here.
	if _, _, blocked := firstDungeonWalkRectWallHit(walkRects, impactX, impactZ, tgt.X, tgt.Z); blocked {
		tgt.Mu.Unlock()
		return
	}
	pendingReflectDamage := 0
	poisonApplied := false
	poisonDamage := 0
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

	// Iron Fortress Thorns rune: reflect 20% damage back to attacker
	if tgt.Type == TypePlayer && tgt.IronFortressActive && tgt.IronFortressThorns {
		thornsDamage := damage / 5 // 20%
		if thornsDamage > 0 {
			pendingReflectDamage += thornsDamage
		}
	}

	// Gameplay invulnerability and allowlisted release-QA protection are
	// independent clocks; a short class effect must never shorten the latter.
	damageTime := time.Now()
	gameplayInvulnerable := !tgt.InvulnerableEndTime.IsZero() && damageTime.Before(tgt.InvulnerableEndTime)
	qaWaypointProtected := !tgt.QAWaypointProtectionEndTime.IsZero() && damageTime.Before(tgt.QAWaypointProtectionEndTime)
	if tgt.Type == TypePlayer && (gameplayInvulnerable || qaWaypointProtected) {
		damage = 0
	}

	// The two Sanctuary sources have distinct advertised strengths and may
	// overlap. Use the stronger active reduction rather than an approximation.
	sanctuaryReduction := 0.0
	if tgt.SanctuaryDamageReduction && time.Now().Before(tgt.SanctuaryEndTime) {
		sanctuaryReduction = 0.20
	}
	if !tgt.ConsecratedSanctuaryEndTime.IsZero() && time.Now().Before(tgt.ConsecratedSanctuaryEndTime) {
		sanctuaryReduction = 0.30
	}
	if sanctuaryReduction > 0 {
		damage = int(float64(damage) * (1.0 - sanctuaryReduction))
	}

	// Divine Intervention Guardian Angel rune: 50% damage reduction
	if tgt.DivineInterventionGuardian && time.Now().Before(tgt.DivineInterventionGuardTime) {
		damage = int(float64(damage) * 0.5)
	}

	// Arcane Shield absorption
	actualDamage := damage
	if tgt.Type == TypePlayer && tgt.ArcaneShieldActive && tgt.ArcaneShieldHP > 0 && damage > 0 {
		absorbed := damage
		if absorbed > tgt.ArcaneShieldHP {
			absorbed = tgt.ArcaneShieldHP
		}
		tgt.ArcaneShieldHP -= absorbed
		tgt.ArcaneShieldAbsorbed += absorbed
		actualDamage = damage - absorbed

		// Reflective rune: reflect 30% of absorbed damage
		if tgt.ArcaneShieldRuneID == "arcaneshield_reflective" {
			reflectDamage := absorbed * 30 / 100
			if reflectDamage > 0 {
				pendingReflectDamage += reflectDamage
			}
		}

		// Shield broken - check for explosive rune
		if tgt.ArcaneShieldHP <= 0 {
			if tgt.ArcaneShieldRuneID == "arcaneshield_explosive" {
				// Explode dealing absorbed amount to nearby enemies
				explosionDamage := tgt.ArcaneShieldAbsorbed
				explosionRadius := 6.0
				shieldX, shieldZ, shieldInstanceID, shieldOwnerID := tgt.X, tgt.Z, tgt.InstanceID, tgt.ID
				tgt.Mu.Unlock() // Unlock for grid search
				explosionNearby := w.Grid.Nearby(shieldX, shieldZ, explosionRadius, shieldInstanceID)
				for _, et := range explosionNearby {
					et.Mu.RLock()
					if et.Type != TypeEnemy || et.State == "DEAD" {
						et.Mu.RUnlock()
						continue
					}
					edx := shieldX - et.X
					edz := shieldZ - et.Z
					et.Mu.RUnlock()

					if (edx*edx + edz*edz) <= explosionRadius*explosionRadius {
						et.Mu.Lock()
						et.Health -= explosionDamage
						et.LastDamageType = "arcane"
						isDead := et.Health <= 0
						et.Mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: et.ID, SourceID: shieldOwnerID, Amount: explosionDamage, Kind: "arcane", InstanceID: shieldInstanceID})
						}
						if isDead {
							et.Mu.Lock()
							w.handleDeath(et, tgt, nil)
							et.Mu.Unlock()
						}
					}
				}
				tgt.Mu.Lock() // Relock
			}

			tgt.ArcaneShieldActive = false
			tgt.ArcaneShieldRuneID = ""
			tgt.ArcaneShieldAbsorbed = 0
		}
	}

	// The allowlisted near-death gate still uses a normal hostile AI swing,
	// range check, cooldown, and asynchronous damage path. Once its explicit
	// waypoint protection has been removed, do not let a residual fractional
	// mitigation or absorb round that already-minimal real hit back to zero.
	qaNearDeathHit := tgt.Type == TypePlayer && tgt.Health == 1 &&
		time.Now().Before(tgt.QAHealthRegenPausedUntil) && tgt.InvulnerableEndTime.IsZero() &&
		tgt.QAWaypointProtectionEndTime.IsZero()
	if qaNearDeathHit && actualDamage < 1 {
		actualDamage = 1
	}

	actualDamage = applyFinalDamage(attackerSnapshot, tgt, actualDamage, "physical")
	pendingReflectDamage += ApplyDamageReflect(attackerSnapshot, tgt, actualDamage)
	if attackerSnapshot.Type == TypePlayer && tgt.Type == TypeEnemy {
		addThreatLocked(tgt, attackerSnapshot.ID, float64(actualDamage))
	}

	// Apply On-Hit Effects
	if attackerSnapshot.PoisonCoatingActive {
		tgt.Poisoned = true
		tgt.PoisonDamage = 8 + (attackerSnapshot.Stats.Dexterity / 2)
		tgt.PoisonSourceID = attackerSnapshot.ID
		tgt.PoisonEndTime = time.Now().Add(8 * time.Second)
		poisonApplied = true
		poisonDamage = tgt.PoisonDamage
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
		w.spreadPoison(att, tgt, poisonDamage, poisonEndTime)
	}
	if pendingReflectDamage > 0 {
		att.Mu.Lock()
		att.Health -= pendingReflectDamage
		att.LastDamageType = "physical"
		attackerDied := att.Health <= 0
		att.Mu.Unlock()
		if w.OnEvent != nil {
			w.OnEvent("damage", DamageEvent{TargetID: att.ID, SourceID: tgt.ID, Amount: pendingReflectDamage, Kind: "reflect", InstanceID: attackerSnapshot.InstanceID})
		}
		if attackerDied {
			att.Mu.Lock()
			w.handleDeath(att, tgt, nil)
			att.Mu.Unlock()
		}
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
