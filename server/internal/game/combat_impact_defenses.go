package game

import "time"

// mitigateImpactDamageLocked shares ordinary-hit defenses with boss slams.
// Caller owns tgt.Mu and declares whether it owns w.Mu. Explosive shield
// retaliation temporarily releases and restores tgt.Mu, retaining the caller's
// world-lock mode for death/party-credit processing.
func (w *World) mitigateImpactDamageLocked(tgt *Entity, damage int, now time.Time, worldLocked bool) (int, int) {
	pendingReflectDamage := 0
	// Gameplay invulnerability and allowlisted release-QA protection are
	// independent clocks; a short class effect must never shorten the latter.
	damageTime := now
	gameplayInvulnerable := !tgt.InvulnerableEndTime.IsZero() && damageTime.Before(tgt.InvulnerableEndTime)
	qaWaypointProtected := !tgt.QAWaypointProtectionEndTime.IsZero() && damageTime.Before(tgt.QAWaypointProtectionEndTime)
	if tgt.Type == TypePlayer && (gameplayInvulnerable || qaWaypointProtected) {
		damage = 0
	}

	// The two Sanctuary sources have distinct advertised strengths and may
	// overlap. Use the stronger active reduction rather than an approximation.
	sanctuaryReduction := 0.0
	if tgt.SanctuaryDamageReduction && now.Before(tgt.SanctuaryEndTime) {
		sanctuaryReduction = 0.20
	}
	if !tgt.ConsecratedSanctuaryEndTime.IsZero() && now.Before(tgt.ConsecratedSanctuaryEndTime) {
		sanctuaryReduction = 0.30
	}
	if sanctuaryReduction > 0 {
		damage = int(float64(damage) * (1.0 - sanctuaryReduction))
	}

	// Divine Intervention Guardian Angel rune: 50% damage reduction
	if tgt.DivineInterventionGuardian && now.Before(tgt.DivineInterventionGuardTime) {
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
			runeID, shieldAbsorbed := tgt.ArcaneShieldRuneID, tgt.ArcaneShieldAbsorbed
			// Commit depletion before releasing the owner lock for retaliation.
			// A concurrent recast must not be cleared by this older impact.
			tgt.ArcaneShieldActive = false
			tgt.ArcaneShieldRuneID = ""
			tgt.ArcaneShieldAbsorbed = 0
			if runeID == "arcaneshield_explosive" {
				// Explode dealing absorbed amount to nearby enemies
				explosionDamage := shieldAbsorbed
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
						appliedExplosion := explosionDamage
						et.Health -= appliedExplosion
						et.LastDamageType = "arcane"
						isDead := et.Health <= 0
						et.Mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: et.ID, SourceID: shieldOwnerID, Amount: appliedExplosion, Kind: "arcane", InstanceID: shieldInstanceID})
						}
						if isDead {
							et.Mu.Lock()
							w.handleDeathWithWorldLock(et, tgt, nil, worldLocked)
							et.Mu.Unlock()
						}
					}
				}
				tgt.Mu.Lock() // Relock
			}
		}
	}

	return actualDamage, pendingReflectDamage
}

// Caller owns neither actor lock. World-locked slam impacts and fine-grained
// ordinary impacts share the same retaliation/death contract.
func (w *World) applyImpactReflection(attacker, defender *Entity, damage int, instanceID string, worldLocked bool) {
	if damage <= 0 {
		return
	}
	attacker.Mu.Lock()
	if attacker.State == "DEAD" || attacker.InstanceID != instanceID {
		attacker.Mu.Unlock()
		return
	}
	attacker.Health -= damage
	attacker.LastDamageType = "physical"
	died := attacker.Health <= 0
	attacker.Mu.Unlock()
	if w.OnEvent != nil {
		w.OnEvent("damage", DamageEvent{TargetID: attacker.ID, SourceID: defender.ID, Amount: damage, Kind: "reflect", InstanceID: instanceID})
	}
	if died {
		attacker.Mu.Lock()
		if attacker.Health <= 0 && attacker.State != "DEAD" {
			w.handleDeathWithWorldLock(attacker, defender, nil, worldLocked)
		}
		attacker.Mu.Unlock()
	}
}
