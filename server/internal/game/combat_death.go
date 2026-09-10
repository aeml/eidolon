package game

import (
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"
)

// Caller owns target.Mu, but not w.Mu or attacker.Mu. The target lock is
// temporarily released for party lookup and chained explosions, then restored.
func (w *World) handleDeath(target *Entity, attacker *Entity, deferred *deferredActions) {
	w.handleDeathWithWorldLock(target, attacker, deferred, false)
}

// Ability dispatch owns the world lock; timed impacts/world ticks do not.
// Both entry points retain the caller's target lock across the operation.
func (w *World) handleDeathWorldLocked(target *Entity, attacker *Entity, deferred *deferredActions) {
	w.handleDeathWithWorldLock(target, attacker, deferred, true)
}

func (w *World) handleDeathWithWorldLock(target *Entity, attacker *Entity, deferred *deferredActions, worldLocked bool) {
	// Prevent destruction of static objects
	if target.Type == TypeForge || target.Type == TypeStash {
		target.Health = target.MaxHealth
		return
	}

	if target.State == "DEAD" {
		return
	}

	// Divine Intervention is authoritative lethal-damage prevention. Every
	// damage path already funnels lethal outcomes through handleDeath, so this
	// also protects against DoTs, hazards, projectiles, and reflected damage.
	if (target.Type == TypePlayer || target.Type == TypeNPC) && target.DivineInterventionActive && time.Now().Before(target.DivineInterventionEndTime) {
		target.Health = target.MaxHealth * 30 / 100
		if target.Health < 1 {
			target.Health = 1
		}
		target.DivineInterventionActive = false
		target.DivineInterventionEndTime = time.Time{}
		w.fireHealEvent(target.ID, target.ID, target.Health, "divine_intervention", target.InstanceID)
		return
	}

	target.Health = 0
	target.State = "DEAD"
	clearWhirlwindLocked(target)
	target.LastAttackTime = time.Now()
	if target.Type == TypePlayer && attacker != nil && attacker.Type == TypePlayer {
		w.ResolvePvPDeath(target.ID, attacker.ID)
	}

	if target.Type == TypeEnemy && target.InstanceID != "" && (attacker == nil || attacker.Type != TypePlayer) {
		instanceID := target.InstanceID
		defeatedEnemyID := target.ID
		spawnX, spawnZ := target.SpawnX, target.SpawnZ
		if spawnX == 0 && spawnZ == 0 && (target.X != 0 || target.Z != 0) {
			spawnX, spawnZ = target.X, target.Z
		}
		w.runBackground(func() { w.markDungeonRoomClearedIfDefeated(instanceID, defeatedEnemyID, spawnX, spawnZ) })
	}

	// === ON-KILL EFFECTS (Unique Effects & Set Bonuses) ===
	if attacker != nil && attacker.Type == TypePlayer && target.Type == TypeEnemy {
		actualVampiricHeal := 0
		explosionDamage := 0
		attackerID := attacker.ID
		attacker.Mu.Lock()
		attackerInstanceID := attacker.InstanceID
		// Unique Effect: vampiric - Restore 5% max HP on kill
		if attacker.HasUniqueEffect("vampiric") {
			healAmount := applyHealingReceived(attacker, applyHealingDoneBonus(attacker, attacker.MaxHealth/20)) // 5%
			previousHealth := attacker.Health
			attacker.Health += healAmount
			if attacker.Health > attacker.MaxHealth {
				attacker.Health = attacker.MaxHealth
			}
			actualVampiricHeal = attacker.Health - previousHealth
		}

		// Unique Effect: explosive - AoE damage on kill (50% of attacker's damage in 5 unit radius)
		if attacker.HasUniqueEffect("explosive") {
			explosionDamage = attacker.Damage * 50 / 100
			if explosionDamage < 1 {
				explosionDamage = 1
			}
		}

		// Set Bonus: Warlord's Fury 4pc (chargeReset) - Reset Charge cooldown on kill
		if attacker.HasAnySetBonus("chargeReset") {
			if attacker.Cooldowns != nil {
				delete(attacker.Cooldowns, "Charge")
			}
		}

		// Set Bonus: Inferno's Heart 6pc (meteorReset) - Fire kills reset Meteor CD.
		if target.LastDamageType == "fire" && attacker.HasAnySetBonus("meteorReset") {
			if attacker.Cooldowns != nil {
				delete(attacker.Cooldowns, "Meteor Drop")
			}
		}
		attacker.Mu.Unlock()

		if actualVampiricHeal > 0 {
			w.fireHealEvent(attackerID, attackerID, actualVampiricHeal, "vampiric", attackerInstanceID)
		}
		if explosionDamage > 0 {
			corpseID, instanceID, x, z := target.ID, target.InstanceID, target.X, target.Z
			// Finish this death before propagating its explosion. Retaining the
			// corpse lock deadlocks on itself, ancestors in a chain, or another
			// simultaneous explosive death. Restore the caller's lock contract
			// before returning, including when explosion processing panics.
			defer func() {
				target.Mu.Unlock()
				defer target.Mu.Lock()
				w.applyOnKillExplosion(attacker, corpseID, instanceID, x, z, explosionDamage, deferred, worldLocked)
			}()
		}
	}

	if attacker != nil && attacker.Type == TypePlayer && target.Type == TypeEnemy {
		// Capture data for async processing to avoid deadlocks
		tLevel := target.Level
		tSubType := target.SubType
		tID := target.ID
		tX, tZ := target.X, target.Z
		tSpawnX, tSpawnZ := target.SpawnX, target.SpawnZ
		if tSpawnX == 0 && tSpawnZ == 0 && (tX != 0 || tZ != 0) {
			tSpawnX, tSpawnZ = tX, tZ
		}
		tInstanceID := target.InstanceID
		attacker.Mu.Lock()
		qaGuaranteedLoot := attacker.QAGuaranteedLoot
		attacker.QAGuaranteedLoot = false
		attackerID := attacker.ID
		attackerPartyID := attacker.PartyID
		attacker.Mu.Unlock()

		var partyMembers []*Entity
		if attackerPartyID != "" {
			// The corpse is already dead. Release its mutex during recipient
			// lookup, then restore ownership even if snapshotting panics.
			target.Mu.Unlock()
			func() {
				defer target.Mu.Lock()
				partyMembers = w.snapshotPartyKillRecipients(attackerPartyID, tInstanceID, tX, tZ, worldLocked)
			}()
		}

		w.runBackground(func() {
			if tInstanceID != "" {
				w.markDungeonRoomClearedIfDefeated(tInstanceID, tID, tSpawnX, tSpawnZ)
			}

			// Get difficulty multipliers and current dungeon completion state for dungeon enemies
			instanceDifficulty := w.GetInstanceDifficulty(tInstanceID)
			instanceType := w.GetInstanceType(tInstanceID)
			runLevel := 0
			instanceCreatedAt := time.Time{}
			roomsCleared := 0
			eliteRoomsCleared := 0
			totalRooms := 0
			totalEliteRooms := 0
			if tInstanceID != "" {
				if inst, ok := w.getDungeonInstance(tInstanceID); ok {
					inst.Mu.RLock()
					runLevel = inst.RunLevel
					instanceCreatedAt = inst.CreatedAt
					for idx, layoutRoom := range inst.Layout.Rooms {
						if layoutRoom.Type == "start" {
							continue
						}
						totalRooms++
						if layoutRoom.Type == "elite" {
							totalEliteRooms++
						}
						if inst.RoomState != nil && idx < len(inst.RoomState.Rooms) && inst.RoomState.Rooms[idx].Cleared {
							roomsCleared++
							if layoutRoom.Type == "elite" {
								eliteRoomsCleared++
							}
						}
					}
					inst.Mu.RUnlock()
				}
			}
			_, _, lootMult, xpMult := DifficultyMultipliers(instanceDifficulty)

			// Gold
			baseGold := 0
			if tLevel > 0 {
				baseGold = rand.Intn(tLevel*10) + 10
			}

			// Boss Check
			isBoss := false
			weeklyRaidBoss := tSubType == "UmbraPrime"
			finalDungeonBoss := isFinalDungeonBoss(tSubType)
			bosses := []string{
				"RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel", "AvengingSeraph",
				"Cindermaw", "ScorchedTwins", "ForgemasterPyrax", "ObsidianGuardian", "LordInfernax",
				"Windshear", "Stormcallers", "RocMatriarch", "ThunderlordKaelix", "Zephyrion",
				"TiderendLeviathan", "DrownedChoir", "AbyssalGoliath", "MaelstromWarden", "Thalorath",
				"DissonantHerald", "NullArchitect", "EidolonDevourer", "UmbraPrime",
			}
			for _, b := range bosses {
				if tSubType == b {
					isBoss = true
					break
				}
			}
			if IsElementalRaidBoss(instanceType, tSubType) {
				isBoss = true
			}

			if isBoss {
				log.Printf("Boss Death Detected: %s. Attacker: %s. PartyID: %s", tSubType, attackerID, attackerPartyID)
			}

			// Dungeon Boss Check
			isDungeonBoss := false
			dungeonBosses := []string{
				"RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel",
				"Cindermaw", "ScorchedTwins", "ForgemasterPyrax", "ObsidianGuardian", "LordInfernax",
				"Windshear", "Stormcallers", "RocMatriarch", "ThunderlordKaelix", "Zephyrion",
				"TiderendLeviathan", "DrownedChoir", "AbyssalGoliath", "MaelstromWarden", "Thalorath",
				"DissonantHerald", "NullArchitect", "EidolonDevourer", "UmbraPrime",
			}
			for _, b := range dungeonBosses {
				if tSubType == b {
					isDungeonBoss = true
					break
				}
			}
			if IsElementalRaidBoss(instanceType, tSubType) {
				isDungeonBoss = true
			}

			// Loot
			// Check if Elite
			isElite := strings.HasPrefix(tID, "elite-")
			baseXpReward := combatExperienceBudget(tLevel, runLevel, isBoss, isElite)

			// 1. Mixed-pool candidates. Equipment is bounded separately below;
			// retain all original material candidates rather than nerfing Forge
			// supply incidentally alongside routine equipment frequency.
			dropCount := 0
			if isElite {
				dropCount = 3 // Elite pool candidates, not three guaranteed gear drops.
			} else if (qaGuaranteedLoot || rand.Float64() < 0.5) && tLevel > 0 {
				dropCount = 1 // Normal enemies have 50% chance for 1 item
			}

			var lootItems []*Item

			if dropCount > 0 {
				for i := 0; i < dropCount; i++ {
					if qaGuaranteedLoot && i == 0 {
						lootItems = append(lootItems, GenerateEquipmentLoot(tLevel))
					} else if isElite {
						lootItems = append(lootItems, GenerateEliteLoot(tLevel))
					} else {
						lootItems = append(lootItems, GenerateLoot(tLevel))
					}
				}
			}
			lootItems = limitRoutineEquipmentLoot(lootItems, isElite, isBoss, qaGuaranteedLoot, rand.Float64())

			// 2. Shard/Heart Loot (Eidolic)
			eidolicLoot := GenerateShardLoot(isElite)
			lootItems = append(lootItems, eidolicLoot...)

			// 3. Gem Loot - 10% base chance (30% for elites)
			gemChance := 0.10
			if isElite {
				gemChance = 0.30
			}
			if rand.Float64() < gemChance {
				// Quality still scales with level, but gems can now drop at any level.
				gem := GenerateRandomGemByLevel(tLevel, isElite)
				lootItems = append(lootItems, gem)
			}

			// Use kill-time recipients, never a later position/party lookup.
			if len(partyMembers) > 0 {
				// Calculate Bonus
				bonusMultiplier := 1.0 + (float64(len(partyMembers)) * 0.10)
				// Apply difficulty multipliers
				totalGold := int(float64(baseGold) * bonusMultiplier * lootMult)

				xpPerMember := recipientCombatExperience(baseXpReward, isBoss, len(partyMembers), xpMult)
				goldPerMember := totalGold / len(partyMembers)

				for _, member := range partyMembers {
					member.Mu.Lock()
					rewardMultiplier := resonanceRewardMultiplier(member)
					memberXP := wellRestedKillXP(member, int(float64(xpPerMember)*rewardMultiplier))
					memberGold := int(float64(goldPerMember) * rewardMultiplier)
					w.awardExperienceLocked(member, memberXP)
					member.Gold += memberGold
					w.Economy.RecordSource("combat_rewards", memberGold)
					memberRewardItemCount := 0
					memberRewardGemCount := 0
					memberRewardItems := []*Item{}

					// Update Quests for all party members
					w.UpdateQuestProgress(member, tSubType)
					w.updateChronicleHuntKillLocked(member, tSubType, tLevel, tInstanceID, tSpawnX, tSpawnZ)
					if isDungeonBoss {
						w.UpdateQuestProgress(member, "DungeonBoss")
						if instanceDifficulty == DifficultyHeroic {
							w.UpdateQuestProgress(member, "DungeonBossHeroic")
						} else if instanceDifficulty == DifficultyMythic {
							w.UpdateQuestProgress(member, "DungeonBossMythic")
						}

						switch instanceType {
						case "verdant_bastion_catacombs":
							w.UpdateQuestProgress(member, "VerdantBastionBoss")
						case "molten_core":
							w.UpdateQuestProgress(member, "MoltenCoreBoss")
						case "tempest_spire":
							w.UpdateQuestProgress(member, "TempestSpireBoss")
						case "abyssal_well":
							w.UpdateQuestProgress(member, "AbyssalWellBoss")
						}
					}

					heartCount := 0
					if isBoss && !weeklyRaidBoss {
						hearts := GenerateBossHearts()
						heartCount = len(hearts)
						log.Printf("Party Boss Loot: Generated %d hearts for member %s", len(hearts), member.ID)
						for _, heart := range hearts {
							rem := member.AddItemToInventory(*heart)
							if rem > 0 {
								log.Printf("Party Boss Loot: Inventory full for %s. Remaining: %d", member.ID, rem)
							}
						}

						if instanceDifficulty == DifficultyHeroic || instanceDifficulty == DifficultyMythic {
							if bonusGem := GenerateRandomGem(true, instanceDifficulty == DifficultyMythic); bonusGem != nil {
								if member.AddItemToInventory(*bonusGem) == 0 {
									memberRewardGemCount++
									memberRewardItems = append(memberRewardItems, bonusGem)
								}
							}
						}
						if instanceDifficulty == DifficultyMythic {
							if uniqueItem := GenerateGuaranteedUniqueEquipment(max(runLevel, 100)); uniqueItem != nil {
								if member.AddItemToInventory(*uniqueItem) == 0 {
									memberRewardItemCount++
									memberRewardItems = append(memberRewardItems, uniqueItem)
								}
							}
						}
					}

					memberID := member.ID
					rewardSummary := RewardSummaryEvent{}
					hasRewardSummary := false
					if isBoss {
						rewardSummary = buildBossRewardSummary(memberID, tSubType, instanceType, instanceDifficulty, runLevel, roomsCleared, eliteRoomsCleared, totalRooms, totalEliteRooms, memberGold, memberXP, heartCount, memberRewardItems)
						if memberRewardItemCount > 0 {
							rewardSummary.ItemCount = memberRewardItemCount
						}
						if memberRewardGemCount > 0 {
							rewardSummary.GemCount = memberRewardGemCount
						}
						hasRewardSummary = true
					}

					member.Mu.Unlock()

					if isBoss && w.OnEvent != nil {
						weeklyRaid := weeklyRaidBoss
						pid, summary, sendSummary, weekly := memberID, rewardSummary, hasRewardSummary, weeklyRaid
						w.runBackground(func() {
							w.OnEvent("inventory_update", pid)
							if sendSummary {
								w.OnEvent("reward_summary", summary)
							}
							if weekly {
								w.OnEvent("weekly_raid_complete", WeeklyRaidCompletionEvent{PlayerID: pid, InstanceID: tInstanceID})
							}
						})
					}
				}
			} else if attackerPartyID == "" {
				// Solo Logic
				attacker.Mu.Lock()

				// Apply difficulty multipliers
				finalXp := recipientCombatExperience(baseXpReward, isBoss, 1, xpMult)
				finalGold := int(float64(baseGold) * lootMult)
				rewardMultiplier := resonanceRewardMultiplier(attacker)
				finalXp = wellRestedKillXP(attacker, int(float64(finalXp)*rewardMultiplier))
				finalGold = int(float64(finalGold) * rewardMultiplier)

				w.awardExperienceLocked(attacker, finalXp)
				attacker.Gold += finalGold
				w.Economy.RecordSource("combat_rewards", finalGold)
				attackerRewardItemCount := 0
				attackerRewardGemCount := 0
				attackerRewardItems := []*Item{}
				// Update Quests
				w.UpdateQuestProgress(attacker, tSubType)
				w.updateChronicleHuntKillLocked(attacker, tSubType, tLevel, tInstanceID, tSpawnX, tSpawnZ)
				if isDungeonBoss {
					w.UpdateQuestProgress(attacker, "DungeonBoss")
					if instanceDifficulty == DifficultyHeroic {
						w.UpdateQuestProgress(attacker, "DungeonBossHeroic")
					} else if instanceDifficulty == DifficultyMythic {
						w.UpdateQuestProgress(attacker, "DungeonBossMythic")
					}

					switch instanceType {
					case "verdant_bastion_catacombs":
						w.UpdateQuestProgress(attacker, "VerdantBastionBoss")
					case "molten_core":
						w.UpdateQuestProgress(attacker, "MoltenCoreBoss")
					case "tempest_spire":
						w.UpdateQuestProgress(attacker, "TempestSpireBoss")
					case "abyssal_well":
						w.UpdateQuestProgress(attacker, "AbyssalWellBoss")
					}
				}

				heartCount := 0
				if isBoss && !weeklyRaidBoss {
					hearts := GenerateBossHearts()
					heartCount = len(hearts)
					log.Printf("Solo Boss Loot: Generated %d hearts for %s", len(hearts), attacker.ID)
					for _, heart := range hearts {
						rem := attacker.AddItemToInventory(*heart)
						if rem > 0 {
							log.Printf("Solo Boss Loot: Inventory full for %s. Remaining: %d", attacker.ID, rem)
						}
					}

					if instanceDifficulty == DifficultyHeroic || instanceDifficulty == DifficultyMythic {
						if bonusGem := GenerateRandomGem(true, instanceDifficulty == DifficultyMythic); bonusGem != nil {
							if attacker.AddItemToInventory(*bonusGem) == 0 {
								attackerRewardGemCount++
								attackerRewardItems = append(attackerRewardItems, bonusGem)
							}
						}
					}
					if instanceDifficulty == DifficultyMythic {
						if uniqueItem := GenerateGuaranteedUniqueEquipment(max(runLevel, 100)); uniqueItem != nil {
							if attacker.AddItemToInventory(*uniqueItem) == 0 {
								attackerRewardItemCount++
								attackerRewardItems = append(attackerRewardItems, uniqueItem)
							}
						}
					}
				}

				attackerID := attacker.ID
				rewardSummary := RewardSummaryEvent{}
				hasRewardSummary := false
				if isBoss {
					rewardSummary = buildBossRewardSummary(attackerID, tSubType, instanceType, instanceDifficulty, runLevel, roomsCleared, eliteRoomsCleared, totalRooms, totalEliteRooms, finalGold, finalXp, heartCount, attackerRewardItems)
					if attackerRewardItemCount > 0 {
						rewardSummary.ItemCount = attackerRewardItemCount
					}
					if attackerRewardGemCount > 0 {
						rewardSummary.GemCount = attackerRewardGemCount
					}
					hasRewardSummary = true
				}

				attacker.Mu.Unlock()

				if isBoss && w.OnEvent != nil {
					weeklyRaid := weeklyRaidBoss
					pid, summary, sendSummary, weekly := attackerID, rewardSummary, hasRewardSummary, weeklyRaid
					w.runBackground(func() {
						w.OnEvent("inventory_update", pid)
						if sendSummary {
							w.OnEvent("reward_summary", summary)
						}
						if weekly {
							w.OnEvent("weekly_raid_complete", WeeklyRaidCompletionEvent{PlayerID: pid, InstanceID: tInstanceID})
						}
					})
				}
			}

			var participants []string
			if attackerPartyID == "" {
				participants = []string{attackerID}
			}
			if len(partyMembers) > 0 {
				participants = make([]string, 0, len(partyMembers))
				for _, member := range partyMembers {
					participants = append(participants, member.ID)
				}
			}
			if IsElementalRaidBoss(instanceType, tSubType) {
				w.StartCrystalRepair(tInstanceID, instanceType, participants, tX, tZ)
			}
			// Only actual death-pipeline recipients can receive the anchor's
			// combat evidence. Each still needs their own accepted quest and ash
			// discovery. Ordinary kills do not parse the investigation catalog.
			if strings.HasPrefix(tID, "chronicle-site-") {
				for _, playerID := range participants {
					w.RecordChronicleInvestigationKill(playerID, tID)
				}
			}
			if finalDungeonBoss && w.OnEvent != nil && !instanceCreatedAt.IsZero() {
				w.OnEvent("dungeon_complete", DungeonCompletionEvent{
					InstanceID: tInstanceID, DungeonType: instanceType, Difficulty: instanceDifficulty,
					RunLevel: runLevel, Duration: max(time.Millisecond, time.Since(instanceCreatedAt)), Participants: participants,
				})
			}

			if len(lootItems) > 0 || len(participants) > 0 {
				w.Mu.Lock() // Lock world to add entities
				for i, item := range lootItems {
					if item == nil {
						continue
					}
					// Offset loot slightly so they don't stack perfectly
					offsetX := (rand.Float64() - 0.5) * 1.0
					offsetZ := (rand.Float64() - 0.5) * 1.0

					lootEntity := &Entity{
						ID:          fmt.Sprintf("loot-%d-%d", time.Now().UnixNano(), i),
						InstanceID:  tInstanceID,
						Type:        TypeLoot,
						X:           tX + offsetX,
						Y:           0.5,
						Z:           tZ + offsetZ,
						LootItem:    item,
						LootTime:    time.Now(),
						LootPartyID: attackerPartyID,
					}

					// Always add directly since we are async
					w.Entities[lootEntity.ID] = lootEntity
					w.Grid.Add(lootEntity)
				}
				for _, playerID := range participants {
					w.spawnChronicleDropLocked(playerID, tSubType, tInstanceID, tX, tZ, rand.Float64())
				}
				w.Mu.Unlock()
			}
		})

	}
}
