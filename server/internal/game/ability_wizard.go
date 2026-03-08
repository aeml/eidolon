package game

import (
	"fmt"
	"math"
	"math/rand"
	"strings"
	"time"
)

// performWizardAbility handles all Wizard class ability logic.
// Extracted from the "Wizard" case in PerformAbility (world.go).
func (w *World) performWizardAbility(player *Entity, targetX, targetZ float64, targetID, skillName string, setCooldown func(time.Duration)) {
	if skillName == "Spell Focus" {
		// Spell Focus (Buff)
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost
			player.SpellFocusActive = true
			player.SpellFocusEndTime = time.Now().Add(15 * time.Second)
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 45*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Arcane Shield" {
		// Arcane Shield (Buff/Shield)
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Arcane Shield")

			// Extended rune: +50% duration (20s -> 30s)
			duration := 20 * time.Second
			if runeID == "arcaneshield_extended" {
				duration = 30 * time.Second
			}

			player.ArcaneShieldActive = true
			player.ArcaneShieldHP = 100 + (player.Stats.Intelligence * 5)
			player.ArcaneShieldEndTime = time.Now().Add(duration)
			player.ArcaneShieldRuneID = runeID
			player.ArcaneShieldAbsorbed = 0

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 30*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Time Warp" {
		// Time Warp (Buff)
		cost := resolveAbilityManaCost(player, skillName, 50)
		if player.Mana >= cost {
			player.Mana -= cost
			player.TimeWarpActive = true
			player.TimeWarpEndTime = time.Now().Add(8 * time.Second)
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 60*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Gravity Well" {
		// Gravity Well (AoE Pull + Slow)
		cost := resolveAbilityManaCost(player, skillName, 60)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Gravity Well")

			// Expanded rune: +50% radius
			radius := 8.0
			if runeID == "gravitywell_expanded" {
				radius = 12.0
			}
			effectiveRadius := expandedAbilityRadius(skillName, radius)

			// Base damage with talent bonus
			baseDamage := int(float64(20+player.Stats.Intelligence) * player.GetSkillDamageMultiplier("Gravity Well"))

			// Crushing rune: +100% damage
			if runeID == "gravitywell_crushing" {
				baseDamage *= 2
			}

			nearby := w.Grid.Nearby(targetX, targetZ, effectiveRadius, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}
				target.Mu.Lock()
				if target.Type == TypeEnemy && target.State != "DEAD" {
					if !withinAbilityRadius(skillName, targetX, targetZ, target, radius) {
						target.Mu.Unlock()
						continue
					}
					// Pull towards center
					dx := targetX - target.X
					dz := targetZ - target.Z
					dist := math.Sqrt(dx*dx + dz*dz)

					// Black Hole rune: enemies cannot escape (stronger pull)
					pullStrength := 0.5
					if runeID == "gravitywell_blackhole" {
						pullStrength = 0.8 // Stronger pull
						// Also root enemies briefly
						target.Rooted = true
						target.RootEndTime = time.Now().Add(2 * time.Second)
					}

					if dist > 0.5 {
						oldX, oldZ := target.X, target.Z
						target.X += dx * pullStrength
						target.Z += dz * pullStrength
						w.Grid.Update(target, oldX, oldZ)
					}

					// Apply damage
					target.Health -= baseDamage
					addThreatLocked(target, player.ID, float64(baseDamage))
					isDead := target.Health <= 0

					// Apply Slow
					target.Slowed = true
					target.SlowFactor = 0.5
					target.SlowEndTime = time.Now().Add(3 * time.Second)

					target.Mu.Unlock()

					w.fireDamageEvent(player.ID, target.ID, baseDamage)

					if isDead {
						target.Mu.Lock()
						w.handleDeath(target, player, nil)
						target.Mu.Unlock()
					}
				} else {
					target.Mu.Unlock()
				}
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Fireball" {
		// Fireball
		cost := resolveAbilityManaCost(player, skillName, 30)

		// Check for rune effects
		runeID := player.GetRuneForSkill("Fireball")

		// Combo: Implosion (Gravity Well → Fireball) = +100% damage to slowed targets
		wellBoostActive := player.ActiveCombo == "fireball_well_boost"
		if wellBoostActive {
			player.ActiveCombo = "" // Consume combo
		}

		// Empowered rune: +3s cooldown
		cooldown := 2 * time.Second
		if runeID == "fireball_empowered" {
			cooldown = 5 * time.Second
		}

		if player.Mana >= cost {
			player.Mana -= cost

			// Spawn Projectile
			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			if dist == 0 {
				dist = 1 // Avoid div by zero
			}

			// Magma rune: slower projectile
			speed := 20.0
			if runeID == "fireball_magma" {
				speed = 12.0
			}

			velX := (dx / dist) * speed
			velZ := (dz / dist) * speed

			damage := int(float64(20+(player.Stats.Wisdom*2)) * player.GetSkillDamageMultiplier("Fireball"))

			// Empowered rune: +100% damage
			if runeID == "fireball_empowered" {
				damage *= 2
			}

			// Chain rune: set bounces
			bounces := 0
			if runeID == "fireball_chain" {
				bounces = 3
			}

			proj := &Entity{
				ID:                fmt.Sprintf("proj-%d", time.Now().UnixNano()),
				InstanceID:        player.InstanceID,
				Type:              TypeProjectile,
				SubType:           "Fireball",
				X:                 player.X,
				Y:                 1.5,
				Z:                 player.Z,
				VelX:              velX,
				VelZ:              velZ,
				Radius:            2.0,
				Damage:            damage,
				OwnerID:           player.ID,
				Rotation:          math.Atan2(velX, velZ),
				CreatedAt:         time.Now(),
				Scale:             1.0,
				ProjectileRuneID:  runeID,
				ProjectileBounces: bounces,
				ProjectileSkill:   "Fireball",
				FireballWellBoost: wellBoostActive, // Combo: Implosion
			}
			w.Entities[proj.ID] = proj
			w.Grid.Add(proj)

			player.State = "ATTACKING"
			setCooldown(cooldown)
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Flame Whip" {
		// Flame Whip (Cone Stun)
		cost := resolveAbilityManaCost(player, skillName, 35)
		if player.Mana >= cost {
			player.Mana -= cost

			// Combo: Nova Cascade (Teleport → Flame Whip) = 360° cone
			novaCascadeActive := player.ActiveCombo == "flame_whip_360"
			if novaCascadeActive {
				player.ActiveCombo = "" // Consume combo
			}

			rangeDist := 12.0
			angleThreshold := math.Pi / 4 // 45 degrees
			damage := int(float64(25+(player.Stats.Intelligence*2)) * player.GetSkillDamageMultiplier("Flame Whip"))

			pDirX := math.Sin(player.Rotation)
			pDirZ := math.Cos(player.Rotation)

			nearby := w.Grid.Nearby(player.X, player.Z, rangeDist, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}

				target.Mu.RLock()
				if target.Type != TypeEnemy || target.State == "DEAD" {
					target.Mu.RUnlock()
					continue
				}
				dx := target.X - player.X
				dz := target.Z - player.Z
				target.Mu.RUnlock()

				dist := math.Sqrt(dx*dx + dz*dz)
				if dist <= rangeDist {
					dirX := dx / dist
					dirZ := dz / dist

					dot := pDirX*dirX + pDirZ*dirZ
					// Nova Cascade combo: skip angle check (360° AoE)
					if novaCascadeActive || dot > math.Cos(angleThreshold) {
						target.Mu.Lock()
						target.Health -= damage
						addThreatLocked(target, player.ID, float64(damage))
						target.Stunned = true
						target.StunEndTime = time.Now().Add(3 * time.Second)
						isDead := target.Health <= 0
						target.Mu.Unlock()

						w.fireDamageEvent(player.ID, target.ID, damage)

						if isDead {
							target.Mu.Lock()
							w.handleDeath(target, player, nil)
							target.Mu.Unlock()
						}
					}
				}
			}

			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 10*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)

			w.delayedIdleReset(player.ID)
		}
	} else if skillName == "Flame Tornado" {
		// Flame Tornado
		cost := resolveAbilityManaCost(player, skillName, 50)
		if player.Mana >= cost {
			player.Mana -= cost

			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			if dist == 0 {
				dist = 1
			}

			velX := (dx / dist) * 10.0 // Slow speed
			velZ := (dz / dist) * 10.0

			damage := int(float64(30+(player.Stats.Intelligence*3)) * player.GetSkillDamageMultiplier("Flame Tornado"))

			proj := &Entity{
				ID:        fmt.Sprintf("proj-%d", time.Now().UnixNano()),
				Type:      TypeProjectile,
				SubType:   "FlameTornado",
				X:         player.X,
				Y:         1.5,
				Z:         player.Z,
				VelX:      velX,
				VelZ:      velZ,
				Radius:    3.0, // Large radius
				Damage:    damage,
				OwnerID:   player.ID,
				Rotation:  math.Atan2(velX, velZ),
				CreatedAt: time.Now(),
				HitList:   make(map[string]bool), // Initialize HitList
				Scale:     1.0,
			}
			w.Entities[proj.ID] = proj
			w.Grid.Add(proj)

			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 8*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)

			w.delayedIdleReset(player.ID)
		}
	} else if skillName == "Meteor Drop" {
		// Meteor Drop
		cost := resolveAbilityManaCost(player, skillName, 60)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Meteor Drop")

			// Combo: Arcane Barrage (Arcane Shield → Meteor Drop) = Shield explodes on impact
			shieldExplodeActive := player.ActiveCombo == "shield_meteor_explosion"
			if shieldExplodeActive {
				player.ActiveCombo = "" // Consume combo
			}

			damage := int(float64(50+(player.Stats.Intelligence*3)) * player.GetSkillDamageMultiplier("Meteor Drop"))

			// Match the large ground ring the client shows for Meteor Drop.
			// Extinction keeps its +50% bonus on top of that visual radius.
			radius := 16.0
			if runeID == "meteor_extinction" {
				radius = 24.0
			}

			// Cluster rune: 3 smaller meteors instead of 1
			if runeID == "meteor_cluster" {
				// Spawn 3 smaller meteors in a triangle pattern
				offsets := []struct{ dx, dz float64 }{
					{0, 0},
					{-3, -2},
					{3, -2},
				}
				clusterDamage := damage * 2 / 3 // Each does ~67% damage
				clusterRadius := radius * 0.6

				for i, offset := range offsets {
					impactDelay := time.Duration(1500+i*200) * time.Millisecond
					impactX := targetX + offset.dx
					impactZ := targetZ + offset.dz
					proj := &Entity{
						ID:                  fmt.Sprintf("proj-meteor-%d-%d", time.Now().UnixNano(), i),
						InstanceID:          player.InstanceID,
						Type:                TypeProjectile,
						SubType:             "Meteor",
						X:                   impactX,
						Y:                   30.0,
						Z:                   impactZ,
						VelX:                0,
						VelZ:                0,
						Radius:              clusterRadius,
						Damage:              clusterDamage,
						OwnerID:             player.ID,
						CreatedAt:           time.Now(),
						LastAttackTime:      time.Now().Add(impactDelay), // Stagger impact
						Scale:               0.7,
						ProjectileRuneID:    runeID,
						ProjectileSkill:     "Meteor Drop",
						MeteorShieldExplode: shieldExplodeActive && i == 0, // Only first meteor triggers explosion
					}
					w.Entities[proj.ID] = proj
					w.Grid.Add(proj)
					w.fireTelegraphEvent(player.ID, impactX, impactZ, visualAbilityRadius(skillName, clusterRadius), impactDelay)
				}
			} else {
				// Single meteor
				impactDelay := 1500 * time.Millisecond
				proj := &Entity{
					ID:                  fmt.Sprintf("proj-meteor-%d", time.Now().UnixNano()),
					InstanceID:          player.InstanceID,
					Type:                TypeProjectile,
					SubType:             "Meteor",
					X:                   targetX,
					Y:                   30.0,
					Z:                   targetZ,
					VelX:                0,
					VelZ:                0,
					Radius:              radius,
					Damage:              damage,
					OwnerID:             player.ID,
					CreatedAt:           time.Now(),
					LastAttackTime:      time.Now().Add(impactDelay),
					Scale:               1.0,
					ProjectileRuneID:    runeID,
					ProjectileSkill:     "Meteor Drop",
					MeteorShieldExplode: shieldExplodeActive, // Combo: Arcane Barrage
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)
				w.fireTelegraphEvent(player.ID, targetX, targetZ, visualAbilityRadius(skillName, radius), impactDelay)

				// Apocalypse rune: meteors continue for 5s after cast
				if runeID == "meteor_apocalypse" {
					playerID := player.ID
					px, pz := targetX, targetZ
					instanceID := player.InstanceID
					go func() {
						for i := 0; i < 5; i++ {
							time.Sleep(1 * time.Second)
							// Spawn additional meteor at random offset
							offsetX := (rand.Float64() - 0.5) * 10
							offsetZ := (rand.Float64() - 0.5) * 10
							impactDelay := 1500 * time.Millisecond
							apocProj := &Entity{
								ID:              fmt.Sprintf("proj-meteor-apoc-%d-%d", time.Now().UnixNano(), i),
								InstanceID:      instanceID,
								Type:            TypeProjectile,
								SubType:         "Meteor",
								X:               px + offsetX,
								Y:               30.0,
								Z:               pz + offsetZ,
								VelX:            0,
								VelZ:            0,
								Radius:          radius * 0.7,
								Damage:          damage / 2,
								OwnerID:         playerID,
								CreatedAt:       time.Now(),
								LastAttackTime:  time.Now().Add(impactDelay),
								Scale:           0.7,
								ProjectileSkill: "Meteor Drop",
							}
							w.Mu.Lock()
							w.Entities[apocProj.ID] = apocProj
							w.Grid.Add(apocProj)
							w.Mu.Unlock()
							w.fireTelegraphEvent(playerID, apocProj.X, apocProj.Z, visualAbilityRadius("Meteor Drop", apocProj.Radius), impactDelay)
						}
					}()
				}
			}

			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 15*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Inferno Cataclysm" {
		// Inferno Cataclysm (AoE Zone)
		cost := resolveAbilityManaCost(player, skillName, 60)
		if player.Mana >= cost {
			player.Mana -= cost

			// Combo: Time Burn (Time Warp → Inferno Cataclysm) = Double tick rate
			doubleTickActive := player.ActiveCombo == "cataclysm_double_tick"
			if doubleTickActive {
				player.ActiveCombo = "" // Consume combo
			}

			// Spawn Zone
			zone := &Entity{
				ID:             fmt.Sprintf("zone-inferno-%d", time.Now().UnixNano()),
				Type:           TypeProjectile,
				SubType:        "ZoneDamage",
				X:              targetX,
				Y:              0.1,
				Z:              targetZ,
				Radius:         12.0,
				Damage:         int(float64(30+player.Stats.Intelligence) * player.GetSkillDamageMultiplier("Inferno Cataclysm")),
				OwnerID:        player.ID,
				CreatedAt:      time.Now(),
				Scale:          12.0 / 5.0,       // Encode radius for client rendering (base geometry is 5.0)
				ZoneDoubleTick: doubleTickActive, // Combo: Time Burn
			}
			w.Entities[zone.ID] = zone
			w.Grid.Add(zone)

			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 60*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)

			w.delayedIdleReset(player.ID)
		}
	} else if skillName == "Scorch Beam" {
		// Scorch Beam (Line Damage)
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost

			rangeDist := 15.0
			width := 1.0
			damage := int(float64(25+(player.Stats.Intelligence*2)) * player.GetSkillDamageMultiplier("Scorch Beam"))

			// Line Check
			// Vector from player to target
			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			if dist == 0 {
				dist = 1
			}
			dirX := dx / dist
			dirZ := dz / dist

			// Check all entities
			nearby := w.Grid.Nearby(player.X, player.Z, rangeDist, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}
				target.Mu.RLock()
				if target.Type != TypeEnemy || target.State == "DEAD" {
					target.Mu.RUnlock()
					continue
				}
				tx, tz := target.X, target.Z
				target.Mu.RUnlock()

				// Project target onto line
				vX := tx - player.X
				vZ := tz - player.Z
				t := vX*dirX + vZ*dirZ

				if t > 0 && t < rangeDist {
					// Closest point on line
					cX := player.X + dirX*t
					cZ := player.Z + dirZ*t

					// Distance to line
					d2 := (tx-cX)*(tx-cX) + (tz-cZ)*(tz-cZ)
					if d2 < width*width {
						// Hit
						target.Mu.Lock()
						target.Health -= damage
						addThreatLocked(target, player.ID, float64(damage))
						isDead := target.Health <= 0
						target.Mu.Unlock()

						w.fireDamageEvent(player.ID, target.ID, damage)
						if isDead {
							target.Mu.Lock()
							w.handleDeath(target, player, nil)
							target.Mu.Unlock()
						}
					}
				}
			}

			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 8*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)

			w.delayedIdleReset(player.ID)
		}
	} else if skillName == "Dragonfire Lance" {
		// Dragonfire Lance (Single Target Nuke)
		cost := resolveAbilityManaCost(player, skillName, 50)
		if player.Mana >= cost {
			player.Mana -= cost

			damage := int(float64(100+(player.Stats.Intelligence*5)) * player.GetSkillDamageMultiplier("Dragonfire Lance"))

			// Projectile
			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			if dist == 0 {
				dist = 1
			}
			velX := (dx / dist) * 40.0
			velZ := (dz / dist) * 40.0

			proj := &Entity{
				ID:        fmt.Sprintf("proj-lance-%d", time.Now().UnixNano()),
				Type:      TypeProjectile,
				SubType:   "Fireball", // Reuse fireball visual but bigger?
				X:         player.X,
				Y:         1.5,
				Z:         player.Z,
				VelX:      velX,
				VelZ:      velZ,
				Radius:    1.0,
				Damage:    damage,
				OwnerID:   player.ID,
				Rotation:  math.Atan2(velX, velZ),
				CreatedAt: time.Now(),
				Scale:     1.0,
			}
			w.Entities[proj.ID] = proj
			w.Grid.Add(proj)

			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)

			w.delayedIdleReset(player.ID)
		}
	} else if skillName == "Frost Nova" {
		// Frost Nova
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost

			radius := 8.0
			effectiveRadius := expandedAbilityRadius(skillName, radius)
			damage := int(float64(25+(player.Stats.Intelligence*2)) * player.GetSkillDamageMultiplier("Frost Nova"))

			nearby := w.Grid.Nearby(player.X, player.Z, effectiveRadius, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}
				target.Mu.RLock()
				if target.Type != TypeEnemy || target.State == "DEAD" {
					target.Mu.RUnlock()
					continue
				}
				target.Mu.RUnlock()

				if withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.Mu.Lock()
					target.Health -= damage
					addThreatLocked(target, player.ID, float64(damage))
					isDead := target.Health <= 0
					target.Mu.Unlock()

					w.fireDamageEvent(player.ID, target.ID, damage)

					if isDead {
						target.Mu.Lock()
						w.handleDeath(target, player, nil)
						target.Mu.Unlock()
					}
				}
			}

			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 10*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)

			w.delayedIdleReset(player.ID)
		}
	} else if skillName == "Arcane Missiles" {
		// Arcane Missiles
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost

			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			if dist == 0 {
				dist = 1
			}

			baseAngle := math.Atan2(dz, dx)
			angles := []float64{baseAngle - 0.2, baseAngle, baseAngle + 0.2}

			for i, angle := range angles {
				velX := math.Cos(angle) * 25.0
				velZ := math.Sin(angle) * 25.0

				damage := int(float64(15+player.Stats.Intelligence) * player.GetSkillDamageMultiplier("Arcane Missiles"))

				proj := &Entity{
					ID:         fmt.Sprintf("proj-%s-%d-%d", player.ID, time.Now().UnixNano(), i),
					InstanceID: player.InstanceID,
					Type:       TypeProjectile,
					SubType:    "ArcaneMissile",
					X:          player.X,
					Y:          1.5,
					Z:          player.Z,
					VelX:       velX,
					VelZ:       velZ,
					Radius:     1.0,
					Damage:     damage,
					OwnerID:    player.ID,
					Rotation:   angle,
					CreatedAt:  time.Now(),
					Scale:      1.0,
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)
			}

			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 4*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Teleport" {
		// Teleport
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			// Check for rune effects
			runeID := player.GetRuneForSkill("Teleport")

			// Blink rune: +50% range
			maxRange := 15.0
			if runeID == "teleport_blink" {
				maxRange = 22.5
			}

			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)

			if dist <= maxRange {
				player.Mana -= cost
				oldX, oldZ := player.X, player.Z

				// Warp rune: damage enemies at start location
				if runeID == "teleport_warp" {
					warpDamage := 15 + player.Stats.Intelligence
					warpRadius := 4.0
					effectiveWarpRadius := expandedAbilityRadius(skillName, warpRadius)
					startNearby := w.Grid.Nearby(oldX, oldZ, effectiveWarpRadius, player.InstanceID)
					for _, target := range startNearby {
						target.Mu.RLock()
						if target.Type != TypeEnemy || target.State == "DEAD" {
							target.Mu.RUnlock()
							continue
						}
						target.Mu.RUnlock()

						if withinAbilityRadius(skillName, oldX, oldZ, target, warpRadius) {
							target.Mu.Lock()
							target.Health -= warpDamage
							addThreatLocked(target, player.ID, float64(warpDamage))
							isDead := target.Health <= 0
							target.Mu.Unlock()

							w.fireDamageEvent(player.ID, target.ID, warpDamage)
							if isDead {
								target.Mu.Lock()
								w.handleDeath(target, player, nil)
								target.Mu.Unlock()
							}
						}
					}
				}

				// Clamp to bounds
				if targetX < -1000 {
					targetX = -1000
				}
				if targetX > 1000 {
					targetX = 1000
				}
				if targetZ < -2200 {
					targetZ = -2200
				}
				if targetZ > 1000 {
					targetZ = 1000
				}

				// Dungeon Bounds Check
				if strings.HasPrefix(player.InstanceID, "dungeon_") {
					if !w.IsLocationInDungeon(player.InstanceID, targetX, targetZ) {
						// Teleported out of bounds -> Exit Instance
						w.PerformRecall(player.ID)
						return
					}
				}

				player.X = targetX
				player.Z = targetZ
				w.Grid.Update(player, oldX, oldZ)

				// Warp rune: damage enemies at end location
				if runeID == "teleport_warp" {
					warpDamage := 15 + player.Stats.Intelligence
					warpRadius := 4.0
					effectiveWarpRadius := expandedAbilityRadius(skillName, warpRadius)
					endNearby := w.Grid.Nearby(targetX, targetZ, effectiveWarpRadius, player.InstanceID)
					for _, target := range endNearby {
						target.Mu.RLock()
						if target.Type != TypeEnemy || target.State == "DEAD" {
							target.Mu.RUnlock()
							continue
						}
						target.Mu.RUnlock()

						if withinAbilityRadius(skillName, targetX, targetZ, target, warpRadius) {
							target.Mu.Lock()
							target.Health -= warpDamage
							addThreatLocked(target, player.ID, float64(warpDamage))
							isDead := target.Health <= 0
							target.Mu.Unlock()

							w.fireDamageEvent(player.ID, target.ID, warpDamage)
							if isDead {
								target.Mu.Lock()
								w.handleDeath(target, player, nil)
								target.Mu.Unlock()
							}
						}
					}
				}

				// Phase rune: invulnerable for 1s after teleport
				if runeID == "teleport_phase" {
					player.InvulnerableEndTime = time.Now().Add(1 * time.Second)
				}

				setCooldown(resolveAbilityCooldown(player.SubType, skillName, 12*time.Second))
				// Teleport mutates targetX/targetZ (clamping), so pass the clamped values
				w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
			}
		}
	}
}
