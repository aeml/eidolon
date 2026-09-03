package game

import (
	"fmt"
	"math"
	"math/rand"
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
			var strikeTarget *Entity
			if targetID != "" {
				if target, ok := w.Entities[targetID]; ok && validDirectAbilityTarget(player, target, 10.0, TypeEnemy) {
					strikeTarget = target
				}
			}
			if strikeTarget == nil {
				minDistance := 3.0
				for _, target := range w.Grid.Nearby(targetX, targetZ, 3.0+maxAbilityTargetVisualRadius, player.InstanceID) {
					if !validDirectAbilityTarget(player, target, 10.0, TypeEnemy) {
						continue
					}
					distance := math.Hypot(target.X-targetX, target.Z-targetZ)
					if distance < minDistance+entityVisualRadius(target) {
						minDistance = distance
						strikeTarget = target
					}
				}
			}

			if strikeTarget != nil {
				player.Mana -= cost
				strikeTarget.Mu.RLock()
				targetX, targetZ = strikeTarget.X, strikeTarget.Z
				targetRotation := strikeTarget.Rotation
				strikeTarget.Mu.RUnlock()
				// Teleport behind the target using its authoritative facing.
				destX := targetX - math.Sin(targetRotation)*1.5
				destZ := targetZ - math.Cos(targetRotation)*1.5

				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(player, destX, destZ); ok {
					destX = constrainedX
					destZ = constrainedZ
				}

				oldX, oldZ := player.X, player.Z
				player.X = destX
				player.Z = destZ
				player.MoveLockUntil = time.Now().Add(AbilityMovementLockDuration)
				w.Grid.Update(player, oldX, oldZ)

				// Deal Damage with talent bonus
				damage := int(float64(player.Damage) * 2.0 * player.GetSkillDamageMultiplier("Shadow Strike"))
				if player.StealthActive {
					damage = int(float64(damage) * 1.5)
					player.StealthActive = false // Break stealth
					player.CloakSwiftSpeedBonus = false
					player.RecalculateStats()
				}

				strikeTarget.Mu.Lock()
				finalDamage := applyFinalDamage(player, strikeTarget, damage, "physical")
				addThreatLocked(strikeTarget, player.ID, float64(finalDamage))
				strikeTarget.Bleeding = true
				strikeTarget.BleedDamage = 10 + (player.Stats.Dexterity / 2)
				strikeTarget.BleedSourceID = player.ID
				strikeTarget.BleedEndTime = time.Now().Add(10 * time.Second)
				isDead := strikeTarget.Health <= 0
				strikeTarget.Mu.Unlock()
				w.fireDamageEvent(player.ID, strikeTarget.ID, finalDamage, "physical", player.InstanceID)
				if isDead {
					strikeTarget.Mu.Lock()
					w.handleDeath(strikeTarget, player, nil)
					strikeTarget.Mu.Unlock()
				}

				setCooldown(resolveAbilityCooldown(player.SubType, skillName, 10*time.Second))
				w.fireAbilityEvent(player.ID, strikeTarget.ID, skillName, targetX, targetZ)
			}
		}
	} else if skillName == "Weak Point Mark" {
		// Weak Point Mark (Debuff)
		cost := resolveAbilityManaCost(player, skillName, 25)
		if player.Mana >= cost {
			player.Mana -= cost

			// Find target near cursor while enforcing the authoritative cast range.
			var bestTarget *Entity
			if targetID != "" {
				if target, ok := w.Entities[targetID]; ok && validDirectAbilityTarget(player, target, 10.0, TypeEnemy) {
					bestTarget = target
				}
			}
			minDist := 3.0
			nearby := w.Grid.Nearby(targetX, targetZ, 3.0+maxAbilityTargetVisualRadius, player.InstanceID)
			for _, target := range nearby {
				if bestTarget != nil {
					break
				}
				if target.ID == player.ID {
					continue
				}
				if !validDirectAbilityTarget(player, target, 10.0, TypeEnemy) {
					continue
				}
				target.Mu.RLock()
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
			targetX, targetZ = clampAbilityTargetDistance(player, targetX, targetZ, 12.0)

			// Target area
			radius := 6.0
			effectiveRadius := expandedAbilityRadius(skillName, radius)
			damage := int(float64(20+(player.Stats.Dexterity*2)) * player.GetSkillDamageMultiplier("Rain of Arrows"))

			nearby := w.Grid.Nearby(targetX, targetZ, effectiveRadius, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}
				target.Mu.Lock()
				if target.Type == TypeEnemy && target.State != "DEAD" {
					if withinAbilityRadius(skillName, targetX, targetZ, target, radius) {
						finalDamage := applyFinalDamage(player, target, damage, "physical")
						addThreatLocked(target, player.ID, float64(finalDamage))
						w.fireDamageEvent(player.ID, target.ID, finalDamage, "physical", player.InstanceID)
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

			nearby := w.Grid.Nearby(player.X, player.Z, expandedAbilityRadius(skillName, rangeDist), player.InstanceID)
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
				if d <= rangeDist+entityVisualRadius(target) && d < minDist+entityVisualRadius(target) {
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

					if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(player, teleX, teleZ); ok {
						teleX = constrainedX
						teleZ = constrainedZ
					}

					oldX, oldZ := player.X, player.Z
					player.X = teleX
					player.Z = teleZ
					player.MoveLockUntil = time.Now().Add(AbilityMovementLockDuration)
					player.Rotation = tRot
					w.Grid.Update(player, oldX, oldZ)
				}

				// Check angle for backstab
				bestTarget.Mu.RLock()
				tRot := bestTarget.Rotation
				tDefense := bestTarget.Defense - bestTarget.ArmorReduction
				if tDefense < 0 {
					tDefense = 0
				}
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

				// Ambush rune: a real 50% critical roll, rather than flattening
				// the proc into average damage on every strike.
				if runeID == "backstab_ambush" && rand.Float64() < 0.5 {
					damage *= 2
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
				finalDamage = applyFinalDamage(player, bestTarget, finalDamage, "physical")
				addThreatLocked(bestTarget, player.ID, float64(finalDamage))
				isDead := bestTarget.Health <= 0
				bestTarget.Mu.Unlock()

				w.fireDamageEvent(player.ID, bestTarget.ID, finalDamage, "physical", player.InstanceID)
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
			if targetID != "" {
				if target, ok := w.Entities[targetID]; ok && validDirectAbilityTarget(player, target, maxRange, TypeEnemy) {
					bestTarget = target
				}
			}
			minDist := maxRange

			nearby := w.Grid.Nearby(targetX, targetZ, 3.0+maxAbilityTargetVisualRadius, player.InstanceID)
			for _, target := range nearby {
				if bestTarget != nil {
					break
				}
				if target.ID == player.ID {
					continue
				}
				if !validDirectAbilityTarget(player, target, maxRange, TypeEnemy) {
					continue
				}
				target.Mu.RLock()
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

				if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(player, teleX, teleZ); ok {
					teleX = constrainedX
					teleZ = constrainedZ
				}

				oldX, oldZ := player.X, player.Z
				player.X = teleX
				player.Z = teleZ
				player.MoveLockUntil = time.Now().Add(AbilityMovementLockDuration)
				player.Rotation = tRot
				w.Grid.Update(player, oldX, oldZ)

				// Cripple rune: slow target by 50% for 3s
				if runeID == "shadowlunge_cripple" {
					bestTarget.Mu.Lock()
					if !bestTarget.CCImmune {
						bestTarget.Slowed = true
						bestTarget.SlowFactor = 0.50
						bestTarget.SlowEndTime = time.Now().Add(3 * time.Second)
						bestTarget.RecalculateStats()
					}
					bestTarget.Mu.Unlock()
				}

				// Shadow Clone rune: create illusion that attacks once
				if runeID == "shadowlunge_shadow" {
					// Create a temporary "illusion" that deals one attack worth of damage
					cloneDamage := player.Damage
					bestTarget.Mu.Lock()
					cloneDamage = applyFinalDamage(player, bestTarget, cloneDamage, "physical")
					addThreatLocked(bestTarget, player.ID, float64(cloneDamage))
					isDead := bestTarget.Health <= 0
					bestTarget.Mu.Unlock()

					w.fireDamageEvent(player.ID, bestTarget.ID, cloneDamage, "physical", player.InstanceID)
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
					ID:              fmt.Sprintf("proj-%s-%d-%d", player.ID, time.Now().UnixNano(), i),
					InstanceID:      player.InstanceID,
					Type:            TypeProjectile,
					SubType:         "Dagger",
					X:               player.X,
					Y:               1.0,
					Z:               player.Z,
					VelX:            velX,
					VelZ:            velZ,
					Radius:          1.0,
					Damage:          damage,
					OwnerID:         player.ID,
					Rotation:        angle,
					CreatedAt:       time.Now(),
					Scale:           1.0,
					ProjectileSkill: "Blade Storm",
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 15*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Serrated Edges" {
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost
			player.SerratedEdgesActive = true
			player.SerratedEdgesEndTime = time.Now().Add(10 * time.Second)
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Death Spiral" {
		// AoE
		cost := resolveAbilityManaCost(player, skillName, 35)
		if player.Mana >= cost {
			player.Mana -= cost

			radius := 4.0
			effectiveRadius := expandedAbilityRadius(skillName, radius)
			damage := int(float64(player.Damage*2) * player.GetSkillDamageMultiplier("Death Spiral"))

			// Combo: Venom Burst (Poison Coating → Death Spiral) = +100% poison damage
			venomBurstActive := player.ActiveCombo == "death_spiral_poison_boost"
			if venomBurstActive {
				player.ActiveCombo = "" // Consume combo
			}

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
				isPoisoned := target.Poisoned
				target.Mu.RUnlock()

				if withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.Mu.Lock()
					// Calculate final damage
					finalDamage := damage
					// Venom Burst: +100% damage to poisoned targets
					if venomBurstActive && isPoisoned {
						finalDamage = damage * 2
					}
					if player.HasAnySetBonus("deathSpiralConsume") {
						now := time.Now()
						if target.Bleeding && now.Before(target.BleedEndTime) {
							remainingTicks := int(math.Ceil(time.Until(target.BleedEndTime).Seconds()))
							finalDamage += target.BleedDamage * remainingTicks
							target.Bleeding = false
						}
						if target.Poisoned && now.Before(target.PoisonEndTime) {
							remainingTicks := int(math.Ceil(time.Until(target.PoisonEndTime).Seconds()))
							finalDamage += target.PoisonDamage * remainingTicks
							target.Poisoned = false
						}
					} else if target.Bleeding {
						// The authoritative model stores one bleed stack. Consume it for
						// the same Dexterity-scaled finisher bonus as the offline client.
						finalDamage += player.Stats.Dexterity / 2
						target.Bleeding = false
						target.BleedDamage = 0
						target.BleedSourceID = ""
					}
					finalDamage = applyFinalDamage(player, target, finalDamage, "physical")
					addThreatLocked(target, player.ID, float64(finalDamage))
					isDead := target.Health <= 0
					target.Mu.Unlock()

					w.fireDamageEvent(player.ID, target.ID, finalDamage, "physical", player.InstanceID)
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
			player.CloakBurstSpeedBonus = true
			player.CloakBurstSpeedEndTime = time.Now().Add(3 * time.Second)

			// Swift rune: +30% movement speed while invisible
			if runeID == "cloak_swift" {
				player.CloakSwiftSpeedBonus = true
			} else {
				player.CloakSwiftSpeedBonus = false
			}

			// Prepared Ambush rune: next attack deals +100% damage
			if runeID == "cloak_ambush" {
				player.CloakNextAttackBonus = 1.0 // 100% bonus
			} else {
				player.CloakNextAttackBonus = 0
			}
			player.RecalculateStats()

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 30*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Smoke Bomb" {
		// Smoke Bomb (AoE Slow)
		cost := resolveAbilityManaCost(player, skillName, 35)

		// Combo: Shadow Dance (Shadow Lunge → Smoke Bomb) = Instant cast (no cooldown, reduced mana)
		shadowDanceActive := player.ActiveCombo == "smoke_bomb_instant"
		if shadowDanceActive {
			cost = cost / 2 // Half mana cost
		}

		if player.Mana >= cost {
			player.Mana -= cost

			radius := 5.0
			effectiveRadius := expandedAbilityRadius(skillName, radius)
			nearby := w.Grid.Nearby(player.X, player.Z, effectiveRadius, player.InstanceID)
			for _, target := range nearby {
				target.Mu.Lock()
				if target.Type == TypeEnemy && target.State != "DEAD" && withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					if !target.CCImmune {
						target.Slowed = true
						target.SlowFactor = 0.5
						target.SlowEndTime = time.Now().Add(5 * time.Second)
						target.RecalculateStats()
					}
					target.AccuracyReduction = 0.30
					target.AccuracyReductionEndTime = time.Now().Add(5 * time.Second)
				}
				target.Mu.Unlock()
			}

			// Shadow Dance combo: no cooldown
			if shadowDanceActive {
				player.ActiveCombo = "" // Consume combo after the cast succeeds.
				setCooldown(0)
			} else {
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

			// Fire 3 projectiles in a line with spacing to simulate rapid fire.
			projectileCount := 3
			if player.HasAnySetBonus("phantomVolleyDouble") {
				projectileCount = 6
			}
			for i := 0; i < projectileCount; i++ {
				proj := &Entity{
					ID:                       fmt.Sprintf("proj-phantom-%d-%d", time.Now().UnixNano(), i),
					InstanceID:               player.InstanceID,
					Type:                     TypeProjectile,
					SubType:                  "PhantomArrow",
					X:                        player.X,
					Y:                        1.0,
					Z:                        player.Z,
					VelX:                     dirX * 35.0,
					VelZ:                     dirZ * 35.0,
					Radius:                   0.5,
					Damage:                   int(float64(25+(player.Stats.Dexterity*2)) * player.GetSkillDamageMultiplier("Phantom Volley")),
					OwnerID:                  player.ID,
					Rotation:                 math.Atan2(dirX, dirZ),
					CreatedAt:                time.Now(),
					Scale:                    1.0,
					ProjectileSkill:          "Phantom Volley",
					ProjectileActivationTime: time.Now().Add(time.Duration(i) * 150 * time.Millisecond),
					ProjectilePierce:         shouldPierce, // Blade Tornado combo effect
				}
				w.Entities[proj.ID] = proj
				w.Grid.Add(proj)
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 18*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	}
}
