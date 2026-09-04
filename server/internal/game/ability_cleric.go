package game

import (
	"fmt"
	"math"
	"time"
)

// performClericAbility handles all Cleric class ability logic.
// Extracted from the "Cleric" case in PerformAbility (world.go).
func (w *World) performClericAbility(player *Entity, targetX, targetZ float64, targetID, skillName string, setCooldown func(time.Duration)) {
	if skillName == "Divine Intervention" {
		// Divine Intervention (Buff/Heal)
		cost := resolveAbilityManaCost(player, skillName, 60)
		if player.Mana >= cost {
			player.Mana -= cost

			// Divine Intervention Rune Effects
			runeID := player.GetRuneForSkill("Divine Intervention")
			const castRange = 15.0
			var primaryTarget *Entity
			if targetID != "" {
				if target, ok := w.Entities[targetID]; ok && validDirectAbilityTarget(w, player, target, castRange, TypePlayer, TypeNPC) {
					primaryTarget = target
				}
			}
			if primaryTarget == nil {
				minDist := 3.0 + maxAbilityTargetVisualRadius
				for _, target := range w.Grid.Nearby(targetX, targetZ, minDist, player.InstanceID) {
					if !validDirectAbilityTarget(w, player, target, castRange, TypePlayer, TypeNPC) {
						continue
					}
					distance := math.Hypot(target.X-targetX, target.Z-targetZ)
					if distance < minDist {
						minDist = distance
						primaryTarget = target
					}
				}
			}
			if primaryTarget == nil {
				primaryTarget = player
			}

			protectionEnd := time.Now().Add(10 * time.Second)
			applyIntervention := func(target *Entity) int {
				target.DivineInterventionActive = true
				target.DivineInterventionEndTime = protectionEnd
				heal := applyHealingReceived(target, applyHealingDoneBonus(player, target.MaxHealth/2))
				previousHealth := target.Health
				target.Health += heal
				if target.Health > target.MaxHealth {
					target.Health = target.MaxHealth
				}
				if runeID == "divineintervention_guardian" {
					target.DivineInterventionGuardian = true
					target.DivineInterventionGuardTime = time.Now().Add(5 * time.Second)
				}
				return target.Health - previousHealth
			}

			primaryHeal := 0
			if primaryTarget == player {
				primaryHeal = applyIntervention(primaryTarget)
			} else {
				primaryTarget.Mu.Lock()
				primaryHeal = applyIntervention(primaryTarget)
				primaryTarget.Mu.Unlock()
			}
			if primaryHeal > 0 {
				w.fireHealEvent(player.ID, primaryTarget.ID, primaryHeal, "holy", player.InstanceID)
			}

			// divineintervention_miracle: Can affect 2 targets (protect nearest ally too)
			if runeID == "divineintervention_miracle" {
				minDist := castRange
				var nearestAlly *Entity
				nearby := w.Grid.Nearby(player.X, player.Z, castRange, player.InstanceID)
				for _, t := range nearby {
					if t.ID == primaryTarget.ID || !validDirectAbilityTarget(w, player, t, castRange, TypePlayer, TypeNPC) {
						continue
					}
					d := math.Hypot(t.X-player.X, t.Z-player.Z)
					if d < minDist {
						minDist = d
						nearestAlly = t
					}
				}
				if nearestAlly != nil {
					nearestAlly.Mu.Lock()
					allyHeal := applyIntervention(nearestAlly)
					nearestAlly.Mu.Unlock()
					if allyHeal > 0 {
						w.fireHealEvent(player.ID, nearestAlly.ID, allyHeal, "holy", player.InstanceID)
					}
				}
			}

			// divineintervention_quick: Cooldown reduced by 50%
			baseCooldown := resolveAbilityCooldown(player.SubType, skillName, 120*time.Second)
			if player.HasAnySetBonus("divineInterventionCD") && baseCooldown > 60*time.Second {
				baseCooldown = 60 * time.Second
			}
			if runeID == "divineintervention_quick" {
				setCooldown(baseCooldown / 2)
			} else {
				setCooldown(baseCooldown)
			}
			w.fireAbilityEvent(player.ID, primaryTarget.ID, skillName, primaryTarget.X, primaryTarget.Z)
		}
	} else if skillName == "Guardian Embrace" {
		// Guardian Embrace (HoT Aura)
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost
			player.GuardianEmbraceActive = true
			player.GuardianEmbraceEndTime = time.Now().Add(10 * time.Second)

			// Combo: Sanctuary (Consecrated Ground → Guardian Embrace) = Damage immunity
			if player.ActiveCombo == "ground_damage_immunity" {
				// Grant brief damage immunity (3s)
				player.InvulnerableEndTime = time.Now().Add(3 * time.Second)
				player.ActiveCombo = "" // Consume combo
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 30*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Purifying Wave" {
		// Purifying Wave (AoE Cleanse)
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost

			radius := 8.0
			nearby := w.Grid.Nearby(player.X, player.Z, expandedAbilityRadius(skillName, radius), player.InstanceID)
			for _, target := range nearby {
				if (target.Type == TypePlayer || target.Type == TypeNPC) && w.CombatRelationship(player, target) != RelationshipHostile && withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.Mu.Lock()
					// Cleanse Debuffs
					target.Bleeding = false
					target.BleedDamage = 0
					target.BleedSourceID = ""
					target.BleedEndTime = time.Time{}
					target.Poisoned = false
					target.PoisonDamage = 0
					target.PoisonSourceID = ""
					target.PoisonEndTime = time.Time{}
					target.Slowed = false
					target.SlowFactor = 0
					target.SlowEndTime = time.Time{}
					target.Stunned = false
					target.StunEndTime = time.Time{}
					target.Rooted = false
					target.RootEndTime = time.Time{}
					target.WeakPointMarked = false
					target.WeakPointEndTime = time.Time{}
					target.MarkWeakness = false
					target.MarkWeaknessEndTime = time.Time{}
					target.MarkWeaknessFactor = 0
					target.RecalculateStats()
					target.Mu.Unlock()
				}
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 12*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Spirit Guardians Boost" {
		// Spirit Guardians Boost (Buff)
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost
			player.SpiritsActive = true
			player.SpiritsBoosted = true
			// Boost is also a standalone activation, so capture the selected
			// Spirit Guardians rune instead of depending on an earlier base cast.
			player.SpiritGuardiansRuneID = player.GetRuneForSkill("Spirit Guardians")
			player.SpiritEndTime = time.Now().Add(consumePersistentDuration(player, 10*time.Second))
			// Boost logic would be in updateEntity where spirits do damage
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Avenging Seraph" {
		// Avenging Seraph (Summon)
		cost := resolveAbilityManaCost(player, skillName, 60)
		if player.Mana >= cost {
			player.Mana -= cost

			// Summon Entity
			seraph := &Entity{
				ID:         fmt.Sprintf("summon-seraph-%d", time.Now().UnixNano()),
				InstanceID: player.InstanceID, // Inherit instance from owner
				Type:       TypeNPC,           // Or specialized summon type
				SubType:    "AvengingSeraph",
				X:          player.X,
				Y:          0,
				Z:          player.Z,
				OwnerID:    player.ID,
				Health:     500 + (player.Stats.Wisdom * 10),
				MaxHealth:  500 + (player.Stats.Wisdom * 10),
				Damage:     50 + (player.Stats.Wisdom * 2),
				State:      "IDLE",
				CreatedAt:  time.Now(),
			}
			// Direct entity add (PerformAbility already holds w.Mu)
			w.Entities[seraph.ID] = seraph
			w.Grid.Add(seraph)

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 45*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Smite" {
		// Smite (Damage + Stun)
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost

			damage := int(float64(30+(player.Stats.Wisdom*2)) * player.GetSkillDamageMultiplier("Smite"))

			// Single Target
			var target *Entity
			if targetID != "" {
				if t, ok := w.Entities[targetID]; ok && validDirectAbilityTarget(w, player, t, 4.0, TypeEnemy) {
					target = t
				}
			}
			if target == nil {
				// Find closest enemy
				minDist := 3.0
				nearby := w.Grid.Nearby(targetX, targetZ, 3.0+maxAbilityTargetVisualRadius, player.InstanceID)
				for _, t := range nearby {
					if validDirectAbilityTarget(w, player, t, 4.0, TypeEnemy) {
						dx := t.X - targetX
						dz := t.Z - targetZ
						d := math.Sqrt(dx*dx + dz*dz)
						if d < minDist {
							minDist = d
							target = t
						}
					}
				}
			}

			if target != nil {
				target.Mu.Lock()
				finalDamage := applyFinalDamage(player, target, damage, "holy")
				addThreatLocked(target, player.ID, float64(finalDamage))
				if !target.CCImmune {
					target.Stunned = true
					target.StunEndTime = time.Now().Add(2 * time.Second)
				}

				w.fireDamageEvent(player.ID, target.ID, finalDamage, "holy", player.InstanceID)
				if target.Health <= 0 {
					w.handleDeath(target, player, nil)
				}
				target.Mu.Unlock()
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 12*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Blessing of Resolve" {
		// Blessing of Resolve (Party Buff)
		cost := resolveAbilityManaCost(player, skillName, 35)
		if player.Mana >= cost {
			player.Mana -= cost
			endTime := time.Now().Add(20 * time.Second)
			radius := 10.0
			for _, target := range w.Grid.Nearby(player.X, player.Z, expandedAbilityRadius(skillName, radius), player.InstanceID) {
				target.Mu.Lock()
				if (target.Type == TypePlayer || target.Type == TypeNPC) && w.CombatRelationship(player, target) != RelationshipHostile && target.State != "DEAD" && withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.BlessingResolveActive = true
					target.BlessingResolveEndTime = endTime
					target.RecalculateStats()
				}
				target.Mu.Unlock()
			}
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 45*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Spirit Guardians" {
		// Guardian Spirits
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost
			player.SpiritsActive = true
			player.SpiritsBoosted = false
			player.SpiritEndTime = time.Now().Add(consumePersistentDuration(player, 8*time.Second))
			player.State = "ATTACKING"

			// Spirit Guardians Rune Effects
			runeID := player.GetRuneForSkill("Spirit Guardians")
			player.SpiritGuardiansRuneID = runeID

			// Combo: Divine Storm (Heaven's Trumpet → Spirit Guardians) = +50% holy damage bonus
			if player.ActiveCombo == "spirits_holy_damage" {
				player.SpiritsBoosted = true // Repurpose SpiritsBoosted for combo bonus
				player.ActiveCombo = ""      // Consume combo
			}

			// spirits_sanctuary: Also reduces damage taken by 20%
			if runeID == "spirits_sanctuary" {
				player.SanctuaryDamageReduction = true
				player.SanctuaryEndTime = player.SpiritEndTime
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 10*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Healing Light" {
		// Same as Heal
		cost := resolveAbilityManaCost(player, skillName, 25)
		if player.Mana >= cost {
			player.Mana -= cost
			healAmount := applyHealingDoneBonus(player, 30+(player.Stats.Wisdom*3))

			// Healing Light Rune Effects
			runeID := player.GetRuneForSkill("Healing Light")

			// Combo: Mass Revival (Divine Intervention → Healing Light) = Party-wide heal
			massRevivalActive := player.ActiveCombo == "healing_light_party"
			if massRevivalActive {
				player.ActiveCombo = "" // Consume combo

				// Heal all allies in large radius around player
				partyRadius := 20.0
				nearby := w.Grid.Nearby(player.X, player.Z, expandedAbilityRadius(skillName, partyRadius), player.InstanceID)
				for _, ally := range nearby {
					if (ally.Type == TypePlayer || ally.Type == TypeNPC) && w.CombatRelationship(player, ally) != RelationshipHostile && withinAbilityRadius(skillName, player.X, player.Z, ally, partyRadius) {
						ally.Mu.Lock()
						if ally.State == "DEAD" {
							ally.Mu.Unlock()
							continue
						}
						previousHealth := ally.Health
						ally.Health += applyHealingReceived(ally, healAmount)
						if ally.Health > ally.MaxHealth {
							ally.Health = ally.MaxHealth
						}
						actualHeal := ally.Health - previousHealth
						ally.Mu.Unlock()
						if actualHeal > 0 {
							w.fireHealEvent(player.ID, ally.ID, actualHeal, "holy", player.InstanceID)
						}
					}
				}

				setCooldown(resolveAbilityCooldown(player.SubType, skillName, 8*time.Second))
				w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
			} else {
				// Normal Healing Light behavior
				var target *Entity
				// Find target near cursor if targetID not set
				if targetID != "" {
					if t, ok := w.Entities[targetID]; ok && validDirectAbilityTarget(w, player, t, 15.0, TypePlayer, TypeNPC) {
						target = t
					}
				}
				if target == nil {
					// Find closest ally
					minDist := 3.0
					nearby := w.Grid.Nearby(targetX, targetZ, 3.0+maxAbilityTargetVisualRadius, player.InstanceID)
					for _, t := range nearby {
						if validDirectAbilityTarget(w, player, t, 15.0, TypePlayer, TypeNPC) {
							dx := t.X - targetX
							dz := t.Z - targetZ
							d := math.Sqrt(dx*dx + dz*dz)
							if d < minDist {
								minDist = d
								target = t
							}
						}
					}
				}

				if target == nil {
					target = player
				}

				// healinglight_beacon: Heals in AoE (5 unit radius) around target
				if runeID == "healinglight_beacon" {
					tX, tZ := target.X, target.Z
					aoeRadius := 5.0
					nearby := w.Grid.Nearby(tX, tZ, expandedAbilityRadius(skillName, aoeRadius), player.InstanceID)
					for _, ally := range nearby {
						if (ally.Type == TypePlayer || ally.Type == TypeNPC) && w.CombatRelationship(player, ally) != RelationshipHostile && withinAbilityRadius(skillName, tX, tZ, ally, aoeRadius) {
							ally.Mu.Lock()
							if ally.State == "DEAD" {
								ally.Mu.Unlock()
								continue
							}
							previousHealth := ally.Health
							ally.Health += applyHealingReceived(ally, healAmount)
							if ally.Health > ally.MaxHealth {
								ally.Health = ally.MaxHealth
							}
							actualHeal := ally.Health - previousHealth
							ally.Mu.Unlock()
							if actualHeal > 0 {
								w.fireHealEvent(player.ID, ally.ID, actualHeal, "holy", player.InstanceID)
							}
						}
					}
				} else {
					// Normal single-target heal
					target.Mu.Lock()
					previousHealth := target.Health
					target.Health += applyHealingReceived(target, healAmount)
					if target.Health > target.MaxHealth {
						target.Health = target.MaxHealth
					}
					actualHeal := target.Health - previousHealth
					target.Mu.Unlock()
					if actualHeal > 0 {
						w.fireHealEvent(player.ID, target.ID, actualHeal, "holy", player.InstanceID)
					}
				}

				// healinglight_renewal: Adds HoT for 5s (20% of initial heal)
				if runeID == "healinglight_renewal" {
					hotAmount := healAmount / 25 // Five ticks total 20% of the initial heal.
					if hotAmount < 1 {
						hotAmount = 1
					}
					target.Mu.Lock()
					target.HealingLightHoTActive = true
					target.HealingLightHoTAmount = hotAmount
					target.HealingLightHoTSourceID = player.ID
					target.HealingLightHoTTicksRemaining = 5
					target.HealingLightHoTEndTime = time.Now().Add(5 * time.Second)
					target.LastHealingLightHoTTick = time.Now()
					target.Mu.Unlock()
				}

				// healinglight_divine: Also cleanses 1 debuff
				if runeID == "healinglight_divine" {
					target.Mu.Lock()
					// Cleanse one debuff in priority order
					if target.Stunned {
						target.Stunned = false
					} else if target.Rooted {
						target.Rooted = false
					} else if target.Slowed {
						target.Slowed = false
						target.SlowFactor = 0
						target.SlowEndTime = time.Time{}
						target.RecalculateStats()
					} else if target.Bleeding {
						target.Bleeding = false
						target.BleedDamage = 0
						target.BleedSourceID = ""
						target.BleedEndTime = time.Time{}
					} else if target.Poisoned {
						target.Poisoned = false
						target.PoisonDamage = 0
						target.PoisonSourceID = ""
						target.PoisonEndTime = time.Time{}
					}
					target.Mu.Unlock()
				}

				setCooldown(resolveAbilityCooldown(player.SubType, skillName, 8*time.Second))
				w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
			}
		}
	} else if skillName == "Radiant Strike" {
		// Cone Damage
		cost := resolveAbilityManaCost(player, skillName, 20)
		if player.Mana >= cost {
			player.Mana -= cost

			// Radiant Strike Rune Effects
			runeID := player.GetRuneForSkill("Radiant Strike")

			// Combo: Holy Fury (Mark of Weakness → Radiant Strike) = +100% damage to marked targets
			holyFuryActive := player.ActiveCombo == "radiant_strike_boost"
			if holyFuryActive {
				player.ActiveCombo = "" // Consume combo
			}

			rangeDist := 3.0
			angleThreshold := math.Pi / 3 // 60 degrees
			baseDamage := int(float64(player.Damage+(player.Stats.Wisdom*2)) * player.GetSkillDamageMultiplier("Radiant Strike"))

			// radiantstrike_smite: +50% damage
			if runeID == "radiantstrike_smite" {
				baseDamage = int(float64(baseDamage) * 1.5)
			}

			pDirX, pDirZ := fighterFacing(player, targetX, targetZ)

			// Track total damage for lifesteal
			totalDamageDealt := 0

			nearby := w.Grid.Nearby(player.X, player.Z, expandedAbilityRadius(skillName, rangeDist), player.InstanceID)
			for _, target := range nearby {
				if target.ID == player.ID {
					continue
				}

				target.Mu.RLock()
				if !w.CanDamage(player, target) || target.State == "DEAD" {
					target.Mu.RUnlock()
					continue
				}
				dx := target.X - player.X
				dz := target.Z - player.Z
				isMarked := target.MarkWeakness
				target.Mu.RUnlock()

				dist := math.Sqrt(dx*dx + dz*dz)
				if dist > 0 && dist <= rangeDist+entityVisualRadius(target) {
					dirX := dx / dist
					dirZ := dz / dist

					dot := pDirX*dirX + pDirZ*dirZ
					if dot > math.Cos(angleThreshold) {
						// Calculate final damage
						damage := baseDamage
						// Holy Fury combo: +100% damage to marked targets
						if holyFuryActive && isMarked {
							damage = baseDamage * 2
						}

						target.Mu.Lock()
						finalDamage := applyFinalDamage(player, target, damage, "holy")
						totalDamageDealt += finalDamage
						addThreatLocked(target, player.ID, float64(finalDamage))

						// radiantstrike_chains: Roots target for 2s
						if runeID == "radiantstrike_chains" && !target.CCImmune {
							target.Rooted = true
							target.RootEndTime = time.Now().Add(2 * time.Second)
						}

						// radiantstrike_purge: Removes 1 buff from target
						if runeID == "radiantstrike_purge" {
							// Remove buffs in priority order
							if target.ZealActive {
								target.ZealActive = false
							} else if target.ArcaneShieldActive && target.ArcaneShieldHP > 0 {
								target.ArcaneShieldActive = false
								target.ArcaneShieldHP = 0
							} else if target.BerserkerModeActive {
								target.BerserkerModeActive = false
							} else if target.IronFortressActive {
								target.IronFortressActive = false
							}
							target.RecalculateStats()
						}

						isDead := target.Health <= 0
						target.Mu.Unlock()

						w.fireDamageEvent(player.ID, target.ID, finalDamage, "holy", player.InstanceID)
						if isDead {
							target.Mu.Lock()
							w.handleDeath(target, player, nil)
							target.Mu.Unlock()
						}
					}
				}
			}

			// Set Bonus: Crusader's Zeal 4pc (radiantStrikeLifesteal) - Heal for 100% of damage dealt
			if player.HasAnySetBonus("radiantStrikeLifesteal") && totalDamageDealt > 0 {
				previousHealth := player.Health
				player.Health += applyHealingReceived(player, totalDamageDealt)
				if player.Health > player.MaxHealth {
					player.Health = player.MaxHealth
				}
				if actualHeal := player.Health - previousHealth; actualHeal > 0 {
					w.fireHealEvent(player.ID, player.ID, actualHeal, "self_restore", player.InstanceID)
				}
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 4*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Heaven's Trumpet" {
		// AoE Stun/Damage
		cost := resolveAbilityManaCost(player, skillName, 50)
		if player.Mana >= cost {
			player.Mana -= cost

			radius := 12.0
			effectiveRadius := expandedAbilityRadius(skillName, radius)
			damage := int(float64(player.Stats.Wisdom*3) * player.GetSkillDamageMultiplier("Heaven's Trumpet"))

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
					finalDamage := applyFinalDamage(player, target, damage, "holy")
					addThreatLocked(target, player.ID, float64(finalDamage))
					if !target.CCImmune {
						target.Stunned = true
						target.StunEndTime = time.Now().Add(3 * time.Second)
					}
					target.MarkWeakness = true
					target.MarkWeaknessFactor = 0.50
					target.MarkWeaknessEndTime = time.Now().Add(5 * time.Second)
					isDead := target.Health <= 0
					target.Mu.Unlock()

					w.fireDamageEvent(player.ID, target.ID, finalDamage, "holy", player.InstanceID)
					if isDead {
						target.Mu.Lock()
						w.handleDeath(target, player, nil)
						target.Mu.Unlock()
					}
				}
			}
			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 60*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Consecrated Ground" {
		// Zone AoE
		cost := resolveAbilityManaCost(player, skillName, 40)
		if player.Mana >= cost {
			player.Mana -= cost

			// Consecrated Ground Rune Effects
			runeID := player.GetRuneForSkill("Consecrated Ground")

			radius := 5.0
			// consecratedground_expanded: +50% radius
			if runeID == "consecratedground_expanded" {
				radius = 7.5
			}

			// Spawn Zone Entity
			zone := &Entity{
				ID:                         fmt.Sprintf("zone-%d", time.Now().UnixNano()),
				InstanceID:                 player.InstanceID,
				Type:                       TypeProjectile,
				SubType:                    "ZoneHoly",
				X:                          player.X,
				Y:                          0.1,
				Z:                          player.Z,
				Radius:                     radius,
				Scale:                      radius / 5.0, // Encode radius for client rendering (base geometry is 5.0)
				Damage:                     int(float64(20+(player.Stats.Wisdom*1)) * player.GetSkillDamageMultiplier("Consecrated Ground")),
				OwnerID:                    player.ID,
				CreatedAt:                  time.Now(),
				ProjectileSkill:            "Consecrated Ground",
				ConsecratedGroundRuneID:    runeID,
				ConsecratedGroundSanctuary: runeID == "consecratedground_sanctuary",
			}

			// consecratedground_lingering: +100% duration (8s -> 16s)
			if runeID == "consecratedground_lingering" {
				zone.ConsecratedGroundEndTime = time.Now().Add(16 * time.Second)
			} else {
				zone.ConsecratedGroundEndTime = time.Now().Add(8 * time.Second)
			}

			w.Entities[zone.ID] = zone
			w.Grid.Add(zone)

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 12*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Blessing of Zeal" {
		// AoE Buff
		cost := resolveAbilityManaCost(player, skillName, 35)
		if player.Mana >= cost {
			player.Mana -= cost

			radius := 10.0
			nearby := w.Grid.Nearby(player.X, player.Z, expandedAbilityRadius(skillName, radius), player.InstanceID)
			for _, target := range nearby {
				target.Mu.Lock()
				if (target.Type == TypePlayer || target.Type == TypeNPC) && w.CombatRelationship(player, target) != RelationshipHostile && target.State != "DEAD" && withinAbilityRadius(skillName, player.X, player.Z, target, radius) {
					target.ZealActive = true
					target.ZealEndTime = time.Now().Add(8 * time.Second)
					target.RecalculateStats()
				}
				target.Mu.Unlock()
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 25*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	} else if skillName == "Mark of Weakness" {
		// Mark of Weakness (Debuff)
		cost := resolveAbilityManaCost(player, skillName, 30)
		if player.Mana >= cost {
			player.Mana -= cost

			// Find target
			var target *Entity
			if targetID != "" {
				if t, ok := w.Entities[targetID]; ok && validDirectAbilityTarget(w, player, t, 15.0, TypeEnemy) {
					target = t
				}
			}
			if target == nil {
				// Closest enemy
				minDist := 5.0
				nearby := w.Grid.Nearby(targetX, targetZ, 5.0+maxAbilityTargetVisualRadius, player.InstanceID)
				for _, t := range nearby {
					if validDirectAbilityTarget(w, player, t, 15.0, TypeEnemy) {
						d := math.Sqrt((t.X-targetX)*(t.X-targetX) + (t.Z-targetZ)*(t.Z-targetZ))
						if d < minDist {
							minDist = d
							target = t
						}
					}
				}
			}

			if target != nil {
				target.Mu.Lock()
				target.MarkWeakness = true
				target.MarkWeaknessFactor = 0.20
				target.MarkWeaknessEndTime = time.Now().Add(10 * time.Second)
				target.Mu.Unlock()
			}

			setCooldown(resolveAbilityCooldown(player.SubType, skillName, 20*time.Second))
			w.fireAbilityEvent(player.ID, targetID, skillName, targetX, targetZ)
		}
	}
}
