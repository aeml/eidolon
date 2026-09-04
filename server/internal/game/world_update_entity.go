package game

import (
	"math"
	"math/rand"
	"strings"
	"time"
)

func (w *World) updateEntity(e *Entity, dt float64, players []*Entity, deferred *deferredActions) {
	// --- Loot Cleanup ---
	if e.Type == TypeLoot {
		e.Mu.Lock()
		if time.Since(e.LootTime) > 1*time.Minute {
			deferred.addRemoval(e.ID)
		}
		e.Mu.Unlock()
		return
	}

	// --- Respawn Logic for Enemies and NPCs ---
	if e.Type == TypeEnemy || e.Type == TypeNPC {
		e.Mu.Lock()
		if e.State == "DEAD" {
			if e.SubType == "AvengingSeraph" {
				deferred.addRemoval(e.ID)
				e.Mu.Unlock()
				return
			}
			// Check if Elite
			if strings.HasPrefix(e.ID, "elite-") {
				if time.Since(e.LastAttackTime) > 5*time.Second {
					deferred.addRemoval(e.ID)
				}
				e.Mu.Unlock()
				return
			}

			// Respawn Logic for normal mobs
			if time.Since(e.LastAttackTime) > 10*time.Second {
				// Do not respawn enemies in dungeons
				if strings.HasPrefix(e.InstanceID, "dungeon_") {
					e.Mu.Unlock()
					return
				}

				e.State = "IDLE"
				e.Health = e.MaxHealth
				e.Threat = nil
				oldX, oldZ := e.X, e.Z
				e.X = e.SpawnX
				e.Z = e.SpawnZ
				w.Grid.Update(e, oldX, oldZ)
			}
			e.Mu.Unlock()
			return
		}
		e.Mu.Unlock()
	}
	if e.Type == TypeEnemy && e.SubType == "UmbraPrime" {
		w.updateDarkKingPhase(e, players)
	}

	// --- Projectiles ---
	if e.Type == TypeProjectile {
		e.Mu.RLock()
		projectileOwnerID := e.OwnerID
		projectileTargetID := e.TargetID
		projectileSubType := e.SubType
		projectileInstanceID := e.InstanceID
		e.Mu.RUnlock()
		owner := w.GetEntity(projectileOwnerID)
		ownerSpreadsPoison := false
		ownerSerratedEdges := false
		ownerPoisonCoating := false
		ownerFireballPierce := false
		ownerDexterity := 0
		if owner != nil {
			owner.Mu.RLock()
			ownerSpreadsPoison = owner.HasAnySetBonus("poisonSpread")
			ownerSerratedEdges = owner.SerratedEdgesActive
			ownerPoisonCoating = owner.PoisonCoatingActive
			ownerFireballPierce = owner.HasAnySetBonus("fireballPierce")
			ownerDexterity = owner.Stats.Dexterity
			owner.Mu.RUnlock()
		}
		var homingTarget *Entity
		if projectileSubType == "ArcaneMissile" && projectileTargetID != "" {
			homingTarget = w.GetEntity(projectileTargetID)
		}
		e.Mu.Lock()

		// Zone Logic (ZoneDamage, ZoneHoly, etc.)
		if strings.HasPrefix(e.SubType, "Zone") {
			// Check zone expiration - use ConsecratedGroundEndTime if set, otherwise 8s default
			zoneExpired := false
			if !e.ConsecratedGroundEndTime.IsZero() {
				zoneExpired = time.Now().After(e.ConsecratedGroundEndTime)
			} else {
				zoneExpired = time.Since(e.CreatedAt) > 8*time.Second
			}

			if zoneExpired {
				deferred.addRemoval(e.ID)
				e.Mu.Unlock()
				return
			}

			// Periodic tick interval (1s default, 500ms with Time Burn combo)
			tickInterval := 1 * time.Second
			if e.ZoneDoubleTick {
				tickInterval = 500 * time.Millisecond
			}
			if time.Since(e.LastAttackTime) >= tickInterval {
				e.LastAttackTime = time.Now()

				radius := e.Radius
				damage := e.Damage
				if damage == 0 {
					damage = 10
				}
				ownerID := e.OwnerID
				ownerIsPlayer := owner != nil && owner.Type == TypePlayer
				zoneSubType := e.SubType
				zoneSkill := e.ProjectileSkill
				isSanctuary := e.ConsecratedGroundSanctuary
				zoneX, zoneZ, zoneInstanceID := e.X, e.Z, e.InstanceID
				e.Mu.Unlock() // Unlock to query grid

				effectiveRadius := expandedAbilityRadius(zoneSubType, radius)
				nearby := w.Grid.Nearby(zoneX, zoneZ, effectiveRadius, zoneInstanceID)
				for _, target := range nearby {
					target.Mu.RLock()
					targetType := target.Type
					targetState := target.State
					target.Mu.RUnlock()

					inRadius := withinAbilityRadius(zoneSubType, zoneX, zoneZ, target, radius)
					if !inRadius {
						continue
					}

					// --- Damage enemies (all zone types) ---
					if targetType == TypeEnemy && targetState != "DEAD" {
						damageType := "arcane"
						switch zoneSubType {
						case "ZoneFire":
							damageType = "fire"
						case "ZoneHoly":
							damageType = "holy"
						case "ZonePoison":
							damageType = "poison"
						}
						if zoneSkill == "Inferno Cataclysm" {
							damageType = "fire"
						}
						target.Mu.Lock()
						finalDamage := applyFinalDamage(owner, target, damage, damageType)
						if ownerIsPlayer {
							addThreatLocked(target, ownerID, float64(finalDamage))
						}
						isDead := target.Health <= 0
						target.Mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: finalDamage, Kind: damageType, InstanceID: zoneInstanceID})
						}

						if isDead {
							owner := w.GetEntity(ownerID)
							target.Mu.Lock()
							w.handleDeath(target, owner, deferred)
							target.Mu.Unlock()
						}
					}

					// --- ZoneHoly: heal allies + sanctuary buff ---
					if zoneSubType == "ZoneHoly" && (targetType == TypePlayer || targetType == TypeNPC) && targetState != "DEAD" && w.CombatRelationship(owner, target) != RelationshipHostile {
						// Heal allies (15 + owner_wisdom*0.5)
						healAmount := 15
						if owner != nil {
							healAmount += owner.Stats.Wisdom / 2
							healAmount = applyHealingDoneBonus(owner, healAmount)
						}
						target.Mu.Lock()
						healAmount = applyHealingReceived(target, healAmount)
						previousHealth := target.Health
						target.Health += healAmount
						if target.Health > target.MaxHealth {
							target.Health = target.MaxHealth
						}
						actualHeal := target.Health - previousHealth
						// Sanctuary rune: allies in area take 30% less damage
						if isSanctuary {
							target.ConsecratedSanctuaryEndTime = time.Now().Add(2 * time.Second)
						}
						target.Mu.Unlock()

						if actualHeal > 0 {
							w.fireHealEvent(ownerID, target.ID, actualHeal, "consecration", zoneInstanceID)
						}
					}
				}
				return
			}
			e.Mu.Unlock()
			return
		}

		// Meteor Logic
		if e.SubType == "Meteor" {
			// Replicate a deterministic 20-unit/s descent so every client sees
			// the same fall instead of a meteor suspended at its spawn height.
			if remaining := time.Until(e.LastAttackTime).Seconds(); remaining > 0 {
				e.Y = 20 * remaining
			} else {
				e.Y = 0
			}
			if time.Now().After(e.LastAttackTime) {
				// Impact!
				radius := e.Radius
				impactName := e.ProjectileSkill
				if impactName == "" {
					impactName = e.SubType
				}
				effectiveRadius := expandedAbilityRadius(impactName, radius)
				damage := e.Damage
				ownerID := e.OwnerID
				meteorShieldExplode := e.MeteorShieldExplode
				ownerIsPlayer := owner != nil && owner.Type == TypePlayer
				impactX, impactZ, impactInstanceID := e.X, e.Z, e.InstanceID

				e.Mu.Unlock() // Unlock to query grid
				w.fireProjectileImpactEvent(ProjectileImpactEvent{
					ProjectileID: e.ID, ProjectileType: projectileSubType,
					SourceID: ownerID, InstanceID: impactInstanceID, SkillName: impactName,
					X: impactX, Y: 0, Z: impactZ,
					Radius: visualAbilityRadius(impactName, radius), Terminal: true,
				})

				nearby := w.Grid.Nearby(impactX, impactZ, effectiveRadius, impactInstanceID)
				for _, target := range nearby {
					target.Mu.RLock()
					if !w.CanDamage(owner, target) || target.State == "DEAD" {
						target.Mu.RUnlock()
						continue
					}
					target.Mu.RUnlock()

					if withinAbilityRadius(impactName, impactX, impactZ, target, radius) {
						target.Mu.Lock()
						finalDamage := applyFinalDamage(owner, target, damage, "fire")
						if ownerIsPlayer {
							addThreatLocked(target, ownerID, float64(finalDamage))
						}
						isDead := target.Health <= 0
						target.Mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: finalDamage, Kind: "fire", InstanceID: impactInstanceID})
						}

						if isDead {
							owner := w.GetEntity(ownerID)
							target.Mu.Lock()
							w.handleDeath(target, owner, deferred)
							target.Mu.Unlock()
						}
					}
				}

				// Combo: Arcane Barrage - Shield explodes on meteor impact
				if meteorShieldExplode && owner != nil {
					owner.Mu.Lock()
					if owner.ArcaneShieldActive && owner.ArcaneShieldHP > 0 {
						shieldExplosionDamage := owner.ArcaneShieldHP
						// Consume the shield
						owner.ArcaneShieldActive = false
						owner.ArcaneShieldHP = 0
						owner.Mu.Unlock()

						// Deal shield HP as AoE damage at meteor impact location
						explosionRadius := radius * 1.5 // Slightly larger than meteor
						effectiveExplosionRadius := expandedAbilityRadius(impactName, explosionRadius)
						explosionNearby := w.Grid.Nearby(impactX, impactZ, effectiveExplosionRadius, impactInstanceID)
						for _, target := range explosionNearby {
							target.Mu.RLock()
							if !w.CanDamage(owner, target) || target.State == "DEAD" {
								target.Mu.RUnlock()
								continue
							}
							target.Mu.RUnlock()

							if withinAbilityRadius(impactName, impactX, impactZ, target, explosionRadius) {
								target.Mu.Lock()
								finalDamage := applyFinalDamage(owner, target, shieldExplosionDamage, "arcane")
								if ownerIsPlayer {
									addThreatLocked(target, ownerID, float64(finalDamage))
								}
								isDead := target.Health <= 0
								target.Mu.Unlock()

								if w.OnEvent != nil {
									w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: finalDamage, Kind: "arcane", InstanceID: impactInstanceID})
								}

								if isDead {
									target.Mu.Lock()
									w.handleDeath(target, owner, deferred)
									target.Mu.Unlock()
								}
							}
						}
					} else {
						owner.Mu.Unlock()
					}
				}

				// Remove Meteor after impact
				deferred.addRemoval(e.ID)
				return
			}
			e.Mu.Unlock()
			return
		}

		// Lifetime check
		lifetime := 5 * time.Second
		if e.SubType == "ExplosiveTrap" || e.SubType == "SnareTrap" || e.SubType == "Tripwire" {
			lifetime = 60 * time.Second
		}
		if time.Since(e.CreatedAt) > lifetime {
			deferred.addRemoval(e.ID)
			e.Mu.Unlock()
			return
		}
		if !e.ProjectileActivationTime.IsZero() && time.Now().Before(e.ProjectileActivationTime) {
			e.Mu.Unlock()
			return
		}

		if e.SubType == "ArcaneMissile" && e.TargetID != "" {
			if homingTarget != nil {
				homingTarget.Mu.RLock()
				validTarget := homingTarget.InstanceID == e.InstanceID && w.CanDamage(owner, homingTarget) && homingTarget.State != "DEAD"
				dx := homingTarget.X - e.X
				dz := homingTarget.Z - e.Z
				homingTarget.Mu.RUnlock()
				if validTarget {
					if distance := math.Hypot(dx, dz); distance > 0 {
						e.VelX = dx / distance * 25.0
						e.VelZ = dz / distance * 25.0
						e.Rotation = math.Atan2(e.VelX, e.VelZ)
					}
				}
			}
		}

		// Move
		oldX, oldZ := e.X, e.Z
		e.X += e.VelX * dt
		e.Z += e.VelZ * dt
		w.Grid.Update(e, oldX, oldZ)

		// Snapshot for collision check
		projX, projY, projZ, radius, damage, ownerID, subType := e.X, e.Y, e.Z, e.Radius, e.Damage, e.OwnerID, e.SubType
		projVelX, projVelZ, projSkillName := e.VelX, e.VelZ, e.ProjectileSkill
		hitIDs := make(map[string]bool, len(e.HitList)+1)
		for id, hit := range e.HitList {
			if hit {
				hitIDs[id] = true
			}
		}
		e.Mu.Unlock()

		ownerIsPlayer := owner != nil && owner.Type == TypePlayer

		// Check Collision with Enemies
		nearbyEnemies := w.Grid.Nearby(projX, projZ, radius+2.0, projectileInstanceID)
		for _, target := range nearbyEnemies {
			if target.InstanceID != projectileInstanceID {
				continue
			}
			// Read Target State
			target.Mu.RLock()
			if !w.CanDamage(owner, target) || target.State == "DEAD" {
				target.Mu.RUnlock()
				continue
			}
			dx := projX - target.X
			dz := projZ - target.Z
			target.Mu.RUnlock()

			dist := math.Sqrt(dx*dx + dz*dz)
			if dist < (radius + 0.5) {
				e.Mu.Lock()
				if e.HitList == nil {
					e.HitList = make(map[string]bool)
				}
				if e.HitList[target.ID] {
					e.Mu.Unlock()
					continue
				}
				e.HitList[target.ID] = true
				hitIDs[target.ID] = true
				projRuneID := e.ProjectileRuneID
				projSkill := e.ProjectileSkill
				projBounces := e.ProjectileBounces
				fireballWellBoost := e.FireballWellBoost
				projectilePierces := e.ProjectilePierce
				e.Mu.Unlock()
				projectileRedirected := false

				// Calculate final damage with rune modifications
				finalDamage := damage

				// Combo: Implosion (Gravity Well → Fireball) = +100% damage to slowed targets
				if projSkill == "Fireball" && fireballWellBoost {
					target.Mu.RLock()
					isSlowed := target.Slowed
					target.Mu.RUnlock()
					if isSlowed {
						finalDamage *= 2
					}
				}

				// Piercing Throw runes
				if projSkill == "Piercing Throw" {
					target.Mu.RLock()
					weakPointMarked := target.WeakPointMarked
					target.Mu.RUnlock()
					if weakPointMarked {
						finalDamage = finalDamage * 3 / 2
					}
					// Executioner rune: +100% damage to targets below 30% HP
					if projRuneID == "piercingthrow_executioner" {
						target.Mu.RLock()
						hpPercent := float64(target.Health) / float64(target.MaxHealth)
						target.Mu.RUnlock()
						if hpPercent < 0.30 {
							finalDamage *= 2
						}
					}
				}

				// Hit!
				damageType := "physical"
				if subType == "Fireball" || subType == "FlameTornado" || subType == "DragonfireLance" || subType == "ExplosiveTrap" {
					damageType = "fire"
				} else if subType == "ArcaneMissile" {
					damageType = "arcane"
				}
				target.Mu.Lock()
				spreadPoisonAfterHit := false
				spreadPoisonDamage := 0
				spreadPoisonEndTime := time.Time{}
				finalDamage = applyFinalDamage(owner, target, finalDamage, damageType)
				if ownerIsPlayer {
					addThreatLocked(target, ownerID, float64(finalDamage))
				}
				isDead := target.Health <= 0

				// Apply Trap Effects
				if (subType == "SnareTrap" || subType == "Tripwire") && !target.CCImmune {
					target.Rooted = true
					target.RootEndTime = time.Now().Add(3 * time.Second)
				}

				// Piercing Throw: Serrated rune applies bleed
				if ((projSkill == "Piercing Throw" && (projRuneID == "piercingthrow_serrated" || ownerSerratedEdges)) ||
					(projSkill == "Fan of Knives" && ownerSerratedEdges)) && !isDead {
					target.Bleeding = true
					target.BleedDamage = finalDamage / 5
					if target.BleedDamage < 1 {
						target.BleedDamage = 1
					}
					target.BleedSourceID = ownerID
					target.BleedEndTime = time.Now().Add(5 * time.Second)
				}

				// Fan of Knives rune effects
				if projSkill == "Fan of Knives" && !isDead {
					if projRuneID == "fanofknives_weighted" {
						if !target.CCImmune {
							target.Slowed = true
							target.SlowFactor = 0.30
							target.SlowEndTime = time.Now().Add(3 * time.Second)
							target.RecalculateStats()
						}
					} else if projRuneID == "fanofknives_poisoned" {
						target.Poisoned = true
						target.PoisonDamage = finalDamage / 4
						if target.PoisonDamage < 1 {
							target.PoisonDamage = 1
						}
						target.PoisonSourceID = ownerID
						target.PoisonEndTime = time.Now().Add(5 * time.Second)
						spreadPoisonAfterHit = ownerSpreadsPoison
						spreadPoisonDamage = target.PoisonDamage
						spreadPoisonEndTime = target.PoisonEndTime
					}
				}
				if projSkill == "Piercing Throw" && ownerPoisonCoating && !isDead {
					target.Poisoned = true
					target.PoisonDamage = 8 + ownerDexterity/2
					target.PoisonSourceID = ownerID
					target.PoisonEndTime = time.Now().Add(8 * time.Second)
					spreadPoisonAfterHit = ownerSpreadsPoison
					spreadPoisonDamage = target.PoisonDamage
					spreadPoisonEndTime = target.PoisonEndTime
				}

				target.Mu.Unlock()
				if spreadPoisonAfterHit {
					w.spreadPoison(owner, target, spreadPoisonDamage, spreadPoisonEndTime)
				}

				if w.OnEvent != nil {
					w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: ownerID, Amount: finalDamage, Kind: damageType, InstanceID: projectileInstanceID})
				}

				if isDead {
					// We need the owner entity to award XP
					owner := w.GetEntity(ownerID) // This uses RLock on World
					target.Mu.Lock()              // Lock target for handleDeath
					w.handleDeath(target, owner, deferred)
					target.Mu.Unlock()
				}

				// Piercing Throw: Ricochet rune - bounce to additional targets
				if projSkill == "Piercing Throw" && projRuneID == "piercingthrow_ricochet" && projBounces > 0 {
					// Find nearest enemy that hasn't been hit
					var nextTarget *Entity
					minNextDist := 15.0 // Max bounce range
					bounceNearby := w.Grid.Nearby(target.X, target.Z, minNextDist, projectileInstanceID)
					for _, bt := range bounceNearby {
						bt.Mu.RLock()
						if !w.CanDamage(owner, bt) || bt.State == "DEAD" || hitIDs[bt.ID] {
							bt.Mu.RUnlock()
							continue
						}
						bdx := target.X - bt.X
						bdz := target.Z - bt.Z
						bdist := math.Sqrt(bdx*bdx + bdz*bdz)
						bt.Mu.RUnlock()

						if bdist > 0.5 && bdist < minNextDist {
							minNextDist = bdist
							nextTarget = bt
						}
					}

					if nextTarget != nil {
						// Redirect projectile to next target
						e.Mu.Lock()
						nextTarget.Mu.RLock()
						ntx, ntz := nextTarget.X, nextTarget.Z
						nextTarget.Mu.RUnlock()

						ndx := ntx - e.X
						ndz := ntz - e.Z
						ndist := math.Sqrt(ndx*ndx + ndz*ndz)
						if ndist > 0 {
							speed := 35.0
							e.VelX = (ndx / ndist) * speed
							e.VelZ = (ndz / ndist) * speed
							e.ProjectileBounces--
							e.Rotation = math.Atan2(e.VelX, e.VelZ)
							projectileRedirected = true
						}
						e.Mu.Unlock()
					}
				}

				// Splash Damage (Fireball / Explosive Trap)
				if subType == "Fireball" || subType == "ExplosiveTrap" {
					splashRadius := 10.0
					if subType == "ExplosiveTrap" {
						splashRadius = 6.0
					}
					effectiveSplashRadius := expandedAbilityRadius(subType, splashRadius)

					splashTargets := w.Grid.Nearby(projX, projZ, effectiveSplashRadius, projectileInstanceID)
					for _, splashTarget := range splashTargets {
						if splashTarget.InstanceID != projectileInstanceID {
							continue
						}
						splashTarget.Mu.RLock()
						if !w.CanDamage(owner, splashTarget) || splashTarget.ID == target.ID || splashTarget.State == "DEAD" {
							splashTarget.Mu.RUnlock()
							continue
						}
						splashTarget.Mu.RUnlock()

						if withinAbilityRadius(subType, projX, projZ, splashTarget, splashRadius) {
							splashTarget.Mu.Lock()
							splashDmg := int(float64(finalDamage) * 0.4)
							splashDmg = applyFinalDamage(owner, splashTarget, splashDmg, "fire")
							if ownerIsPlayer {
								addThreatLocked(splashTarget, ownerID, float64(splashDmg))
							}
							isSplashDead := splashTarget.Health <= 0
							splashTarget.Mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: splashTarget.ID, SourceID: ownerID, Amount: splashDmg, Kind: "fire", InstanceID: projectileInstanceID})
							}

							if isSplashDead {
								owner := w.GetEntity(ownerID)
								splashTarget.Mu.Lock()
								w.handleDeath(splashTarget, owner, deferred)
								splashTarget.Mu.Unlock()
							}
						}
					}
				}

				// Fireball Chain Reaction rune: bounce to additional targets at 50% damage
				if projSkill == "Fireball" && projRuneID == "fireball_chain" && projBounces > 0 {
					// Find nearest enemy that hasn't been hit
					var nextTarget *Entity
					minNextDist := 15.0
					chainNearby := w.Grid.Nearby(target.X, target.Z, minNextDist, projectileInstanceID)
					for _, ct := range chainNearby {
						ct.Mu.RLock()
						if !w.CanDamage(owner, ct) || ct.State == "DEAD" || hitIDs[ct.ID] {
							ct.Mu.RUnlock()
							continue
						}
						cdx := target.X - ct.X
						cdz := target.Z - ct.Z
						cdist := math.Sqrt(cdx*cdx + cdz*cdz)
						ct.Mu.RUnlock()

						if cdist > 0.5 && cdist < minNextDist {
							minNextDist = cdist
							nextTarget = ct
						}
					}

					if nextTarget != nil {
						e.Mu.Lock()
						nextTarget.Mu.RLock()
						ntx, ntz := nextTarget.X, nextTarget.Z
						nextTarget.Mu.RUnlock()

						ndx := ntx - e.X
						ndz := ntz - e.Z
						ndist := math.Sqrt(ndx*ndx + ndz*ndz)
						if ndist > 0 {
							speed := 20.0
							e.VelX = (ndx / ndist) * speed
							e.VelZ = (ndz / ndist) * speed
							e.ProjectileBounces--
							if projBounces == 3 {
								e.Damage /= 2 // Every additional target stays at 50% base damage.
							}
							e.Rotation = math.Atan2(e.VelX, e.VelZ)
							projectileRedirected = true
						}
						e.Mu.Unlock()
					}
				}

				// Fireball Magma rune: leave burning ground (handled via event for now)
				// The burning ground effect would be client-side visual + periodic damage
				// For simplicity, we apply a burn DoT to all enemies in the splash area
				if projSkill == "Fireball" && projRuneID == "fireball_magma" {
					burnRadius := 5.0
					burnTargets := w.Grid.Nearby(projX, projZ, burnRadius, projectileInstanceID)
					for _, bt := range burnTargets {
						bt.Mu.RLock()
						if !w.CanDamage(owner, bt) || bt.State == "DEAD" {
							bt.Mu.RUnlock()
							continue
						}
						bdx := projX - bt.X
						bdz := projZ - bt.Z
						bt.Mu.RUnlock()

						if (bdx*bdx + bdz*bdz) <= burnRadius*burnRadius {
							bt.Mu.Lock()
							// Apply burning ground DoT (reuse Bleeding for simplicity)
							bt.Bleeding = true
							bt.BleedDamage = finalDamage / 6 // ~17% per tick
							bt.BleedSourceID = ownerID
							bt.BleedEndTime = time.Now().Add(3 * time.Second)
							bt.Mu.Unlock()
						}
					}
				}

				// Determine if projectile should pierce
				// Set Bonus: Inferno's Heart 4pc (fireballPierce) - Fireball pierces enemies
				shouldPierce := subType == "Dagger" || subType == "FlameTornado" || projectilePierces || projectileRedirected
				if subType == "Fireball" && ownerFireballPierce {
					shouldPierce = true
				}

				impactRadius := 0.0
				if subType == "Fireball" {
					impactRadius = 10.0
				} else if subType == "ExplosiveTrap" {
					impactRadius = 6.0
				}
				w.fireProjectileImpactEvent(ProjectileImpactEvent{
					ProjectileID: e.ID, ProjectileType: subType,
					SourceID: ownerID, TargetID: target.ID, InstanceID: projectileInstanceID,
					SkillName: projSkillName, X: projX, Y: projY, Z: projZ,
					DirectionX: projVelX, DirectionZ: projVelZ,
					Radius: impactRadius, Terminal: !shouldPierce,
				})

				if !shouldPierce {
					deferred.addRemoval(e.ID)
					break
				}
			}
		}

		e.Mu.Lock()
		// Only check bounds if in Overworld (InstanceID == "")
		if e.InstanceID == "" {
			if e.X < -1000 || e.X > 1000 || e.Z < -2200 || e.Z > 1000 {
				deferred.addRemoval(e.ID)
			}
		}
		e.Mu.Unlock()
		return
	}

	// --- Player Abilities ---
	if e.Type == TypePlayer {
		e.Mu.Lock()
		if e.State == "JUMPING" {
			jumpDuration := e.JumpDuration
			if jumpDuration <= 0 {
				jumpDuration = 0.35
			}
			e.JumpElapsed = math.Min(jumpDuration, e.JumpElapsed+dt)
			progress := e.JumpElapsed / jumpDuration
			if progress < 0 {
				progress = 0
			} else if progress > 1 {
				progress = 1
			}
			oldX, oldZ := e.X, e.Z
			e.JumpProgress = progress
			e.X = e.JumpStartX + (e.JumpTargetX-e.JumpStartX)*progress
			e.Z = e.JumpStartZ + (e.JumpTargetZ-e.JumpStartZ)*progress
			e.Y = e.JumpStartY + math.Sin(progress*math.Pi)*e.JumpHeight
			if progress >= 1 {
				e.X = e.JumpTargetX
				e.Y = e.JumpTargetY
				e.Z = e.JumpTargetZ
				e.State = "IDLE"
				w.Grid.Update(e, oldX, oldZ)
				e.Mu.Unlock()
				return
			}
			w.Grid.Update(e, oldX, oldZ)
			e.Mu.Unlock()
			return
		}
		// Fighter Charge
		if e.IsCharging {
			dx := e.ChargeTargetX - e.X
			dz := e.ChargeTargetZ - e.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			speed := 50.0
			moveDist := speed * dt

			oldX, oldZ := e.X, e.Z
			if moveDist >= dist {
				endX, endZ := e.ChargeTargetX, e.ChargeTargetZ
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, endX, endZ); ok {
					endX = constrainedX
					endZ = constrainedZ
					e.ChargeTargetX = endX
					e.ChargeTargetZ = endZ
				}
				e.X = endX
				e.Z = endZ
				w.Grid.Update(e, oldX, oldZ)

				// Calculate charge distance for momentum rune
				chargeDistTraveled := math.Sqrt(
					(e.X-e.ChargeStartX)*(e.X-e.ChargeStartX) +
						(e.Z-e.ChargeStartZ)*(e.Z-e.ChargeStartZ),
				)

				impactSkill := e.ChargeSkillName
				if impactSkill == "" {
					impactSkill = "Charge"
				}
				// Impact Damage - base calculation with talent bonus
				damage := int(float64(e.Damage) * 1.5 * 1.3 * e.GetSkillDamageMultiplier(impactSkill))

				// Rune effects
				runeID := e.ChargeRuneID

				// Momentum rune: damage scales with distance (up to +100% at max range)
				if runeID == "charge_momentum" {
					distanceBonus := math.Min(chargeDistTraveled/30.0, 1.0) // Max bonus at 30 units
					damage = int(float64(damage) * (1.0 + distanceBonus))
				}

				// Unstoppable rune: clear CC immunity, grant +20% armor for 5s
				if runeID == "charge_unstoppable" {
					e.CCImmune = false
					e.RuneArmorBuff = 0.20
					e.RuneArmorBuffEndTime = time.Now().Add(5 * time.Second)
				}
				impactX, impactZ := e.ChargeTargetX, e.ChargeTargetZ
				instanceID, sourceID := e.InstanceID, e.ID
				consumeKnockdownCombo := e.ActiveCombo == "charge_extended_knockdown"
				if consumeKnockdownCombo {
					e.ActiveCombo = ""
				}

				e.Mu.Unlock() // Unlock before interaction

				nearby := w.Grid.Nearby(impactX, impactZ, expandedAbilityRadius(impactSkill, 16.0), instanceID)

				for _, target := range nearby {
					target.Mu.RLock()
					if !w.CanDamage(e, target) || target.State == "DEAD" {
						target.Mu.RUnlock()
						continue
					}
					target.Mu.RUnlock()

					if withinAbilityRadius(impactSkill, impactX, impactZ, target, 16.0) {
						target.Mu.Lock()
						finalDamage := applyFinalDamage(e, target, damage, "physical")
						addThreatLocked(target, sourceID, float64(finalDamage))
						isDead := target.Health <= 0
						if impactSkill == "Shattering Charge" && !isDead {
							target.ArmorReduction = 5
							target.ArmorReductionEndTime = time.Now().Add(5 * time.Second)
						}

						// Combo: Tremor Rush (Earthshaker → Charge) = +2s knockdown
						if consumeKnockdownCombo && !target.CCImmune {
							target.Stunned = true
							target.StunEndTime = time.Now().Add(2 * time.Second)
						}
						target.Mu.Unlock()

						if w.OnEvent != nil {
							w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: sourceID, Amount: finalDamage, Kind: "physical", InstanceID: instanceID})
						}

						if isDead {
							target.Mu.Lock()
							w.handleDeath(target, e, deferred)
							target.Mu.Unlock()
						}
					}
				}

				// Shockwave rune: knockback AoE at end of charge (5 unit radius)
				if runeID == "charge_shockwave" {
					shockwaveRadius := 5.0
					knockbackDist := 4.0
					shockwaveNearby := w.Grid.Nearby(impactX, impactZ, expandedAbilityRadius("Charge Shockwave", shockwaveRadius), instanceID)
					for _, target := range shockwaveNearby {
						target.Mu.RLock()
						if !w.CanDamage(e, target) || target.State == "DEAD" {
							target.Mu.RUnlock()
							continue
						}
						tx, tz := target.X, target.Z
						target.Mu.RUnlock()

						knockDx := tx - impactX
						knockDz := tz - impactZ
						knockDist := math.Sqrt(knockDx*knockDx + knockDz*knockDz)
						if knockDist > 0 && knockDist <= shockwaveRadius+entityVisualRadius(target) {
							// Normalize and apply knockback
							knockDx = (knockDx / knockDist) * knockbackDist
							knockDz = (knockDz / knockDist) * knockbackDist

							target.Mu.Lock()
							if target.CCImmune || target.IronFortressImmovable {
								target.Mu.Unlock()
								continue
							}
							oldTX, oldTZ := target.X, target.Z
							target.X += knockDx
							target.Z += knockDz
							if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(target, target.X, target.Z); ok {
								target.X = constrainedX
								target.Z = constrainedZ
							}
							w.Grid.Update(target, oldTX, oldTZ)
							target.Mu.Unlock()
						}
					}
				}

				// Clear charge rune ID
				e.Mu.Lock()
				e.IsCharging = false
				e.State = "IDLE"
				e.MoveLockUntil = time.Now().Add(AbilityMovementLockDuration)
				e.ChargeRuneID = ""
				e.ChargeSkillName = ""
				e.Mu.Unlock()
			} else {
				nextX := e.X + (dx/dist)*moveDist
				nextZ := e.Z + (dz/dist)*moveDist
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, nextX, nextZ); ok {
					nextX = constrainedX
					nextZ = constrainedZ
				}
				e.X = nextX
				e.Z = nextZ
				e.Rotation = math.Atan2(dx, dz)
				w.Grid.Update(e, oldX, oldZ)
				e.Mu.Unlock()
			}
		} else {
			// Check Buff Expirations
			now := time.Now()
			if e.BerserkerModeActive && now.After(e.BerserkerModeEndTime) {
				e.BerserkerModeActive = false
				e.RecalculateStats()
			}
			if e.LastStandActive && now.After(e.LastStandEndTime) {
				e.LastStandActive = false
				e.RecalculateStats()
			}
			if e.StealthActive && now.After(e.StealthEndTime) {
				e.StealthActive = false
				e.CloakSwiftSpeedBonus = false
				e.RecalculateStats()
				// Don't clear CloakNextAttackBonus here - it persists until next attack
			}
			if e.CloakBurstSpeedBonus && now.After(e.CloakBurstSpeedEndTime) {
				e.CloakBurstSpeedBonus = false
				e.CloakBurstSpeedEndTime = time.Time{}
				e.RecalculateStats()
			}
			if e.AccuracyReduction > 0 && now.After(e.AccuracyReductionEndTime) {
				e.AccuracyReduction = 0
				e.AccuracyReductionEndTime = time.Time{}
			}
			if e.ZealActive && now.After(e.ZealEndTime) {
				e.ZealActive = false
				e.RecalculateStats()
			}
			if e.IronFortressActive && now.After(e.IronFortressEndTime) {
				e.IronFortressActive = false
				e.IronFortressThorns = false
				e.IronFortressImmovable = false
				e.IronFortressRuneID = ""
				e.RecalculateStats()
			}
			if e.GuardianRoarActive && now.After(e.GuardianRoarEndTime) {
				e.GuardianRoarActive = false
				e.RecalculateStats()
			}
			if e.SerratedEdgesActive && now.After(e.SerratedEdgesEndTime) {
				e.SerratedEdgesActive = false
			}
			if e.PoisonCoatingActive && now.After(e.PoisonCoatingEndTime) {
				e.PoisonCoatingActive = false
			}
			if e.ArcaneShieldActive && now.After(e.ArcaneShieldEndTime) {
				e.ArcaneShieldActive = false
				e.ArcaneShieldHP = 0
			}
			if e.SpellFocusActive && now.After(e.SpellFocusEndTime) {
				e.SpellFocusActive = false
				e.SpellFocusEndTime = time.Time{}
			}
			if e.TimeWarpActive && now.After(e.TimeWarpEndTime) {
				e.TimeWarpActive = false
				e.RecalculateStats()
			}
			if e.DivineInterventionActive && now.After(e.DivineInterventionEndTime) {
				e.DivineInterventionActive = false
			}
			if e.SwiftActive && now.After(e.SwiftEndTime) {
				e.SwiftActive = false
				e.RecalculateStats()
			}
			if e.BlessingResolveActive && now.After(e.BlessingResolveEndTime) {
				e.BlessingResolveActive = false
				e.RecalculateStats()
			}
			if e.Stunned && now.After(e.StunEndTime) {
				e.Stunned = false
			}
			if e.Slowed && now.After(e.SlowEndTime) {
				e.Slowed = false
				e.SlowFactor = 0
				e.RecalculateStats()
			}
			if e.Rooted && now.After(e.RootEndTime) {
				e.Rooted = false
			}
			if e.WeakPointMarked && now.After(e.WeakPointEndTime) {
				e.WeakPointMarked = false
			}
			if e.MarkWeakness && now.After(e.MarkWeaknessEndTime) {
				e.MarkWeakness = false
				e.MarkWeaknessFactor = 0
			}
			if e.ArmorReduction > 0 && now.After(e.ArmorReductionEndTime) {
				e.ArmorReduction = 0
				e.ArmorReductionEndTime = time.Time{}
			}

			// Rune buff expirations
			if e.CCImmune && now.After(e.CCImmuneEndTime) {
				e.CCImmune = false
			}
			if e.RuneArmorBuff > 0 && now.After(e.RuneArmorBuffEndTime) {
				e.RuneArmorBuff = 0
			}
			if now.After(e.InvulnerableEndTime) && !e.InvulnerableEndTime.IsZero() {
				e.InvulnerableEndTime = time.Time{}
			}
			if now.After(e.QAWaypointProtectionEndTime) && !e.QAWaypointProtectionEndTime.IsZero() {
				e.QAWaypointProtectionEndTime = time.Time{}
			}
			if now.After(e.QAHazardInspectionEndTime) && !e.QAHazardInspectionEndTime.IsZero() {
				e.QAHazardInspectionEndTime = time.Time{}
			}

			// Extended Whirlwind tick (from rune)
			if e.WhirlwindActive {
				if now.After(e.WhirlwindEndTime) {
					e.WhirlwindActive = false
					e.WhirlwindRuneID = ""
				} else if now.Sub(e.LastSpiritTick) >= 500*time.Millisecond {
					// Tick every 0.5s
					e.LastSpiritTick = now // Reuse this timer
					radius := 6.0
					effectiveRadius := expandedAbilityRadius("Whirlwind", radius)
					damage := int((float64(e.Damage)*0.8 + float64(e.Stats.Strength)*2) * 1.3 * 0.5) // -50% damage
					e.Mu.Unlock()

					nearby := w.Grid.Nearby(e.X, e.Z, effectiveRadius, e.InstanceID)
					for _, target := range nearby {
						if target.ID == e.ID {
							continue
						}
						target.Mu.RLock()
						if !w.CanDamage(e, target) || target.State == "DEAD" {
							target.Mu.RUnlock()
							continue
						}
						target.Mu.RUnlock()

						if withinAbilityRadius("Whirlwind", e.X, e.Z, target, radius) {
							target.Mu.Lock()
							finalDamage := applyFinalDamage(e, target, damage, "physical")
							addThreatLocked(target, e.ID, float64(finalDamage))
							isDead := target.Health <= 0
							target.Mu.Unlock()

							if w.OnEvent != nil {
								w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: e.ID, Amount: finalDamage, Kind: "physical", InstanceID: e.InstanceID})
							}

							if isDead {
								target.Mu.Lock()
								w.handleDeath(target, e, deferred)
								target.Mu.Unlock()
							}
						}
					}

					e.Mu.Lock()
				}
			}

			// DoT Ticks
			if e.Bleeding {
				if now.After(e.BleedEndTime) {
					e.Bleeding = false
					e.BleedSourceID = ""
				} else if time.Since(e.LastBleedTick) >= 1*time.Second {
					e.LastBleedTick = now
					e.Health -= e.BleedDamage
					e.LastDamageType = "physical"
					if w.OnEvent != nil {
						sourceID := e.BleedSourceID
						if sourceID == "" {
							sourceID = "bleed"
						}
						w.OnEvent("damage", DamageEvent{TargetID: e.ID, SourceID: sourceID, Amount: e.BleedDamage, Kind: "bleed", InstanceID: e.InstanceID})
					}
					if e.Health <= 0 {
						sourceID := e.BleedSourceID
						e.Mu.Unlock()
						attacker := w.GetEntity(sourceID)
						e.Mu.Lock()
						if e.Health <= 0 && e.State != "DEAD" {
							w.handleDeath(e, attacker, deferred)
						}
					}
				}
			}
			if e.State != "DEAD" && e.Poisoned {
				if now.After(e.PoisonEndTime) {
					e.Poisoned = false
					e.PoisonSourceID = ""
				} else if time.Since(e.LastPoisonTick) >= 1*time.Second {
					e.LastPoisonTick = now
					e.Health -= e.PoisonDamage
					e.LastDamageType = "poison"
					if w.OnEvent != nil {
						sourceID := e.PoisonSourceID
						if sourceID == "" {
							sourceID = "poison"
						}
						w.OnEvent("damage", DamageEvent{TargetID: e.ID, SourceID: sourceID, Amount: e.PoisonDamage, Kind: "poison", InstanceID: e.InstanceID})
					}
					if e.Health <= 0 {
						sourceID := e.PoisonSourceID
						e.Mu.Unlock()
						attacker := w.GetEntity(sourceID)
						e.Mu.Lock()
						if e.Health <= 0 && e.State != "DEAD" {
							w.handleDeath(e, attacker, deferred)
						}
					}
				}
			}

			// Healing Light HoT (Renewal Rune)
			if e.HealingLightHoTActive {
				if e.HealingLightHoTTicksRemaining <= 0 {
					e.HealingLightHoTActive = false
					e.HealingLightHoTSourceID = ""
				} else if time.Since(e.LastHealingLightHoTTick) >= 1*time.Second {
					e.LastHealingLightHoTTick = now
					previousHealth := e.Health
					e.Health += applyHealingReceived(e, e.HealingLightHoTAmount)
					if e.Health > e.MaxHealth {
						e.Health = e.MaxHealth
					}
					e.HealingLightHoTTicksRemaining--
					actualHeal := e.Health - previousHealth
					if actualHeal > 0 && w.OnEvent != nil {
						sourceID := e.HealingLightHoTSourceID
						if sourceID == "" {
							sourceID = "healinglight_hot"
						}
						w.OnEvent("heal", HealEvent{TargetID: e.ID, SourceID: sourceID, Amount: actualHeal, Kind: "healing_light_hot", InstanceID: e.InstanceID})
					}
					if e.HealingLightHoTTicksRemaining <= 0 {
						e.HealingLightHoTActive = false
						e.HealingLightHoTSourceID = ""
					}
				} else if now.After(e.HealingLightHoTEndTime) {
					e.HealingLightHoTActive = false
					e.HealingLightHoTSourceID = ""
				}
			}

			// Sanctuary Damage Reduction expiry check
			if e.SanctuaryDamageReduction && now.After(e.SanctuaryEndTime) {
				e.SanctuaryDamageReduction = false
			}
			if !e.ConsecratedSanctuaryEndTime.IsZero() && now.After(e.ConsecratedSanctuaryEndTime) {
				e.ConsecratedSanctuaryEndTime = time.Time{}
			}

			// Divine Intervention Guardian Angel expiry check
			if e.DivineInterventionGuardian && now.After(e.DivineInterventionGuardTime) {
				e.DivineInterventionGuardian = false
			}

			// HoT Ticks (Guardian Embrace)
			if e.GuardianEmbraceActive {
				if now.After(e.GuardianEmbraceEndTime) {
					e.GuardianEmbraceActive = false
				} else if time.Since(e.LastGuardianEmbraceTick) >= 1*time.Second {
					e.LastGuardianEmbraceTick = now
					heal := applyHealingDoneBonus(e, 20+(e.Stats.Wisdom*2))

					// Heal Self
					previousHealth := e.Health
					e.Health += applyHealingReceived(e, heal)
					if e.Health > e.MaxHealth {
						e.Health = e.MaxHealth
					}
					selfHeal := e.Health - previousHealth
					if selfHeal > 0 && w.OnEvent != nil {
						w.OnEvent("heal", HealEvent{TargetID: e.ID, SourceID: e.ID, Amount: selfHeal, Kind: "guardian_embrace", InstanceID: e.InstanceID})
					}

					// Heal Nearby Allies
					pX, pZ := e.X, e.Z
					e.Mu.Unlock()
					nearby := w.Grid.Nearby(pX, pZ, expandedAbilityRadius("Guardian Embrace", 10.0), e.InstanceID)
					for _, target := range nearby {
						if target.InstanceID != e.InstanceID {
							continue
						}
						if target.ID == e.ID {
							continue
						}
						if (target.Type == TypePlayer || target.Type == TypeNPC) && w.CombatRelationship(e, target) != RelationshipHostile && withinAbilityRadius("Guardian Embrace", pX, pZ, target, 10.0) {
							target.Mu.Lock()
							if target.State == "DEAD" {
								target.Mu.Unlock()
								continue
							}
							previousHealth := target.Health
							target.Health += applyHealingReceived(target, heal)
							if target.Health > target.MaxHealth {
								target.Health = target.MaxHealth
							}
							actualHeal := target.Health - previousHealth
							target.Mu.Unlock()
							if actualHeal > 0 && w.OnEvent != nil {
								w.OnEvent("heal", HealEvent{TargetID: target.ID, SourceID: e.ID, Amount: actualHeal, Kind: "guardian_embrace", InstanceID: e.InstanceID})
							}
						}
					}
					e.Mu.Lock()
				}
			}

			if e.SpiritsActive {
				// Cleric Spirits
				if now.After(e.SpiritEndTime) {
					e.SpiritsActive = false
					e.SpiritGuardiansRuneID = ""
					e.Mu.Unlock()
				} else {
					if time.Since(e.LastSpiritTick) >= 500*time.Millisecond {
						e.LastSpiritTick = now
						damage := 10 + (e.Stats.Wisdom * 1)
						if e.SpiritsBoosted {
							damage = 20 + int(float64(e.Stats.Wisdom)*1.5)
						}

						// Spirit Guardians Rune Effects
						spiritRuneID := e.SpiritGuardiansRuneID
						radius := spiritGuardiansRadius(e.SpiritsBoosted, spiritRuneID)

						// spirits_vengeful: +50% damage, -25% healing
						healReduction := 1.0
						if spiritRuneID == "spirits_vengeful" {
							damage = int(float64(damage) * 1.5)
							healReduction = 0.75
						}

						pX, pZ := e.X, e.Z
						hasSpiritHeal := e.HasAnySetBonus("spiritGuardiansHeal")
						e.Mu.Unlock() // Unlock before interaction

						effectiveRadius := expandedAbilityRadius("Spirit Guardians", radius)
						nearby := w.Grid.Nearby(pX, pZ, effectiveRadius, e.InstanceID)
						for _, target := range nearby {
							if target.InstanceID != e.InstanceID {
								continue
							}
							target.Mu.RLock()
							targetType := target.Type
							targetState := target.State
							targetID := target.ID
							target.Mu.RUnlock()

							if withinAbilityRadius("Spirit Guardians", pX, pZ, target, radius) {
								// Damage enemies
								if targetType == TypeEnemy && targetState != "DEAD" {
									target.Mu.Lock()
									finalDamage := applyFinalDamage(e, target, damage, "holy")
									addThreatLocked(target, e.ID, float64(finalDamage))
									isDead := target.Health <= 0
									target.Mu.Unlock()

									if w.OnEvent != nil {
										w.OnEvent("damage", DamageEvent{TargetID: targetID, SourceID: e.ID, Amount: finalDamage, Kind: "holy", InstanceID: e.InstanceID})
									}

									if isDead {
										target.Mu.Lock()
										w.handleDeath(target, e, deferred)
										target.Mu.Unlock()
									}
								}

								// Set Bonus: Divine Light 4pc (spiritGuardiansHeal) - Heal allies
								if hasSpiritHeal && targetType == TypePlayer && targetID != e.ID {
									healAmount := int(float64(5+(e.Stats.Wisdom/2)) * healReduction) // Apply vengeful rune reduction
									healAmount = applyHealingDoneBonus(e, healAmount)
									target.Mu.Lock()
									if target.State == "DEAD" {
										target.Mu.Unlock()
										continue
									}
									previousHealth := target.Health
									target.Health += applyHealingReceived(target, healAmount)
									if target.Health > target.MaxHealth {
										target.Health = target.MaxHealth
									}
									actualHeal := target.Health - previousHealth
									target.Mu.Unlock()
									if actualHeal > 0 {
										w.fireHealEvent(e.ID, targetID, actualHeal, "spirit_guardians", e.InstanceID)
									}
								}
							}
						}
					} else {
						e.Mu.Unlock()
					}
				}
			} else {
				e.Mu.Unlock()
			}
		}
	}

	if e.SubType == "AvengingSeraph" {
		e.Mu.RLock()
		ownerID := e.OwnerID
		e.Mu.RUnlock()
		owner := w.GetEntity(ownerID)
		// Owner Check (needed for both duration and bonus check)
		if owner == nil {
			deferred.addRemoval(e.ID)
			return
		}

		// Duration Check - Set Bonus: Crusader's Zeal 6pc (permanentSeraph) extends duration
		// Normal duration: 15s, with set bonus: permanent while in combat (300s max)
		owner.Mu.RLock()
		hasPermanentSeraph := owner.HasAnySetBonus("permanentSeraph")
		ox, oz := owner.X, owner.Z
		owner.Mu.RUnlock()

		e.Mu.Lock()

		maxDuration := 15 * time.Second
		if hasPermanentSeraph {
			maxDuration = 300 * time.Second // 5 minutes - effectively permanent in combat
		}

		if time.Since(e.CreatedAt) > maxDuration {
			e.Mu.Unlock()
			deferred.addRemoval(e.ID)
			return
		}

		// AI Logic
		// 1. Find Target (Enemy)
		var target *Entity
		minDist := 15.0 // Aggro Range

		// Unlock self to search grid
		ex, ez := e.X, e.Z
		e.Mu.Unlock()

		nearby := w.Grid.Nearby(ex, ez, minDist, e.InstanceID)
		for _, t := range nearby {
			if t.InstanceID != e.InstanceID {
				continue
			}
			t.Mu.RLock()
			if !w.CanDamage(owner, t) || t.State == "DEAD" {
				t.Mu.RUnlock()
				continue
			}
			dx := t.X - ex
			dz := t.Z - ez
			t.Mu.RUnlock()
			d := math.Sqrt(dx*dx + dz*dz)
			if d < minDist {
				minDist = d
				target = t
			}
		}

		e.Mu.Lock()

		// Attack Logic
		if target != nil {
			// Face Target
			target.Mu.RLock()
			tx, tz := target.X, target.Z
			target.Mu.RUnlock()

			dx := tx - e.X
			dz := tz - e.Z
			e.Rotation = math.Atan2(dx, dz)

			if time.Since(e.LastAttackTime) >= 1500*time.Millisecond {
				e.LastAttackTime = time.Now()
				e.State = "ATTACKING"

				// Ranged Smite Attack
				damage := e.Damage

				e.Mu.Unlock() // Unlock before interaction

				ownerIsPlayer := owner.Type == TypePlayer
				ownerID := e.OwnerID
				target.Mu.Lock()
				finalDamage := applyFinalDamage(owner, target, damage, "holy")
				if ownerIsPlayer {
					addThreatLocked(target, ownerID, float64(finalDamage))
				}
				isDead := target.Health <= 0
				target.Mu.Unlock()

				if w.OnEvent != nil {
					w.OnEvent("damage", DamageEvent{TargetID: target.ID, SourceID: e.ID, Amount: finalDamage, Kind: "holy", InstanceID: e.InstanceID})
					// Visual Beam event? Or just rely on attack animation
					w.OnEvent("ability", AbilityEvent{SourceID: e.ID, TargetID: target.ID, SkillName: "Smite", TargetX: tx, TargetZ: tz})
				}

				if isDead {
					target.Mu.Lock()
					w.handleDeath(target, owner, deferred) // Owner gets XP
					target.Mu.Unlock()
				}
				e.Mu.Lock()
			}
		} else {
			// Follow Owner
			dx := ox - e.X
			dz := oz - e.Z
			dist := math.Sqrt(dx*dx + dz*dz)

			if dist > 3.0 {
				e.State = "MOVING"
				// Move towards owner
				dirX := dx / dist
				dirZ := dz / dist
				speed := 6.0 * dt
				newX := e.X + dirX*speed
				newZ := e.Z + dirZ*speed
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, newX, newZ); ok {
					newX = constrainedX
					newZ = constrainedZ
				}

				e.X = newX
				e.Z = newZ
				e.Rotation = math.Atan2(dirX, dirZ)

				// Update Grid
				w.Grid.Update(e, ex, ez)
			} else {
				e.State = "IDLE"
			}
		}
		e.Mu.Unlock()
		return
	}

	if e.Type == TypeEnemy {
		// AI Logic
		var target *Entity
		minDist := 1000.0
		sightRange := EnemySightRange

		// Snapshot position + threat without holding the enemy lock while scanning players.
		var threatSnapshot map[string]float64
		e.Mu.RLock()
		ex, ez := e.X, e.Z
		if len(e.Threat) > 0 {
			threatSnapshot = make(map[string]float64, len(e.Threat))
			for k, v := range e.Threat {
				threatSnapshot[k] = v
			}
		}
		e.Mu.RUnlock()

		// Apply decay to snapshot so selection matches this tick's decay.
		decayFactor := math.Pow(0.97, dt)
		for k, v := range threatSnapshot {
			threatSnapshot[k] = v * decayFactor
		}

		// Pick target:
		// - If enemy has any threat on valid players, pick highest threat.
		// - Otherwise, pick nearest valid player.
		nearestDist := math.MaxFloat64
		var nearestPlayer *Entity
		maxThreat := 0.0
		threatDist := math.MaxFloat64
		var threatPlayer *Entity

		for _, p := range players {
			if p.InstanceID != e.InstanceID {
				continue
			}
			p.Mu.RLock()
			// Check Safe Zone
			if p.X > -100 && p.X < 100 && p.Z > 100 && p.Z < 300 {
				p.Mu.RUnlock()
				continue
			}
			// Check Stealth
			if p.StealthActive {
				if time.Now().Before(p.StealthEndTime) {
					p.Mu.RUnlock()
					continue
				}
			}
			dx := p.X - ex
			dz := p.Z - ez
			pid := p.ID
			p.Mu.RUnlock()

			dist := math.Sqrt(dx*dx + dz*dz)
			if dist < nearestDist {
				nearestDist = dist
				nearestPlayer = p
			}

			thr := 0.0
			if threatSnapshot != nil {
				thr = threatSnapshot[pid]
			}
			if thr > 0 {
				if thr > maxThreat || (thr == maxThreat && dist < threatDist) {
					maxThreat = thr
					threatDist = dist
					threatPlayer = p
				}
			}
		}

		if threatPlayer != nil {
			target = threatPlayer
			minDist = threatDist
		} else {
			target = nearestPlayer
			minDist = nearestDist
		}

		attackRange := 3.0 // Match PerformAttack base range (tighter so melee looks/feels like contact)
		roamRadius := 10.0

		e.Mu.Lock()
		defer e.Mu.Unlock()

		// Decay stored threat table by 3%/sec and prune tiny values.
		if len(e.Threat) > 0 {
			for k, v := range e.Threat {
				nv := v * decayFactor
				if nv < 0.01 {
					delete(e.Threat, k)
					continue
				}
				e.Threat[k] = nv
			}
		}

		// Adjust range for large entities (must match PerformAttack scaling)
		if e.Scale > 1.0 {
			// Use the same scaling as PerformAttack to ensure AI attacks when in range
			attackRange += (e.Scale - 1.0) * 1.5
		}

		// Animation Lock: If attacking, stay attacking and don't move
		// Lock for 80% of cooldown to allow a brief IDLE reset before next attack
		// This ensures the client sees a state change to trigger the animation again.
		lockDuration := time.Duration(float64(e.AttackCooldown) * 0.8)
		if lockDuration > 1*time.Second {
			lockDuration = 1 * time.Second
		}

		if time.Since(e.LastAttackTime) < lockDuration {
			if e.State != "ATTACKING" {
				e.State = "ATTACKING"
			}
			return
		}

		// After the swing lock, enemies should be allowed to move immediately.
		// We still want the state flip (ATTACKING -> IDLE) during cooldown so the
		// client can reliably retrigger ATTACKING on the next hit.
		cooldownActive := time.Since(e.LastAttackTime) < e.AttackCooldown
		if cooldownActive {
			e.State = "IDLE"
		}

		if target != nil && minDist <= sightRange {
			if minDist <= attackRange {
				// Attack (if off cooldown). If still on cooldown, stay IDLE in-place.
				if !cooldownActive {
					// Boss AoE Slam: bosses (Scale >= 4.0) periodically use a
					// telegraphed ground slam instead of their normal attack.
					// Cooldown: 10 seconds.  Telegraph: 2 seconds warning.
					if e.Scale >= 4.0 && time.Since(e.LastSpecialAttack) >= 10*time.Second {
						e.LastSpecialAttack = time.Now()
						e.LastAttackTime = time.Now() // put normal attack on cooldown too
						e.State = "ATTACKING"

						slamX := e.X
						slamZ := e.Z
						slamRadius := 8.0 + (e.Scale-1.0)*1.5 // ~12.5 for Scale 4
						slamDelay := 2.0                      // seconds
						bossID := e.ID
						bossDamage := e.Damage
						instanceID := e.InstanceID
						presentation := telegraphPresentationForDungeonBoss(e.SubType)

						// Emit telegraph event so clients show a warning circle
						if w.OnEvent != nil {
							w.OnEvent("telegraph", TelegraphEvent{
								SourceID:   bossID,
								X:          slamX,
								Z:          slamZ,
								Radius:     slamRadius,
								Duration:   slamDelay,
								Theme:      presentation.Theme,
								Attack:     presentation.Attack,
								ThreatTier: "boss",
								Label:      presentation.Label,
							})
						}

						// Schedule AoE damage after the telegraph delay
						go func(x, z, radius float64, delay time.Duration, dmg int, instID, srcID string) {
							time.Sleep(delay)

							w.Mu.Lock()
							defer w.Mu.Unlock()

							src := w.Entities[srcID]
							if src == nil || src.State == "DEAD" {
								return
							}

							for _, p := range w.Entities {
								if p.Type != TypePlayer || p.InstanceID != instID || p.State == "DEAD" {
									continue
								}
								p.Mu.Lock()
								dx := p.X - x
								dz := p.Z - z
								if math.Sqrt(dx*dx+dz*dz) <= radius {
									damage := dmg - p.Defense/2
									if damage < 1 {
										damage = 1
									}
									p.Health -= damage
									if w.OnEvent != nil {
										w.OnEvent("damage", DamageEvent{TargetID: p.ID, SourceID: srcID, Amount: damage, Kind: "physical", InstanceID: instID})
									}
									if p.Health <= 0 {
										w.handleDeath(p, src, nil)
									}
								}
								p.Mu.Unlock()
							}
						}(slamX, slamZ, slamRadius, time.Duration(slamDelay*float64(time.Second)), bossDamage, instanceID, bossID)
					} else {
						e.Mu.Unlock() // Unlock self before interaction
						w.PerformAttack(e.ID, target.ID)
						e.Mu.Lock() // Relock self
					}
				}
			} else {
				// Chase
				target.Mu.RLock()
				tx, tz := target.X, target.Z
				target.Mu.RUnlock()

				// Anti-stacking steering:
				// Many enemies converging on the exact player position causes them to overlap.
				// Instead, chase distinct offset points on a ring around the player.
				// Once in melee range, AI switches to attacking based on true distance to player.
				angle := hashAngle(e.ID + "|" + target.ID)
				// Offset tuned to be inside melee range but large enough to visibly separate.
				offset := 1.8
				if attackRange*0.8 < offset {
					offset = attackRange * 0.8
				}
				// Large entities get a slightly larger orbit to reduce clipping.
				if e.Scale > 1.0 {
					offset += (e.Scale - 1.0) * 0.5
				}

				e.TargetX = tx + math.Cos(angle)*offset
				e.TargetZ = tz + math.Sin(angle)*offset
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, e.TargetX, e.TargetZ); ok {
					e.TargetX = constrainedX
					e.TargetZ = constrainedZ
				}
				e.State = "MOVING"

				dx := e.TargetX - e.X
				dz := e.TargetZ - e.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist > 0 {
					moveDist := e.Speed * dt
					if moveDist > dist {
						moveDist = dist
					}
					oldX, oldZ := e.X, e.Z
					newX := e.X + (dx/dist)*moveDist
					newZ := e.Z + (dz/dist)*moveDist
					if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, newX, newZ); ok {
						newX = constrainedX
						newZ = constrainedZ
					}

					if newX > -100 && newX < 100 && newZ > 100 && newZ < 300 {
						e.State = "IDLE"
					} else {
						e.X = newX
						e.Z = newZ
						e.Rotation = math.Atan2(dx, dz)
						w.Grid.Update(e, oldX, oldZ)
					}
				}
			}
		} else {
			// Roam
			dx := e.TargetX - e.X
			dz := e.TargetZ - e.Z
			distToTarget := math.Sqrt(dx*dx + dz*dz)

			if distToTarget < 0.5 || (e.TargetX == 0 && e.TargetZ == 0) {
				angle := rand.Float64() * 2 * math.Pi
				dist := rand.Float64() * roamRadius
				e.TargetX = e.SpawnX + math.Cos(angle)*dist
				e.TargetZ = e.SpawnZ + math.Sin(angle)*dist
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, e.TargetX, e.TargetZ); ok {
					e.TargetX = constrainedX
					e.TargetZ = constrainedZ
				}
				e.State = "MOVING"
			}

			dx = e.TargetX - e.X
			dz = e.TargetZ - e.Z
			dist := math.Sqrt(dx*dx + dz*dz)

			if dist > 0 {
				moveDist := e.Speed * dt
				if moveDist > dist {
					moveDist = dist
				}
				oldX, oldZ := e.X, e.Z
				newX := e.X + (dx/dist)*moveDist
				newZ := e.Z + (dz/dist)*moveDist
				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(e, newX, newZ); ok {
					newX = constrainedX
					newZ = constrainedZ
				}

				if newX > -100 && newX < 100 && newZ > 100 && newZ < 300 {
					e.TargetX = e.SpawnX
					e.TargetZ = e.SpawnZ
				} else {
					e.X = newX
					e.Z = newZ
					e.Rotation = math.Atan2(dx, dz)
					w.Grid.Update(e, oldX, oldZ)
				}
			}
		}
	}
}
