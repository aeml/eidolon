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
			finalTargetX := targetX
			finalTargetZ := targetZ
			if runeID == "charge_momentum" {
				// Extend range by 50%
				dx := targetX - player.X
				dz := targetZ - player.Z
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
				if target.Type != TypeEnemy || target.State == "DEAD" {
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
					if runeID == "whirlwind_bladestorm" && !isDead {
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

					w.fireDamageEvent(player.ID, target.ID, finalDamage)

					if isDead {
						target.Mu.Lock()
						w.handleDeath(target, player, nil)
						target.Mu.Unlock()
					}
				}
			}
			_ = hitCount // hitCount tracked but not currently used
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Shattering Charge" {
		// Shattering Charge (Movement)
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost
			player.IsCharging = true
			player.ChargeTargetX = targetX
			player.ChargeTargetZ = targetZ
			player.State = "ATTACKING"
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 12*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
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
				if target.Type != TypeEnemy || target.State == "DEAD" {
					target.Mu.RUnlock()
					continue
				}
				target.Mu.RUnlock()

				if withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.Mu.Lock()
					finalDamage := applyFinalDamage(player, target, damage, "physical")
					addThreatLocked(target, player.ID, float64(finalDamage))
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

			// Taunt Logic
			radius := 15.0
			nearby := w.Grid.Nearby(player.X, player.Z, radius, player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}
				target.Mu.Lock()
				if target.Type == TypeEnemy && target.State != "DEAD" {
					// Taunt: set fighter to highest threat + 10% for this enemy.
					tauntThreatLocked(target, player.ID)
				}
				target.Mu.Unlock()
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 30*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Serrated Edges" {
		// Serrated Edges (Buff)
		// NOTE: This skill is misplaced — it's a Rogue skill in the Fighter block.
		// A Rogue player would never reach this code path since the outer switch
		// dispatches on player.SubType. Preserved here for historical fidelity;
		// see also ability_rogue.go for the correct Rogue version if one is added.
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost
			player.SerratedEdgesActive = true
			player.SerratedEdgesEndTime = time.Now().Add(10 * time.Second)
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
				party := w.GetParty(player.PartyID)
				if party != nil {
					_, _, members := party.GetSnapshot()
					for _, mid := range members {
						if mid == player.ID {
							continue
						}
						member := w.GetEntity(mid)
						if member != nil {
							// Check distance
							dx := member.X - player.X
							dz := member.Z - player.Z
							dist := math.Sqrt(dx*dx + dz*dz)
							if dist <= 15.0 {
								member.Mu.Lock()
								member.BerserkerModeActive = true
								member.BerserkerModeEndTime = time.Now().Add(15 * time.Second)
								member.RecalculateStats()
								member.Mu.Unlock()
							}
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
