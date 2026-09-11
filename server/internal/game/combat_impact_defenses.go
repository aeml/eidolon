package game

import "time"

type impactShieldExplosion struct {
	damage              int
	x, z                float64
	instanceID, ownerID string
}

type impactDefenseResolution struct {
	damage, reflection int
	explosion          *impactShieldExplosion
}

// Timer cleanup and impact resolution share the same boundary. An expired or
// malformed shield cannot absorb between updates, reflect, or detonate history.
// Caller holds the receiver lock. All real shield casts provide an expiry.
func expireArcaneShieldLocked(target *Entity, now time.Time) {
	if !target.ArcaneShieldActive || (!target.ArcaneShieldEndTime.IsZero() && now.Before(target.ArcaneShieldEndTime)) {
		return
	}
	target.ArcaneShieldActive = false
	target.ArcaneShieldHP = 0
	target.ArcaneShieldEndTime = time.Time{}
	target.ArcaneShieldRuneID = ""
	target.ArcaneShieldAbsorbed = 0
}

// resolveImpactDefenseLocked mutates only the locked receiver. Retaliation is
// captured, not executed: callers can release their actor locks before applying
// world effects without rereading a replaced shield's capacity or origin.
func resolveImpactDefenseLocked(tgt *Entity, damage int, now time.Time) impactDefenseResolution {
	expireArcaneShieldLocked(tgt, now)
	pendingReflectDamage := 0
	var explosion *impactShieldExplosion
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
				explosion = &impactShieldExplosion{damage: shieldAbsorbed, x: tgt.X, z: tgt.Z,
					instanceID: tgt.InstanceID, ownerID: tgt.ID}
			}
		}
	}

	return impactDefenseResolution{damage: actualDamage, reflection: pendingReflectDamage, explosion: explosion}
}

// Compatibility adapter for ordinary hits and boss slams. Preserve their exact
// release/reacquire and world-lock contract while skill callers are migrated.
func (w *World) mitigateImpactDamageLocked(tgt *Entity, damage int, now time.Time, worldLocked bool) (int, int) {
	resolved := resolveImpactDefenseLocked(tgt, damage, now)
	if resolved.explosion != nil {
		tgt.Mu.Unlock()
		w.applyImpactShieldExplosion(tgt, *resolved.explosion, worldLocked)
		tgt.Mu.Lock()
	}
	return resolved.damage, resolved.reflection
}

// No actor locks may be held; worldLocked retains the caller's existing mode.
func (w *World) applyImpactShieldExplosion(owner *Entity, explosion impactShieldExplosion, worldLocked bool) {
	const radius = 6.0
	for _, target := range w.Grid.Nearby(explosion.x, explosion.z, radius, explosion.instanceID) {
		target.Mu.RLock()
		if target.Type != TypeEnemy || target.State == "DEAD" {
			target.Mu.RUnlock()
			continue
		}
		dx, dz := explosion.x-target.X, explosion.z-target.Z
		target.Mu.RUnlock()
		if dx*dx+dz*dz > radius*radius {
			continue
		}
		target.Mu.Lock()
		applied := explosion.damage
		target.Health -= applied
		target.LastDamageType = "arcane"
		dead := target.Health <= 0
		target.Mu.Unlock()
		if w.OnEvent != nil {
			w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: explosion.ownerID, Amount: applied, Kind: "arcane", InstanceID: explosion.instanceID})
		}
		if dead {
			target.Mu.Lock()
			w.handleDeathWithWorldLock(target, owner, nil, worldLocked)
			target.Mu.Unlock()
		}
	}
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
