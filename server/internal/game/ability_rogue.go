package game

import (
	"fmt"
	"math"
	"time"
)

// performRogueAbility handles all Rogue class ability logic.
// Extracted from the "Rogue" case in PerformAbility (world.go).
func (w *World) performRogueAbility(player *Entity, targetX, targetZ float64, targetID, skillName string, setCooldown func(time.Duration)) {
	if skillName == "Stealth" {
		// Stealth (Buff)
		cost := resolveAbilityManaCost(player, skillName, 25)
		if player.Mana >= cost {
			player.Mana -= cost
			player.StealthActive = true
			player.StealthEndTime = time.Now().Add(10 * time.Second)
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Shadow Strike" {
		// Shadow Strike (Teleport + Damage)
		cost := resolveAbilityManaCost(player, skillName, 35)
		if player.Mana >= cost {
			// Teleport behind target
			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)

			if dist <= 10.0 { // Max range
				player.Mana -= cost

				// Calculate position behind target
				// Normalize direction
				dirX := dx / dist
				dirZ := dz / dist

				// Teleport to other side
				destX := targetX + dirX*1.0
				destZ := targetZ + dirZ*1.0

				oldX, oldZ := player.X, player.Z
				player.X = destX
				player.Z = destZ
				w.Grid.Update(player, oldX, oldZ)

				// Deal Damage with talent bonus
				damage := int(float64(player.Damage) * 2.0 * player.GetSkillDamageMultiplier("Shadow Strike"))
				if player.StealthActive {
					damage = int(float64(damage) * 1.5)
					player.StealthActive = false // Break stealth
				}

				// Find target at location
				nearby := w.Grid.Nearby(targetX, targetZ, 2.0, player.InstanceID)
				for _, target := range nearby {
					if target.ID == player.ID {
						continue
					}
					target.Mu.Lock()
					if target.Type == TypeEnemy && target.State != "DEAD" {
						target.Health -= damage
						addThreatLocked(target, player.ID, float64(damage))

						// Apply Bleed
						target.Bleeding = true
						target.BleedDamage = 10 + (player.Stats.Dexterity / 2)
						target.BleedEndTime = time.Now().Add(10 * time.Second)

						w.fireDamageEvent(player.ID, target.ID, damage)
						if target.Health <= 0 {
							w.handleDeath(target, player, nil)
						}
					}
					target.Mu.Unlock()
				}

				setCooldown(resolveAbilityCooldown(player.SubType, skillName, 10*time.Second))
				w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
			}
		}
	} else if skillName == "Weak Point Mark" {
		// Weak Point Mark (Debuff)
		cost := resolveAbilityManaCost(player, skillName, 25)
		if player.Mana >= cost {
			player.Mana -= cost

			// Find target near cursor
			var bestTarget *Entity
			minDist := 3.0
			nearby := w.Grid.Nearby(targetX, targetZ, 5.0, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}
				target.Mu.RLock()
				if target.Type != TypeEnemy || target.State == "DEAD" {
					target.Mu.RUnlock()
					continue
				}
				dx := target.X - targetX
				dz := target.Z - targetZ
				target.Mu.RUnlock()

				d := math.Sqrt(dx*dx + dz*dz)
				if d < minDist {
					minDist = d
					bestTarget = target
				}
			}

			if bestTarget != nil {
				bestTarget.Mu.Lock()
				bestTarget.WeakPointMarked = true
				bestTarget.WeakPointEndTime = time.Now().Add(10 * time.Second)
				bestTarget.Mu.Unlock()
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 12*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Ricochet Blades" {
		// Ricochet Blades (Projectile)
		cost := resolveAbilityManaCost(player, skillName, 20)
		if player.Mana >= cost {
			player.Mana -= cost

			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			if dist == 0 {
				dist = 1
			}

			velX := (dx / dist) * 25.0
			velZ := (dz / dist) * 25.0

			damage := int(float64(15+int(float64(player.Stats.Dexterity)*1.2)) * player.GetSkillDamageMultiplier("Ricochet Blades"))

			proj := &Entity{
				ID:         fmt.Sprintf("proj-%d", time.Now().UnixNano()),
				InstanceID: player.InstanceID,
				Type:       TypeProjectile,
				SubType:    "Dagger", // Reuse Dagger visual
				X:          player.X,
				Y:          1.0,
				Z:          player.Z,
				VelX:       velX,
				VelZ:       velZ,
				Radius:     1.5,
				Damage:     damage,
				OwnerID:    player.ID,
				Rotation:   math.Atan2(velX, velZ),
				CreatedAt:  time.Now(),
				Scale:      1.0,
			}
			w.Entities[proj.ID] = proj
			w.Grid.Add(proj)

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 8*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Poison Coating" {
		// Poison Coating (Buff)
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost
			player.PoisonCoatingActive = true
			player.PoisonCoatingEndTime = time.Now().Add(15 * time.Second)
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 30*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Explosive Trap" {
		// Explosive Trap
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost

			trap := &Entity{
				ID:         fmt.Sprintf("trap-exp-%d", time.Now().UnixNano()),
				InstanceID: player.InstanceID,
				Type:       TypeProjectile, // Handled in updateProjectiles
				SubType:    "ExplosiveTrap",
				X:          player.X,
				Y:          0.5,
				Z:          player.Z,
				VelX:       0,
				VelZ:       0,
				Radius:     1.0,
				Damage:     50 + (player.Stats.Dexterity * 3),
				OwnerID:    player.ID,
				CreatedAt:  time.Now(),
			}
			w.Entities[trap.ID] = trap
			w.Grid.Add(trap)

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 15*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Snare Trap" {
		// Snare Trap
		cost := resolveAbilityManaCost(player, skillName, 25)
		if player.Mana >= cost {
			player.Mana -= cost

			trap := &Entity{
				ID:         fmt.Sprintf("trap-snare-%d", time.Now().UnixNano()),
				InstanceID: player.InstanceID,
				Type:       TypeProjectile,
				SubType:    "SnareTrap",
				X:          player.X,
				Y:          0.5,
				Z:          player.Z,
				VelX:       0,
				VelZ:       0,
				Radius:     1.0,
				Damage:     10, // Low damage, mostly root
				OwnerID:    player.ID,
				CreatedAt:  time.Now(),
			}
			w.Entities[trap.ID] = trap
			w.Grid.Add(trap)

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 18*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Rain of Arrows" {
		// Rain of Arrows (AoE)
		cost := resolveAbilityManaCost(player, skillName, 45)
		if player.Mana >= cost {
			player.Mana -= cost

			// Target area
			radius := 6.0
			damage := int(float64(20+(player.Stats.Dexterity*2)) * player.GetSkillDamageMultiplier("Rain of Arrows"))

			nearby := w.Grid.Nearby(targetX, targetZ, radius, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}
				target.Mu.Lock()
				if target.Type == TypeEnemy && target.State != "DEAD" {
					dx := target.X - targetX
					dz := target.Z - targetZ
					if (dx*dx + dz*dz) <= radius*radius {
						target.Health -= damage
						addThreatLocked(target, player.ID, float64(damage))
						w.fireDamageEvent(player.ID, target.ID, damage)
						if target.Health <= 0 {
							w.handleDeath(target, player, nil)
						}
					}
				}
				target.Mu.Unlock()
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 12*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Piercing Throw" {
		// Throw Dagger
		cost := resolveAbilityManaCost(player, skillName, 15)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Piercing Throw")

			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			if dist == 0 {
				dist = 1
			}

			velX := (dx / dist) * 35.0 // Speed 35
			velZ := (dz / dist) * 35.0

			damage := int(float64(15+int(float64(player.Stats.Dexterity)*1.5)) * player.GetSkillDamageMultiplier("Piercing Throw"))

			// Empowered rune: +100% damage
			if runeID == "piercingthrow_empowered" {
				damage *= 2
			}

			// Calculate bounces for ricochet rune
			bounces := 0
			if runeID == "piercingthrow_ricochet" {
				bounces = 2
			}

			proj := &Entity{
				ID:                fmt.Sprintf("proj-%d", time.Now().UnixNano()),
				InstanceID:        player.InstanceID,
				Type:              TypeProjectile,
				SubType:           "Dagger",
				X:                 player.X,
				Y:                 1.0,
				Z:                 player.Z,
				VelX:              velX,
				VelZ:              velZ,
				Radius:            1.5,
				Damage:            damage,
				OwnerID:           player.ID,
				Rotation:          math.Atan2(velX, velZ),
				CreatedAt:         time.Now(),
				Scale:             1.0,
				ProjectileRuneID:  runeID,
				ProjectileBounces: bounces,
				ProjectileSkill:   "Piercing Throw",
			}
			w.Entities[proj.ID] = proj
			w.Grid.Add(proj)
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 1*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Fan of Knives" {
		// Fan of Knives
		cost := resolveAbilityManaCost(player, skillName, 25)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Fan of Knives")

			// Bladed Fury rune: double the number of knives
			projectileCount := 12
			if runeID == "fanofknives_fury" {
				projectileCount = 24
			}
			angleStep := (2 * math.Pi) / float64(projectileCount)

			for i := 0; i < projectileCount; i++ {
				angle := float64(i) * angleStep
				velX := math.Cos(angle) * 25.0
				velZ := math.Sin(angle) * 25.0

				damage := int(float64(10+player.Stats.Dexterity) * player.GetSkillDamageMultiplier("Fan of Knives"))

				proj := &Entity{
					ID:               fmt.Sprintf("proj-%s-%d-%d", player.ID, time.Now().UnixNano(), i),
					InstanceID:       player.InstanceID,
					Type:             TypeProjectile,
					SubType:          "Dagger",
					X:                player.X,
					Y:                1.0,
					Z:                player.Z,
					VelX:             velX,
					VelZ:             velZ,
					Radius:           1.0,
					Damage:           damage,
					OwnerID:          player.ID,
					Rotation:         angle,
					CreatedAt:        time.Now(),
					Scale:            1.0,
					ProjectileRuneID: runeID,
					ProjectileSkill:  "Fan of Knives",
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 6*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Backstab" {
		// Backstab
		cost := resolveAbilityManaCost(player, skillName, 20)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Backstab")

			rangeDist := 2.5
			damage := int(float64(player.Damage) * 1.5 * player.GetSkillDamageMultiplier("Backstab"))

			// Find target
			var bestTarget *Entity
			minDist := rangeDist

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

				d := math.Sqrt(dx*dx + dz*dz)
				if d < minDist {
					minDist = d
					bestTarget = target
				}
			}

			if bestTarget != nil {
				// Shadowstep rune: teleport behind target before striking
				if runeID == "backstab_shadowstep" {
					bestTarget.Mu.RLock()
					tRot := bestTarget.Rotation
					tx, tz := bestTarget.X, bestTarget.Z
					bestTarget.Mu.RUnlock()

					// Teleport behind
					tDirX := math.Sin(tRot)
					tDirZ := math.Cos(tRot)
					teleX := tx - tDirX*1.5
					teleZ := tz - tDirZ*1.5

					oldX, oldZ := player.X, player.Z
					player.X = teleX
					player.Z = teleZ
					player.Rotation = tRot
					w.Grid.Update(player, oldX, oldZ)
				}

				// Check angle for backstab
				bestTarget.Mu.RLock()
				tRot := bestTarget.Rotation
				tDefense := bestTarget.Defense
				bestTarget.Mu.RUnlock()

				tDirX := math.Sin(tRot)
				tDirZ := math.Cos(tRot)

				pDirX := math.Sin(player.Rotation)
				pDirZ := math.Cos(player.Rotation)

				dot := tDirX*pDirX + tDirZ*pDirZ

				// Set Bonus: Shadow's Embrace 4pc (backstabAnyAngle) - Backstab from any angle
				// Shadowstep rune always counts as from behind
				if dot > 0.5 || player.HasAnySetBonus("backstabAnyAngle") || runeID == "backstab_shadowstep" {
					damage = int(float64(damage) * 2.5)
				}

				// Combo: Ambush (Cloak & Vanish → Backstab) = Guaranteed critical hit
				if player.ActiveCombo == "backstab_guaranteed_crit" {
					damage = damage * 2     // 2x crit damage
					player.ActiveCombo = "" // Consume combo
				}

				// Ambush rune: +50% crit chance (simplified as +25% damage on average)
				if runeID == "backstab_ambush" {
					// Simulate 50% crit chance with 2x crit damage = +50% average damage
					damage = int(float64(damage) * 1.5)
				}

				// Eviscerate rune: ignores 50% armor
				armorReduction := 0
				if runeID == "backstab_eviscerate" {
					armorReduction = tDefense / 2
				}

				finalDamage := damage - (tDefense - armorReduction)
				if finalDamage < 1 {
					finalDamage = 1
				}

				bestTarget.Mu.Lock()
				bestTarget.Health -= finalDamage
				addThreatLocked(bestTarget, player.ID, float64(finalDamage))
				isDead := bestTarget.Health <= 0
				bestTarget.Mu.Unlock()

				w.fireDamageEvent(player.ID, bestTarget.ID, finalDamage)
				if isDead {
					bestTarget.Mu.Lock()
					w.handleDeath(bestTarget, player, nil)
					bestTarget.Mu.Unlock()
				}
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 6*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Shadow Lunge" {
		// Teleport Behind
		cost := resolveAbilityManaCost(player, skillName, 25)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Shadow Lunge")

			// Extended rune: +50% range
			maxRange := 10.0
			if runeID == "shadowlunge_extended" {
				maxRange = 15.0
			}

			// Find target
			var bestTarget *Entity
			minDist := maxRange

			nearby := w.Grid.Nearby(targetX, targetZ, maxRange, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}
				target.Mu.RLock()
				if target.Type != TypeEnemy || target.State == "DEAD" {
					target.Mu.RUnlock()
					continue
				}
				dx := target.X - targetX
				dz := target.Z - targetZ
				target.Mu.RUnlock()

				d := math.Sqrt(dx*dx + dz*dz)
				if d < minDist {
					minDist = d
					bestTarget = target
				}
			}

			if bestTarget != nil {
				bestTarget.Mu.RLock()
				tRot := bestTarget.Rotation
				tx, tz := bestTarget.X, bestTarget.Z
				bestTarget.Mu.RUnlock()

				// Behind position
				tDirX := math.Sin(tRot)
				tDirZ := math.Cos(tRot)

				teleX := tx - tDirX*1.5
				teleZ := tz - tDirZ*1.5

				oldX, oldZ := player.X, player.Z
				player.X = teleX
				player.Z = teleZ
				player.Rotation = tRot
				w.Grid.Update(player, oldX, oldZ)

				// Cripple rune: slow target by 50% for 3s
				if runeID == "shadowlunge_cripple" {
					bestTarget.Mu.Lock()
					bestTarget.Slowed = true
					bestTarget.SlowFactor = 0.50
					bestTarget.SlowEndTime = time.Now().Add(3 * time.Second)
					bestTarget.Mu.Unlock()
				}

				// Shadow Clone rune: create illusion that attacks once
				if runeID == "shadowlunge_shadow" {
					// Create a temporary "illusion" that deals one attack worth of damage
					cloneDamage := player.Damage
					bestTarget.Mu.Lock()
					bestTarget.Health -= cloneDamage
					addThreatLocked(bestTarget, player.ID, float64(cloneDamage))
					isDead := bestTarget.Health <= 0
					bestTarget.Mu.Unlock()

					w.fireDamageEvent(player.ID, bestTarget.ID, cloneDamage)
					if isDead {
						bestTarget.Mu.Lock()
						w.handleDeath(bestTarget, player, nil)
						bestTarget.Mu.Unlock()
					}
				}
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 10*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Blade Storm" {
		// Cone of Daggers
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost

			dx := targetX - player.X
			dz := targetZ - player.Z
			baseAngle := math.Atan2(dx, dz)
			angleStep := math.Pi / 8

			for i := -2; i <= 2; i++ {
				angle := baseAngle + float64(i)*angleStep
				velX := math.Sin(angle) * 35.0
				velZ := math.Cos(angle) * 35.0

				damage := int(float64(10+player.Stats.Dexterity) * player.GetSkillDamageMultiplier("Blade Storm"))

				proj := &Entity{
					ID:        fmt.Sprintf("proj-%s-%d-%d", player.ID, time.Now().UnixNano(), i),
					Type:      TypeProjectile,
					SubType:   "Dagger",
					X:         player.X,
					Y:         1.0,
					Z:         player.Z,
					VelX:      velX,
					VelZ:      velZ,
					Radius:    1.0,
					Damage:    damage,
					OwnerID:   player.ID,
					Rotation:  angle,
					CreatedAt: time.Now(),
					Scale:     1.0,
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 15*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Death Spiral" {
		// AoE
		cost := resolveAbilityManaCost(player, skillName, 35)
		if player.Mana >= cost {
			player.Mana -= cost

			radius := 4.0
			damage := int(float64(player.Damage*2) * player.GetSkillDamageMultiplier("Death Spiral"))

			// Combo: Venom Burst (Poison Coating → Death Spiral) = +100% poison damage
			venomBurstActive := player.ActiveCombo == "death_spiral_poison_boost"
			if venomBurstActive {
				player.ActiveCombo = "" // Consume combo
			}

			nearby := w.Grid.Nearby(player.X, player.Z, radius, player.InstanceID)
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
				isPoisoned := target.Poisoned
				target.Mu.RUnlock()

				if (dx*dx + dz*dz) <= radius*radius {
					target.Mu.Lock()
					// Calculate final damage
					finalDamage := damage
					// Venom Burst: +100% damage to poisoned targets
					if venomBurstActive && isPoisoned {
						finalDamage = damage * 2
					}
					target.Health -= finalDamage
					isDead := target.Health <= 0
					target.Mu.Unlock()

					w.fireDamageEvent(player.ID, target.ID, finalDamage)
					if isDead {
						target.Mu.Lock()
						w.handleDeath(target, player, nil)
						target.Mu.Unlock()
					}
				}
			}
			// BUG FIX: was setCooldown(20 * time.Second) without resolveAbilityCooldown
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Cloak & Vanish" {
		// Stealth + Speed
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Cloak & Vanish")

			// Lasting Shadow rune: +100% duration (5s -> 10s)
			duration := 5 * time.Second
			if runeID == "cloak_longer" {
				duration = 10 * time.Second
			}

			player.StealthActive = true
			player.StealthEndTime = time.Now().Add(duration)

			// Swift rune: +30% movement speed while invisible
			if runeID == "cloak_swift" {
				player.CloakSwiftSpeedBonus = true
			}

			// Prepared Ambush rune: next attack deals +100% damage
			if runeID == "cloak_ambush" {
				player.CloakNextAttackBonus = 1.0 // 100% bonus
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 30*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Smoke Bomb" {
		// Smoke Bomb (AoE Slow)
		cost := resolveAbilityManaCost(player, skillName, 35)

		// Combo: Shadow Dance (Shadow Lunge → Smoke Bomb) = Instant cast (no cooldown, reduced mana)
		shadowDanceActive := player.ActiveCombo == "smoke_bomb_instant"
		if shadowDanceActive {
			cost = cost / 2         // Half mana cost
			player.ActiveCombo = "" // Consume combo
		}

		if player.Mana >= cost {
			player.Mana -= cost

			radius := 5.0
			nearby := w.Grid.Nearby(player.X, player.Z, radius, player.InstanceID)
			for _, target := range nearby {
				if target.Type == TypeEnemy && target.State != "DEAD" {
					target.Mu.Lock()
					target.Slowed = true
					target.SlowEndTime = time.Now().Add(5 * time.Second)
					target.Mu.Unlock()
				}
			}

			// Shadow Dance combo: no cooldown
			if !shadowDanceActive {
				setCooldown(resolveAbilityCooldown(player.SubType, skillName, 60*time.Second))
			}
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Tripwire" {
		// Tripwire (Trap)
		cost := resolveAbilityManaCost(player, skillName, 25)
		if player.Mana >= cost {
			player.Mana -= cost

			trap := &Entity{
				ID:         fmt.Sprintf("trap-trip-%d", time.Now().UnixNano()),
				InstanceID: player.InstanceID,
				Type:       TypeProjectile,
				SubType:    "Tripwire",
				X:          player.X,
				Y:          0.1,
				Z:          player.Z,
				Radius:     1.5,
				Damage:     20 + player.Stats.Dexterity,
				OwnerID:    player.ID,
				CreatedAt:  time.Now(),
				Scale:      1.0,
			}
			w.Entities[trap.ID] = trap
			w.Grid.Add(trap)

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 15*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Phantom Volley" {
		// Phantom Volley (Rapid Fire Single Target)
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost

			// Combo: Blade Tornado (Fan of Knives → Phantom Volley) = Pierces all targets
			shouldPierce := player.ActiveCombo == "volley_pierce"
			if shouldPierce {
				player.ActiveCombo = "" // Consume combo
			}

			dx := targetX - player.X
			dz := targetZ - player.Z
			dist := math.Sqrt(dx*dx + dz*dz)
			if dist == 0 {
				dist = 1
			}
			dirX := dx / dist
			dirZ := dz / dist

			// Fire 3 projectiles in a line with spacing to simulate rapid fire
			for i := 0; i < 3; i++ {
				// Offset backwards so they arrive sequentially
				// Speed is 35. 0.15s delay approx 5 units.
				offset := float64(i) * -5.0

				proj := &Entity{
					ID:               fmt.Sprintf("proj-phantom-%d-%d", time.Now().UnixNano(), i),
					InstanceID:       player.InstanceID,
					Type:             TypeProjectile,
					SubType:          "PhantomArrow",
					X:                player.X + (dirX * offset),
					Y:                1.0,
					Z:                player.Z + (dirZ * offset),
					VelX:             dirX * 35.0,
					VelZ:             dirZ * 35.0,
					Radius:           0.5,
					Damage:           int(float64(25+(player.Stats.Dexterity*2)) * player.GetSkillDamageMultiplier("Phantom Volley")),
					OwnerID:          player.ID,
					Rotation:         math.Atan2(dirX, dirZ),
					CreatedAt:        time.Now(),
					Scale:            1.0,
					ProjectilePierce: shouldPierce, // Blade Tornado combo effect
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 18*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	}
}
