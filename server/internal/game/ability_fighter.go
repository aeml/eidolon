package game

import (
	"math"
	"time"
)

// performFighterAbility handles all Fighter class ability logic.
// Extracted from the "Fighter" case in PerformAbility (world.go).
func (w *World) performFighterAbility(player *Entity, targetX, targetZ float64, targetID, skillName string, setCooldown func(time.Duration)) {
	if skillName == "Charge" {
		// Charge
		cost := resolveAbilityManaCost(player, skillName, 20)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Charge")
			player.ChargeRuneID = runeID
			player.ChargeStartX = player.X
			player.ChargeStartZ = player.Z

			// Momentum rune: +50% range
			finalTargetX, finalTargetZ := clampAbilityTargetDistance(player, targetX, targetZ, 28.0)
			if runeID == "charge_momentum" {
				// Extend range by 50%
				dx := finalTargetX - player.X
				dz := finalTargetZ - player.Z
				finalTargetX = player.X + dx*1.5
				finalTargetZ = player.Z + dz*1.5
			}

			// Unstoppable rune: CC immune during charge
			if runeID == "charge_unstoppable" {
				player.CCImmune = true
				player.CCImmuneEndTime = time.Now().Add(10 * time.Second) // Will be cleared on charge end
			}

			if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(player, finalTargetX, finalTargetZ); ok {
				finalTargetX = constrainedX
				finalTargetZ = constrainedZ
			}

			player.IsCharging = true
			player.ChargeSkillName = skillName
			player.ChargeTargetX = finalTargetX
			player.ChargeTargetZ = finalTargetZ
			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 5*time.Second))
			// Charge uses finalTargetX/Z for the ability event (momentum rune extends range)
			w.fireAbilityEvent(player.ID, targetID, skillName, finalTargetX, finalTargetZ)
		}
	} else if skillName == "Whirlwind" {
		// Whirlwind
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Whirlwind")

			// AoE Damage around player with talent bonus
			radius := 6.0
			effectiveRadius := expandedAbilityRadius(skillName, radius)
			damage := int((float64(player.Damage)*0.8 + float64(player.Stats.Strength)*2) * 1.3 * player.GetSkillDamageMultiplier("Whirlwind"))

			// Extended rune: -50% damage
			if runeID == "whirlwind_extended" {
				damage = damage / 2
			}

			// Combo: Momentum Strike (Charge → Whirlwind) = +50% damage
			if player.ActiveCombo == "whirlwind_damage_boost" {
				damage = int(float64(damage) * 1.5)
				player.ActiveCombo = "" // Consume the combo
			}

			hitCount := 0
			nearby := w.Grid.Nearby(player.X, player.Z, effectiveRadius, player.InstanceID)
			for _, target := range nearby {
				// Skip self
				if target.ID == player.ID {
					continue
				}

				target.Mu.RLock()
				if !w.CanDamage(player, target) || target.State == "DEAD" {
					target.Mu.RUnlock()
					continue
				}
				// Distance check
				dx := player.X - target.X
				dz := player.Z - target.Z
				tx, tz := target.X, target.Z
				target.Mu.RUnlock()

				distSq := dx*dx + dz*dz
				if withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.Mu.Lock()
					finalDamage := applyFinalDamage(player, target, damage, "physical")
					addThreatLocked(target, player.ID, float64(finalDamage))
					isDead := target.Health <= 0

					// Bladestorm rune: pull enemies toward player
					if runeID == "whirlwind_bladestorm" && !isDead && !target.CCImmune && !target.IronFortressImmovable {
						dist := math.Sqrt(distSq)
						if dist > 1.0 {
							pullDist := 2.0 // Pull 2 units toward player
							pullDx := (player.X - tx) / dist * pullDist
							pullDz := (player.Z - tz) / dist * pullDist
							oldTX, oldTZ := target.X, target.Z
							target.X += pullDx
							target.Z += pullDz
							if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(target, target.X, target.Z); ok {
								target.X = constrainedX
								target.Z = constrainedZ
							}
							w.Grid.Update(target, oldTX, oldTZ)
						}
					}
					target.Mu.Unlock()

					hitCount++

					w.fireDamageEvent(player.ID, target.ID, finalDamage, "physical", player.InstanceID)

					if isDead {
						target.Mu.Lock()
						w.handleDeath(target, player, nil)
						target.Mu.Unlock()
					}
				}
			}
			if runeID == "whirlwind_bloodwhirl" && hitCount > 0 {
				healAmount := applyHealingReceived(player, player.MaxHealth*2*hitCount/100)
				if healAmount > 0 {
					previousHealth := player.Health
					player.Health += healAmount
					if player.Health > player.MaxHealth {
						player.Health = player.MaxHealth
					}
					if actualHeal := player.Health - previousHealth; actualHeal > 0 {
						w.fireHealEvent(player.ID, player.ID, actualHeal, "self_restore", player.InstanceID)
					}
				}
			}
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Shield Slam" {
		cost := resolveAbilityManaCost(player, skillName, 25)
		if player.Mana >= cost {
			player.Mana -= cost
			runeID := player.GetRuneForSkill(skillName)
			damage := player.Damage + int(float64(player.Stats.Strength)*1.5)
			if runeID == "shieldslam_reverberation" {
				damage *= 2
			}
			stunDuration := 1500 * time.Millisecond
			if runeID == "shieldslam_concussion" {
				stunDuration += time.Second
			}
			totalDamage := w.damageFighterCone(player, targetX, targetZ, 4.0, math.Pi/4, damage, stunDuration, 1.0)
			if runeID == "shieldslam_fortify" && totalDamage > 0 {
				// The combat pipeline already provides a replicated absorb shield.
				player.ArcaneShieldActive = true
				player.ArcaneShieldHP += totalDamage
				player.ArcaneShieldEndTime = time.Now().Add(10 * time.Second)
				player.ArcaneShieldRuneID = ""
			}
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 6*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Shattering Charge" {
		// Shattering Charge (Movement)
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost
			finalTargetX, finalTargetZ := clampAbilityTargetDistance(player, targetX, targetZ, 28.0)
			if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(player, finalTargetX, finalTargetZ); ok {
				finalTargetX = constrainedX
				finalTargetZ = constrainedZ
			}
			player.IsCharging = true
			player.ChargeSkillName = skillName
			player.ChargeStartX = player.X
			player.ChargeStartZ = player.Z
			player.ChargeTargetX = finalTargetX
			player.ChargeTargetZ = finalTargetZ
			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 12*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, finalTargetX, finalTargetZ)
		}
	} else if skillName == "Executioner Spin" {
		// Executioner Spin
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost

			radius := 6.0
			effectiveRadius := expandedAbilityRadius(skillName, radius)
			damage := int((float64(player.Damage)*1.0 + float64(player.Stats.Strength)*3) * 1.3 * player.GetSkillDamageMultiplier("Executioner Spin"))

			nearby := w.Grid.Nearby(player.X, player.Z, effectiveRadius, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}

				target.Mu.RLock()
				if !w.CanDamage(player, target) || target.State == "DEAD" {
					target.Mu.RUnlock()
					continue
				}
				target.Mu.RUnlock()

				if withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.Mu.Lock()
					modifiedDamage := damage
					if target.WeakPointMarked || target.MarkWeakness || target.Threat[player.ID] > 0 {
						modifiedDamage = int(float64(modifiedDamage) * 1.5)
					}
					finalDamage := applyFinalDamage(player, target, modifiedDamage, "physical")
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

			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 15*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Iron Fortress" {
		// Iron Fortress (Buff)
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost

			// Check for rune effects
			runeID := player.GetRuneForSkill("Iron Fortress")

			// Extended rune: +50% duration (30s -> 45s)
			duration := 30 * time.Second
			if runeID == "ironfortress_extended" {
				duration = 45 * time.Second
			}

			player.IronFortressActive = true
			player.IronFortressEndTime = time.Now().Add(duration)
			player.IronFortressRuneID = runeID

			// Thorns rune: reflect 20% damage while active
			if runeID == "ironfortress_thorns" {
				player.IronFortressThorns = true
			} else {
				player.IronFortressThorns = false
			}

			// Immovable rune: cannot be knocked back or pulled
			if runeID == "ironfortress_immovable" {
				player.IronFortressImmovable = true
			} else {
				player.IronFortressImmovable = false
			}
			player.RecalculateStats()

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 60*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Guardian Roar" {
		// Guardian Roar (AoE Taunt + Buff)
		cost := resolveAbilityManaCost(player, skillName, 35)
		if player.Mana >= cost {
			player.Mana -= cost

			// Combo: Guardian Combo (Shield Slam → Guardian Roar) = +50% buff/taunt duration
			buffDuration := 10 * time.Second
			if player.ActiveCombo == "guardian_roar_extended" {
				buffDuration = 15 * time.Second // +50% duration
				player.ActiveCombo = ""         // Consume the combo
			}

			player.GuardianRoarActive = true
			player.GuardianRoarEndTime = time.Now().Add(buffDuration)
			canTauntBosses := player.HasAnySetBonus("bossTaunt")

			// Taunt Logic
			radius := 15.0
			nearby := w.Grid.Nearby(player.X, player.Z, expandedAbilityRadius(skillName, radius), player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}
				target.Mu.Lock()
				if w.CanDamage(player, target) && target.State != "DEAD" && withinAbilityRadius(skillName, player.X, player.Z, target, radius) && (target.Scale < 4.0 || canTauntBosses) {
					// Taunt: set fighter to highest threat + 10% for this enemy.
					tauntThreatLocked(target, player.ID)
				} else if (target.Type == TypePlayer || target.Type == TypeNPC) && w.CombatRelationship(player, target) != RelationshipHostile && target.State != "DEAD" && withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.GuardianRoarActive = true
					target.GuardianRoarEndTime = player.GuardianRoarEndTime
					target.RecalculateStats()
				}
				target.Mu.Unlock()
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 30*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Sweeping Strike" {
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost
			damage := player.Damage + int(float64(player.Stats.Strength)*1.2)
			w.damageFighterCone(player, targetX, targetZ, 5.0, math.Pi/2, damage, 0, 2.0)
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 4*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Earthshaker" {
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost
			runeID := player.GetRuneForSkill(skillName)
			damage := player.Damage + player.Stats.Strength*2
			stunDuration := 2 * time.Second
			if runeID == "earthshaker_seismic" {
				stunDuration *= 2
			}
			w.damageEarthshakerArea(player, player.X, player.Z, targetX, targetZ, 6.0, damage, stunDuration, runeID == "earthshaker_fissure")
			if runeID == "earthshaker_aftershock" {
				playerID := player.ID
				instanceID := player.InstanceID
				x, z := player.X, player.Z
				go func() {
					time.Sleep(time.Second)
					w.Mu.Lock()
					defer w.Mu.Unlock()
					owner := w.Entities[playerID]
					if owner == nil || owner.State == "DEAD" || owner.InstanceID != instanceID {
						return
					}
					w.damageEarthshakerArea(owner, x, z, targetX, targetZ, 3.5, damage/2, time.Second, false)
				}()
			}
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 12*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Unbreakable Grip" {
		if target := w.findFighterGripTarget(player, targetX, targetZ, targetID); target != nil {
			cost := resolveAbilityManaCost(player, skillName, 35)
			if player.Mana >= cost {
				player.Mana -= cost
				target.Mu.Lock()
				dx := target.X - player.X
				dz := target.Z - player.Z
				dist := math.Sqrt(dx*dx + dz*dz)
				if dist > 0 && !target.IronFortressImmovable && !target.CCImmune {
					oldX, oldZ := target.X, target.Z
					target.X = player.X + dx/dist*2.0
					target.Z = player.Z + dz/dist*2.0
					if constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(target, target.X, target.Z); ok {
						target.X, target.Z = constrainedX, constrainedZ
					}
					w.Grid.Update(target, oldX, oldZ)
				}
				if !target.CCImmune {
					target.Rooted = true
					target.RootEndTime = time.Now().Add(time.Second)
				}
				target.Mu.Unlock()
				setCooldown(resolveAbilityCooldown(player.SubType, skillName, 15*time.Second))
				w.fireAbilityEvent(player.ID, target.ID, skillName, targetX, targetZ)
			}
		}
	} else if skillName == "Juggernaut Charge" {
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost
			radius := 10.0
			damage := player.Damage + player.Stats.Strength
			nearby := w.Grid.Nearby(player.X, player.Z, expandedAbilityRadius(skillName, radius), player.InstanceID)
			for _, target := range nearby {
				target.Mu.Lock()
				if !w.CanDamage(player, target) || target.State == "DEAD" || !withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.Mu.Unlock()
					continue
				}
				finalDamage := applyFinalDamage(player, target, damage, "physical")
				addThreatLocked(target, player.ID, float64(finalDamage))
				target.Slowed = true
				target.SlowFactor = 0.6
				target.SlowEndTime = time.Now().Add(5 * time.Second)
				target.RecalculateStats()
				isDead := target.Health <= 0
				target.Mu.Unlock()
				w.fireDamageEvent(player.ID, target.ID, finalDamage, "physical", player.InstanceID)
				if isDead {
					target.Mu.Lock()
					w.handleDeath(target, player, nil)
					target.Mu.Unlock()
				}
			}
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Berserker Edge" {
		// Berserker Edge (Buff)
		cost := resolveAbilityManaCost(player, skillName, 0)
		if player.Mana >= cost {
			player.Mana -= cost
			player.BerserkerModeActive = true
			player.BerserkerModeEndTime = time.Now().Add(15 * time.Second)
			player.RecalculateStats()

			// Apply to party
			if player.PartyID != "" {
				// PerformAbility already owns w.Mu. Calling GetParty/GetEntity here
				// attempts to recursively RLock the same RWMutex and freezes the world.
				party := w.Parties[player.PartyID]
				if party != nil {
					_, _, members := party.GetSnapshot()
					for _, mid := range members {
						if mid == player.ID {
							continue
						}
						member := w.Entities[mid]
						if member != nil {
							member.Mu.Lock()
							dx := member.X - player.X
							dz := member.Z - player.Z
							if member.InstanceID == player.InstanceID && member.State != "DEAD" && math.Hypot(dx, dz) <= 15.0+entityVisualRadius(member) {
								member.BerserkerModeActive = true
								member.BerserkerModeEndTime = time.Now().Add(15 * time.Second)
								member.RecalculateStats()
							}
							member.Mu.Unlock()
						}
					}
				}
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 45*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}

	} else if skillName == "Last Stand Rampage" {
		// Last Stand (Buff) - Requires < 30% HP
		hpPercent := float64(player.Health) / float64(player.MaxHealth)
		if hpPercent < 0.30 {
			player.LastStandActive = true
			player.LastStandEndTime = time.Now().Add(10 * time.Second)
			player.RecalculateStats()

			// Combo: Iron Will (Iron Fortress → Last Stand Rampage) = Damage reduction persists
			if player.ActiveCombo == "rampage_damage_reduction" {
				// Extend Iron Fortress to match Last Stand duration
				if player.IronFortressActive {
					player.IronFortressEndTime = player.LastStandEndTime
				} else {
					// Reactivate Iron Fortress if it just expired
					player.IronFortressActive = true
					player.IronFortressEndTime = player.LastStandEndTime
				}
				player.ActiveCombo = "" // Consume combo
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 120*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	}
}

func clampAbilityTargetDistance(player *Entity, targetX, targetZ, maxDistance float64) (float64, float64) {
	if player == nil || maxDistance <= 0 {
		return targetX, targetZ
	}
	dx := targetX - player.X
	dz := targetZ - player.Z
	distance := math.Hypot(dx, dz)
	if distance <= maxDistance || distance == 0 {
		return targetX, targetZ
	}
	scale := maxDistance / distance
	return player.X + dx*scale, player.Z + dz*scale
}

func fighterFacing(player *Entity, targetX, targetZ float64) (float64, float64) {
	dx := targetX - player.X
	dz := targetZ - player.Z
	dist := math.Sqrt(dx*dx + dz*dz)
	if dist > 0.001 {
		return dx / dist, dz / dist
	}
	return math.Sin(player.Rotation), math.Cos(player.Rotation)
}

func (w *World) damageFighterCone(player *Entity, targetX, targetZ, radius, halfAngle float64, damage int, stun time.Duration, threatMultiplier float64) int {
	facingX, facingZ := fighterFacing(player, targetX, targetZ)
	totalDamage := 0
	nearby := w.Grid.Nearby(player.X, player.Z, expandedAbilityRadius("", radius), player.InstanceID)
	for _, target := range nearby {
		target.Mu.Lock()
		if !w.CanDamage(player, target) || target.State == "DEAD" {
			target.Mu.Unlock()
			continue
		}
		dx := target.X - player.X
		dz := target.Z - player.Z
		dist := math.Sqrt(dx*dx + dz*dz)
		if dist <= 0 || dist > radius+entityVisualRadius(target) || facingX*(dx/dist)+facingZ*(dz/dist) < math.Cos(halfAngle) {
			target.Mu.Unlock()
			continue
		}
		finalDamage := applyFinalDamage(player, target, damage, "physical")
		totalDamage += finalDamage
		addThreatLocked(target, player.ID, float64(finalDamage)*threatMultiplier)
		if stun > 0 && !target.CCImmune {
			target.Stunned = true
			target.StunEndTime = time.Now().Add(stun)
		}
		isDead := target.Health <= 0
		target.Mu.Unlock()
		w.fireDamageEvent(player.ID, target.ID, finalDamage, "physical", player.InstanceID)
		if isDead {
			target.Mu.Lock()
			w.handleDeath(target, player, nil)
			target.Mu.Unlock()
		}
	}
	return totalDamage
}

func (w *World) damageEarthshakerArea(player *Entity, originX, originZ, targetX, targetZ, radius float64, damage int, stun time.Duration, line bool) {
	facingX, facingZ := fighterFacing(player, targetX, targetZ)
	nearby := w.Grid.Nearby(originX, originZ, expandedAbilityRadius("Earthshaker", radius), player.InstanceID)
	for _, target := range nearby {
		target.Mu.Lock()
		if !w.CanDamage(player, target) || target.State == "DEAD" {
			target.Mu.Unlock()
			continue
		}
		dx := target.X - originX
		dz := target.Z - originZ
		hit := withinAbilityRadius("Earthshaker", originX, originZ, target, radius)
		if line {
			forward := dx*facingX + dz*facingZ
			lateral := math.Abs(dx*facingZ - dz*facingX)
			hit = forward >= 0 && forward <= radius+entityVisualRadius(target) && lateral <= 1.5+entityVisualRadius(target)
		}
		if !hit {
			target.Mu.Unlock()
			continue
		}
		finalDamage := applyFinalDamage(player, target, damage, "physical")
		addThreatLocked(target, player.ID, float64(finalDamage))
		if !target.CCImmune {
			target.Stunned = true
			target.StunEndTime = time.Now().Add(stun)
		}
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

func (w *World) findFighterGripTarget(player *Entity, targetX, targetZ float64, targetID string) *Entity {
	maxRange := 10.0
	valid := func(target *Entity) bool {
		if target == nil {
			return false
		}
		target.Mu.RLock()
		defer target.Mu.RUnlock()
		if !w.CanDamage(player, target) || target.State == "DEAD" || target.InstanceID != player.InstanceID {
			return false
		}
		dx := target.X - player.X
		dz := target.Z - player.Z
		return dx*dx+dz*dz <= (maxRange+entityVisualRadius(target))*(maxRange+entityVisualRadius(target))
	}
	if targetID != "" && valid(w.Entities[targetID]) {
		return w.Entities[targetID]
	}
	var best *Entity
	bestDistance := 3.0
	for _, target := range w.Grid.Nearby(targetX, targetZ, 3.0+maxAbilityTargetVisualRadius, player.InstanceID) {
		if !valid(target) {
			continue
		}
		target.Mu.RLock()
		distance := math.Hypot(target.X-targetX, target.Z-targetZ)
		target.Mu.RUnlock()
		if distance < bestDistance+entityVisualRadius(target) {
			bestDistance = distance
			best = target
		}
	}
	return best
}
