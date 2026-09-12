package game

import "time"

type impactShieldExplosion struct {
	damage              int
	x, z                float64
	instanceID, ownerID string
	partyID             string
}

type impactDefenseResolution struct {
	damage, reflection int
	explosion          *impactShieldExplosion
}

// Caller holds the recipient lock. Environmental and reflected damage retain
// their existing non-absorb/non-retaliate rules, but Fortress's incoming damage
// reduction also covers those paths. Share the exact impact-time boundary.
func fortressIncomingDamageLocked(target *Entity, damage int, now time.Time) int {
	if target.Type == TypePlayer && target.IronFortressActive && !target.IronFortressEndTime.IsZero() && now.Before(target.IronFortressEndTime) {
		return damage * 80 / 100
	}
	return damage
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
	// Fortress protects scaled incoming hits as well as adding armor. Check
	// the actual deadline at impact, before other reductions and absorption.
	damage = fortressIncomingDamageLocked(tgt, damage, now)

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
					instanceID: tgt.InstanceID, ownerID: tgt.ID, partyID: tgt.PartyID}
			}
		}
	}

	return impactDefenseResolution{damage: actualDamage, reflection: pendingReflectDamage, explosion: explosion}
}

// No actor locks may be held; worldLocked retains the caller's existing mode.
func (w *World) applyImpactShieldExplosion(owner *Entity, explosion impactShieldExplosion, worldLocked bool) {
	const radius = 6.0
	// This is an already stored damage budget, not a new spell cast. Capture
	// identity/geometry at depletion, check current hostility, and scale for
	// PvP once without rerolling owner criticals or outgoing bonuses.
	source := &Entity{ID: explosion.ownerID, Type: TypePlayer, InstanceID: explosion.instanceID,
		PartyID: explosion.partyID, X: explosion.x, Z: explosion.z}
	walkRects := w.dungeonWalkRectsSnapshot(explosion.instanceID)
	impacts := &abilityImpactContext{world: w, worldLocked: worldLocked}
	defer impacts.flush()
	for _, target := range w.Grid.Nearby(explosion.x, explosion.z, expandedAbilityRadius("Arcane Shield", radius), explosion.instanceID) {
		target.Mu.Lock()
		if target.State == "DEAD" || target.Health <= 0 || target.Disconnected ||
			!w.CanDamage(source, target) || !withinDungeonAbilityRadius(walkRects, "Arcane Shield", explosion.x, explosion.z, target, radius) {
			target.Mu.Unlock()
			continue
		}
		applied := impacts.receiveDamageLocked(explosion.ownerID, target, ScalePvPDamage(source, target, explosion.damage), "arcane", time.Now())
		if target.Type == TypeEnemy {
			addThreatLocked(target, explosion.ownerID, float64(applied))
		}
		dead := target.Health <= 0
		target.Mu.Unlock()
		if w.OnEvent != nil {
			w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: explosion.ownerID, Amount: applied, Kind: "arcane", InstanceID: explosion.instanceID})
		}
		if dead {
			target.Mu.Lock()
			if target.Health <= 0 && target.State != "DEAD" {
				w.handleDeathWithWorldLock(target, owner, nil, worldLocked)
			}
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
	damage = fortressIncomingDamageLocked(attacker, damage, time.Now())
	damage = damageWithinDarkKingPhase(attacker, damage)
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
