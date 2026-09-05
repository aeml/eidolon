import * as THREE from 'three';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { AUDIO_CUES } from '../audio/AudioManager.js';
import { getProjectileImpactRadius } from '../skills/abilityRadii.js';
import { PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS } from '../art/ProceduralCombatFeedback.js';
import { PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS } from '../art/ProceduralProjectileImpacts.js';
import { LootDrop } from '../entities/LootDrop.js';
import {
    decorateDungeonRoomState
} from '../utils/dungeonRoomMetadata.js';
import { installPrototypeMethods } from './PrototypeInstaller.js';

class GameEngineNetworkMessageMethods {
    async enterInstance(instanceId, type, layout, roomState = null) {
        console.log(`Entering instance: ${instanceId} (${type})`);
        // Any scenery job started for the prior scene must not add meshes or
        // colliders after the instance transition has cleared that scene.
        this.overworldSceneGeneration = (this.overworldSceneGeneration || 0) + 1;
        const transitionGeneration = this.overworldSceneGeneration;
        const isCurrentTransition = () => this.overworldSceneGeneration === transitionGeneration;
        const previousInstanceType = this.currentInstanceType || 'overworld';
        this.currentInstanceId = instanceId;
        this.currentInstanceType = type;
        this.currentDungeonRoomState = decorateDungeonRoomState(roomState);
        this.currentDungeonLayout = layout || null;
        this.clearCombatIntentState();
        this.resetRenderUpdateSignatures();
        this.refreshDungeonEntranceHint();
        this.pendingInteraction = null;
        this.playerJumpState = null;
        this.playerQueuedJump = false;
        this.playerJumpLandingVisual = null;
        this.playerJumpVisualHeight = 0;
        this.playerCorrectionVisualState = null;
        if (this.player) {
            this.player.isCharging = false;
            this.player.targetEntity = null;
            this.player.targetPosition = null;
            this.player.state = 'IDLE';
            this.player.velocity?.set?.(0, 0, 0);
            this.player.clearJumpAnimation?.();
        }
        if (this.abilityController) {
            this.abilityController.pendingAbilityTarget = null;
            this.abilityController.pendingAbilitySkill = null;
            this.abilityController.inputBuffer = [];
        }
        this.inputManager?.clearInputState?.();

        for (const effect of this.effects) {
            effect?.dispose?.();
        }
        this.effects = [];

        for (const hazard of this.hazards.values()) {
            hazard?.removeFromScene?.(this.renderSystem.environmentGroup);
            hazard?.dispose?.();
        }
        this.hazards.clear();

        // Creation is intentionally throttled across frames. Anything still
        // queued belongs to the old scene and must not materialize after its
        // authoritative instance has already been torn down.
        this.entityCreationQueue = [];
        this.pendingEntityIds?.clear();

        // Clear current dynamic entities through explicit render ownership paths.
        this.remotePlayers.forEach(entity => {
            if (entity.mesh) {
                if (typeof this.renderSystem.remove === 'function') {
                    this.renderSystem.remove(entity.mesh);
                } else if (entity.mesh.parent?.remove) {
                    entity.mesh.parent.remove(entity.mesh);
                }
            }
            if (entity.healthBar) entity.healthBar.remove();
            this.chunkManager.removeEntity(entity);
        });
        this.remotePlayers.clear();

        this.enemies.forEach(e => this.chunkManager.removeEntity(e));
        this.enemies = [];

        this.lootDrops.forEach(e => this.chunkManager.removeEntity(e));
        this.lootDrops = [];

        if (typeof this.renderSystem.clearInstanceScene === 'function') {
            this.renderSystem.clearInstanceScene();
        } else {
            this.renderSystem.instanceEnvironmentGroup?.children?.slice().forEach(child => {
                this.renderSystem.instanceEnvironmentGroup.remove(child);
            });
            this.renderSystem.entityGroup?.children?.slice().forEach(child => {
                this.renderSystem.entityGroup.remove(child);
            });
            this.renderSystem.effectGroup?.children?.slice().forEach(child => {
                this.renderSystem.effectGroup.remove(child);
            });
        }
        this.activeWorldGenerator = null;

        // Clear collisions
        this.collisionManager.clear();

        const hasCanonicalDungeonWalkRects = !!(
            layout &&
            Array.isArray(layout.walkRects) &&
            layout.walkRects.length > 0 &&
            (
                type === 'verdant_bastion_catacombs' ||
                type === 'molten_core' ||
                type === 'tempest_spire' ||
                type === 'abyssal_well' ||
                type === 'umbral_nexus'
				|| type === 'weekly_raid'
                || type === 'earth_crystal_raid'
                || type === 'water_crystal_raid'
                || type === 'fire_crystal_raid'
                || type === 'air_crystal_raid'
            )
        );

        if (hasCanonicalDungeonWalkRects) {
            this.collisionManager.setDungeonWalkableGeometry(layout.walkRects);
        } else {
            this.collisionManager.clearDungeonWalkableGeometry();
        }

        // Generate new world
        const worldGen = new WorldGenerator(this.getInstanceEnvironmentGroup(), this.collisionManager);
        this.activeWorldGenerator = worldGen;
        if (type === 'crypt') {
            await worldGen.createDungeon(0, 0, 100, { shouldAttach: isCurrentTransition });
        } else if (type === 'verdant_bastion_catacombs') {
            await worldGen.createVerdantBastionCatacombs(0, 0, layout);
        } else if (type === 'molten_core') {
            await worldGen.createMoltenCore(0, 0, layout);
        } else if (type === 'tempest_spire') {
            await worldGen.createTempestSpire(0, 0, layout);
        } else if (type === 'abyssal_well') {
            await worldGen.createAbyssalWell(0, 0, layout);
        } else if (type === 'umbral_nexus') {
            await worldGen.createUmbralNexus(0, 0, layout);
        } else if (type === 'weekly_raid') {
            await worldGen.createUmbralNexus(0, 0, layout);
        } else if (type === 'earth_crystal_raid') {
            await worldGen.createVerdantBastionCatacombs(0, 0, layout);
        } else if (type === 'water_crystal_raid') {
            await worldGen.createAbyssalWell(0, 0, layout);
        } else if (type === 'fire_crystal_raid') {
            await worldGen.createMoltenCore(0, 0, layout);
        } else if (type === 'air_crystal_raid') {
            await worldGen.createTempestSpire(0, 0, layout);
        } else {
            // Returning to overworld - ensure persistent environment meshes are re-added
            // after the scene was cleared.
            await this.renderSystem.preloadEnvironment();
            if (!isCurrentTransition()) return;
            await worldGen.createTown(0, 200, 100, { shouldAttach: isCurrentTransition });
            if (!isCurrentTransition()) return;
            await worldGen.createOverworldStructures({ shouldAttach: isCurrentTransition });
        }
        if (!isCurrentTransition()) return;
        worldGen.updateDungeonRoomState?.(this.currentDungeonRoomState);

        // Reset player position and state
        let startX = 0;
        let startZ = 0;

        if (layout && layout.rooms && layout.rooms.length > 0) {
            const startRoom = layout.rooms[0];
            startX = startRoom.x;
            startZ = startRoom.z;
        } else if (type === 'crypt') {
            // Default crypt spawn
            startX = 0;
            startZ = 0;
        } else if (type !== 'verdant_bastion_catacombs') {
             // Overworld spawn default
             startX = -1.25;
             startZ = 200;
        }

        this.player.position.set(startX, 0.5, startZ);
        this.player.targetPosition = null; // Clear any pending movement target

        // Dungeon coordinates intentionally live far outside the overworld.
        // Route atmosphere by instance identity so those coordinates cannot
        // accidentally select the Air realm's light/fog/particles.
        const environmentType = {
            weekly_raid: 'umbral_nexus',
            earth_crystal_raid: 'verdant_bastion_catacombs',
            water_crystal_raid: 'abyssal_well',
            fire_crystal_raid: 'molten_core',
            air_crystal_raid: 'tempest_spire'
        }[type] || type;
        this.renderSystem.setEnvironmentContext?.(environmentType, this.player.position, true);

        if (this.player.mesh) {
            this.player.mesh.position.set(startX, 0.5, startZ);
            this.renderSystem.add(this.player.mesh); // Ensure player is in scene
            this.player.mesh.visible = true;
            console.log(`Player mesh re-added to scene at ${startX},0.5,${startZ}`);
        } else {
            console.error("Player mesh missing during instance entry!");
        }

        // Force update chunk to ensure player is tracked correctly in new location
        this.chunkManager.updateEntityChunk(this.player);

        // Reset Camera
        this.renderSystem.setCameraTarget(this.player.position);
        this.player.targetPosition = null;
        this.player.state = 'IDLE';
        this.player.playAnimation('Idle');

        // Reset Camera
        if (this.cameraLocked) {
            this.renderSystem.setCameraTarget(this.player.position);
        }

        const currentQuests = Array.isArray(this.player.quests) ? this.player.quests : [];
        if (type === 'overworld' && previousInstanceType !== 'overworld') {
            this.onboardingRecoveryContext = { reason: 'town_return', updatedAt: Date.now() };
        } else if (type !== 'overworld') {
            this.clearOnboardingRecoveryContext();
        }
        this.uiManager?.updateQuestWindow?.(currentQuests);
        this.uiManager?.updateJournal?.(currentQuests);
    }

    renderProjectileImpactFeedback(data = {}) {
        const projectileType = data.projectileType;
        if (!PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS[projectileType]) return false;

        const eventInstance = data.instanceId || '';
        const currentInstance = this.currentInstanceId || '';
        if (eventInstance !== currentInstance) return false;

        if (!this.projectileImpactCueKeys) this.projectileImpactCueKeys = new Map();
        const now = Date.now();
        for (const [key, createdAt] of this.projectileImpactCueKeys) {
            if (now - createdAt > 5000) this.projectileImpactCueKeys.delete(key);
        }
        const positionKey = `${Math.round(Number(data.x) * 10)}:${Math.round(Number(data.z) * 10)}`;
        const cueKey = data.terminal
            ? `${data.projectileId || projectileType}:terminal`
            : `${data.projectileId || projectileType}:${data.targetId || positionKey}`;
        if (this.projectileImpactCueKeys.has(cueKey)) return false;

        const position = new THREE.Vector3(
            Number(data.x) || 0,
            Math.max(0.04, Number(data.y) || 0.04),
            Number(data.z) || 0
        );
        const direction = new THREE.Vector3(Number(data.directionX) || 0, 0, Number(data.directionZ) || 0);
        if (direction.lengthSq() === 0) direction.set(0, 0, 1);
        else direction.normalize();
        const projectile = data.projectileId ? this.remotePlayers?.get?.(data.projectileId) : null;
        const source = projectile?.owner
            || this.remotePlayers?.get?.(data.sourceId)
            || (data.sourceId === this.player?.id ? this.player : null);
        // Overworld events use an empty instance id, so proximity is proven by
        // a replicated projectile/source instead of making every connected
        // overworld client animate distant combat it cannot see.
        if (!eventInstance && !projectile && !source) return false;
        const suppliedRadius = Number(data.radius);
        const radius = Number.isFinite(suppliedRadius) && suppliedRadius > 0
            ? suppliedRadius
            : getProjectileImpactRadius(projectileType, source, projectile?.scale);
        const spawned = this.spawnTransientEffect?.('projectile_impact', position, 0xffffff, {
            projectileType,
            source,
            direction,
            radius,
            targetId: data.targetId || '',
            terminal: Boolean(data.terminal),
            skillName: data.skillName || ''
        });
        if (!spawned) return false;

        this.projectileImpactCueKeys.set(cueKey, now);
        if (projectile) projectile.hasResolvedImpact = true;
        this.lastProjectileImpactPresentation = {
            projectileId: data.projectileId || '',
            projectileType,
            targetId: data.targetId || '',
            instanceId: eventInstance,
            radius: radius ?? null,
            terminal: Boolean(data.terminal),
            position: position.toArray()
        };
        return true;
    }

    resolveCombatFeedbackKind(data = {}, source = null, target = null, eventType = 'damage') {
        const serverKind = String(data.kind || '').toLowerCase();
        if (eventType === 'heal') {
            if (serverKind === 'lifesteal' || serverKind === 'vampiric') return 'lifesteal';
            if (serverKind === 'self_restore' || serverKind === 'divine_intervention') return 'self_restore';
            if (serverKind.includes('hot') || serverKind === 'renewal' || serverKind === 'guardian_embrace'
                || serverKind === 'consecration' || serverKind === 'spirit_guardians') return 'restoration_tick';
            const sourceClass = String(source?.meshType || source?.subType || source?.constructor?.name || '').toLowerCase();
            if (sourceClass === 'cleric' || serverKind === 'holy') return 'cleric_heal';
            if (data.sourceId && data.sourceId === data.targetId) return 'self_restore';
            return 'cleric_heal';
        }

        const explicitKinds = {
            bleed: 'bleed_tick',
            poison: 'poison_tick',
            reflect: 'reflect_strike',
            lava_pool: 'lava_tick',
            lava: 'lava_tick',
            sandstorm: 'sandstorm_tick',
            lightning_zone: 'lightning_tick',
            lightning: 'lightning_tick',
            wind_gust: 'wind_tick',
            wind: 'wind_tick'
        };
        if (explicitKinds[serverKind]) return explicitKinds[serverKind];
        const sourceId = String(data.sourceId || '').toLowerCase();
        if (sourceId.includes('hazard-lava')) return 'lava_tick';
        if (sourceId.includes('hazard-sandstorm')) return 'sandstorm_tick';
        if (sourceId.includes('hazard-lightning')) return 'lightning_tick';
        if (sourceId.includes('hazard-wind')) return 'wind_tick';
        if (sourceId === 'bleed') return 'bleed_tick';
        if (sourceId === 'poison') return 'poison_tick';

        const sourceClass = String(source?.meshType || source?.subType || source?.constructor?.name || '').toLowerCase();
        if (sourceClass === 'fighter') return 'fighter_strike';
        if (sourceClass === 'rogue') return 'rogue_strike';
        if (sourceClass === 'wizard') return 'wizard_strike';
        if (sourceClass === 'cleric') return 'cleric_strike';
        if (serverKind === 'holy') return 'cleric_strike';
        if (serverKind === 'arcane' || serverKind === 'fire') return 'wizard_strike';
        if (serverKind === 'reflect') return 'reflect_strike';
        return 'enemy_strike';
    }

    renderCombatFeedback(data = {}, eventType = 'damage') {
        const target = data.targetId === this.player?.id
            ? this.player
            : this.remotePlayers?.get?.(data.targetId);
        if (!target?.position) return false;
        const eventInstance = data.instanceId || '';
        const currentInstance = this.currentInstanceId || '';
        if (eventInstance && eventInstance !== currentInstance) return false;

        const source = data.sourceId === this.player?.id
            ? this.player
            : this.remotePlayers?.get?.(data.sourceId);
        const isLocalInvolvement = data.sourceId === this.player?.id || data.targetId === this.player?.id;
        const isHazard = String(data.kind || '').includes('_pool')
            || String(data.kind || '').includes('_zone')
            || String(data.kind || '').includes('_gust')
            || String(data.sourceId || '').startsWith('hazard-');
        const hasNearbyPlayer = (this.isPlayerClassEntity(source) || this.isPlayerClassEntity(target))
            && this.isNearbyCombatEvent(source, target, 38);
        if (!isLocalInvolvement && !isHazard && !hasNearbyPlayer) return false;

        const feedbackKind = this.resolveCombatFeedbackKind(data, source, target, eventType);
        if (!PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS[feedbackKind]) return false;
        const hasProductionEffectScene = Boolean(this.renderSystem?.effectGroup);
        const hasInjectedEffectSpawner = Object.prototype.hasOwnProperty.call(this, 'spawnTransientEffect');
        if (!hasProductionEffectScene && !hasInjectedEffectSpawner) return false;
        if (!this.combatFeedbackCueTimestamps) this.combatFeedbackCueTimestamps = new Map();
        const cueKey = `${eventType}:${feedbackKind}:${data.targetId || 'unknown'}`;
        const now = Date.now();
        const minimumInterval = eventType === 'heal' ? 140 : 80;
        if (now - (this.combatFeedbackCueTimestamps.get(cueKey) || 0) < minimumInterval) return false;

        const position = target.position.clone();
        position.y = Math.max(0.08, Number(position.y) || 0.08);
        const spawned = this.spawnTransientEffect?.('combat_feedback', position, 0xffffff, {
            feedbackKind,
            amount: Math.max(1, Number(data.amount) || 1),
            sourceId: data.sourceId || '',
            targetId: data.targetId || '',
            instanceId: eventInstance
        });
        if (!spawned) return false;
        if (this.combatFeedbackCueTimestamps.size >= 256
            && !this.combatFeedbackCueTimestamps.has(cueKey)) {
            const oldestCue = this.combatFeedbackCueTimestamps.keys().next().value;
            if (oldestCue) this.combatFeedbackCueTimestamps.delete(oldestCue);
        }
        this.combatFeedbackCueTimestamps.set(cueKey, now);
        this.lastCombatFeedbackPresentation = {
            feedbackKind,
            eventType,
            amount: Math.max(1, Number(data.amount) || 1),
            sourceId: data.sourceId || '',
            targetId: data.targetId || '',
            instanceId: eventInstance
        };
        return true;
    }

    handleServerMessage(msg) {
        if (!this.player) return; // Safety check

        if (msg.type === 'chat') {
            const chatData = msg.payload;
            const channel = chatData.channel || (chatData.sender === 'System' ? 'server' : 'global');
            this.uiManager.addChatMessage(chatData.sender, chatData.message, { channel });
        } else if (msg.type === 'inventory') {
            const inventory = msg.payload.map(item => this.hydrateItem(item));
            if (this.player) {
                // Pad with nulls to maintain fixed 25-slot size
                while (inventory.length < 25) {
                    inventory.push(null);
                }
                this.player.inventory = inventory;
                this.uiManager.updateInventory(this.player);
                this.confirmPendingLootPickups(inventory);
            }
        } else if (msg.type === 'stash') {
            const stash = msg.payload.map(item => this.hydrateItem(item));
            if (this.player) {
                // Pad with nulls to maintain fixed 100-slot size
                while (stash.length < 100) {
                    stash.push(null);
                }
                this.player.stash = stash;
                this.uiManager.updateStash(this.player);
            }
        } else if (msg.type === 'buyback_list') {
            if (msg.payload) {
                const buybackItems = msg.payload.map(item => this.hydrateItem(item));
                this.uiManager.updateBuybackList(buybackItems);
            } else {
                this.uiManager.updateBuybackList([]);
            }
        } else if (this.socialController?.handleMessage(msg)) {
            // handled by SocialPresenceController
        } else if (msg.type === 'time') {
            const timeData = msg.payload;
            this.uiManager.updateServerTime(timeData.time);
        } else if (msg.type === 'ability') {
            const abilityData = msg.payload;
            // Ignore if source is local player (we already played the effect locally)
            if (this.player && abilityData.sourceId === this.player.id) return;

            const source = this.remotePlayers.get(abilityData.sourceId);
            if (source) {
                const lookTarget = this.getReplicatedEntityById(abilityData.targetId)?.position
                    || (Number.isFinite(abilityData.targetX) && Number.isFinite(abilityData.targetZ)
                        ? new THREE.Vector3(abilityData.targetX, source.position?.y || 0, abilityData.targetZ)
                        : null);
                if (lookTarget && source.mesh) {
                    source.mesh.lookAt(new THREE.Vector3(lookTarget.x, source.position?.y || 0, lookTarget.z));
                    source.rotation?.copy?.(source.mesh.quaternion);
                }
                if (this.isPlayerClassEntity(source)) {
                    this.beginRemoteActionPresentation(source);
                }
                this.abilityController.triggerRemoteAbilityVisuals(source, abilityData.skillName, abilityData.targetX, abilityData.targetZ);
                this.showRemoteActionReadability(source, abilityData.skillName);
            }
        } else if (msg.type === 'ability_result') {
            const result = msg.payload || {};
            const skillName = result.skillName;
            if (Number.isFinite(result.mana)) {
                this.player.stats.mana = result.mana;
            }
            if (skillName) {
                const remaining = Math.max(0, Number(result.cooldownRemaining) || 0);
                this.player.cooldowns[skillName] = remaining;
                if (skillName === this.player.abilityName) {
                    this.player.abilityCooldown = remaining;
                }
            }
        } else if (msg.type === 'ability_cooldowns') {
            const cooldownState = msg.payload || {};
            Object.keys(this.player.cooldowns || {}).forEach((skillName) => {
                this.player.cooldowns[skillName] = 0;
            });
            Object.entries(cooldownState.cooldowns || {}).forEach(([skillName, remaining]) => {
                this.player.cooldowns[skillName] = Math.max(0, Number(remaining) || 0);
            });
            if (Number.isFinite(cooldownState.mana)) {
                this.player.stats.mana = cooldownState.mana;
            }
            this.player.abilityCooldown = Math.max(
                0,
                Number(this.player.cooldowns?.[this.player.abilityName]) || 0
            );
        } else if (msg.type === 'attack') {
            const attackData = msg.payload;
            if (this.player && attackData.sourceId === this.player.id) return;

            const source = this.remotePlayers.get(attackData.sourceId);
            if (source && this.isPlayerClassEntity(source)) {
                const lookTarget = this.getReplicatedEntityById(attackData.targetId)?.position
                    || (Number.isFinite(attackData.targetX) && Number.isFinite(attackData.targetZ)
                        ? new THREE.Vector3(attackData.targetX, source.position?.y || 0, attackData.targetZ)
                        : null);
                if (lookTarget && source.mesh) {
                    source.mesh.lookAt(new THREE.Vector3(lookTarget.x, source.position?.y || 0, lookTarget.z));
                    source.rotation?.copy?.(source.mesh.quaternion);
                }
                this.beginRemoteActionPresentation(source);
                this.showRemoteActionReadability(source, 'ATTACK');
            }
        } else if (msg.type === 'heal') {
            const healData = msg.payload || {};
            const target = healData.targetId === this.player.id
                ? this.player
                : this.remotePlayers.get(healData.targetId);
            if (target && Number(healData.amount) > 0) {
                this.floatingTextManager.spawn(`+${healData.amount}`, target.position, '#55ff9b');
                this.renderCombatFeedback(healData, 'heal');
            }
        } else if (msg.type === 'projectile_impact') {
            this.renderProjectileImpactFeedback(msg.payload || {});
        } else if (msg.type === 'damage') {
            const dmgData = msg.payload;

            // Find target entity
            let target = null;
            if (this.player && this.player.id === dmgData.targetId) {
                target = this.player;
            } else {
                target = this.remotePlayers.get(dmgData.targetId);
            }

            const sourceEntity = this.remotePlayers.get(dmgData.sourceId);

            if (target) {
                // Only show if player is source or target, or if it's a DoT/hazard effect
                const isHazardDamage = dmgData.sourceId && dmgData.sourceId.startsWith('hazard-');
                if (this.player && (dmgData.sourceId === this.player.id || dmgData.targetId === this.player.id || dmgData.sourceId === 'bleed' || dmgData.sourceId === 'poison' || isHazardDamage)) {
                    let color = '#ffffff';
                    if (dmgData.sourceId === 'bleed') {
                        color = '#8b0000'; // Dark Red for Bleed
                    } else if (dmgData.sourceId === 'poison') {
                        color = '#00ff00'; // Green for Poison
                    } else if (isHazardDamage) {
                        // Color based on hazard type
                        if (dmgData.sourceId.includes('lava')) {
                            color = '#ff4500'; // Orange-Red for Lava
                        } else if (dmgData.sourceId.includes('lightning')) {
                            color = '#00bfff'; // Electric Blue for Lightning
                        } else if (dmgData.sourceId.includes('sandstorm')) {
                            color = '#d2b48c'; // Tan for Sandstorm
                        } else if (dmgData.sourceId.includes('wind')) {
                            color = '#87ceeb'; // Sky Blue for Wind
                        } else {
                            color = '#ff6600'; // Default hazard orange
                        }
                    } else if (target === this.player) {
                        color = '#ff0000'; // Red if player takes damage
                    } else {
                        color = '#ffff00'; // Yellow if player deals damage
                    }

                    this.floatingTextManager.spawn(dmgData.amount, target.position, color);
                } else {
                    this.showNearbyRemoteDamageFeedback(sourceEntity, target, dmgData.amount);
                }
                this.renderCombatFeedback(dmgData, 'damage');
            }

            if (this.player && (dmgData.sourceId === this.player.id || dmgData.targetId === this.player.id)) {
                const amount = Math.max(0, Number(dmgData.amount) || 0);
                this.playAudioCue(AUDIO_CUES.combatHit, { impact: Math.min(1, amount / 80) });
            }

            // If target is local player, flash screen or shake camera?
            if (this.player && dmgData.targetId === this.player.id) {
                // Visual sync: if we took damage from a remote entity, force its ATTACKING animation.
                // This prevents cases where state updates arrive out-of-sync and enemies appear to "run" while hitting.
                if (sourceEntity && sourceEntity.isRemote) {
                    this.beginRemoteActionPresentation(sourceEntity);
                }
                // this.renderSystem.shakeCamera(0.2);
            }
		} else if (msg.type === 'trade_update') {
			this.uiManager.directTrade?.update(msg.payload);
		} else if (msg.type === 'trade_complete') {
			this.uiManager.directTrade?.update(msg.payload, 'complete');
		} else if (msg.type === 'trade_cancel') {
			this.uiManager.directTrade?.update(msg.payload, 'cancelled');
        } else if (msg.type === 'trading_list') {
            if (msg.payload) {
                const auctions = msg.payload.map(auction => ({
                    ...auction,
                    item: this.hydrateItem(auction.item)
                }));
                this.uiManager.trading.renderAuctionList(auctions);
            }
        } else if (msg.type === 'trading_my_list') {
            if (msg.payload) {
                const auctions = msg.payload.map(auction => ({
                    ...auction,
                    item: this.hydrateItem(auction.item)
                }));
                this.uiManager.trading.renderMyAuctions(auctions);
            }
        } else if (msg.type === 'trading_refresh') {
            this.uiManager.trading.handleSearch();
        } else if (msg.type === 'select_rune') {
            // Server sends updated runes after select_rune
            if (this.player && msg.payload && msg.payload.skillRunes) {
                this.player.skillRunes = msg.payload.skillRunes;
                // Refresh runes tab if open
                if (this.uiManager.skillTree.isOpen &&
                    this.uiManager.skillTree.skillTreeMode === 'runes') {
                    const classType = this.player.subType || this.playerType;
                    this.uiManager.skillTree.renderSkillTree(classType);
                }
            }
        } else if (msg.type === 'combo') {
            // Combo triggered notification
            if (this.player && msg.payload) {
                const { playerId, comboId, comboName } = msg.payload;
                // Only show for local player
                if (playerId === this.player.id) {
                    // Show floating text notification
                    if (this.floatingTextManager && this.player.position) {
                        this.floatingTextManager.spawn(`COMBO: ${comboName}!`, this.player.position, '#ffd700');
                    }
                    // Trigger UI notification
                    if (this.uiManager) {
                        this.uiManager.showComboNotification(comboName, comboId);
                    }
                    console.log(`[Combo] Triggered: ${comboName} (${comboId})`);
                }
            }
        } else if (msg.type === 'reward_summary') {
            const summary = msg.payload;
            if (this.player && summary && summary.playerId === this.player.id) {
                if (this.floatingTextManager && this.player.position) {
                    this.floatingTextManager.spawn('BOSS DEFEATED!', this.player.position, '#ffd700', '32px');
                }
                if (this.uiManager && this.uiManager.showRewardSummary) {
                    this.uiManager.showRewardSummary(summary);
                }
            }
        } else if (msg.type === 'room_clear_reward') {
            const summary = msg.payload;
            if (this.player && summary && summary.playerId === this.player.id) {
                if (this.floatingTextManager && this.player.position) {
                    this.floatingTextManager.spawn('ROOM CLEARED!', this.player.position, '#7CFFB2', '26px');
                }
                if (summary?.buffName && Number(summary.buffDurationSeconds) > 0) {
                    this.upsertActiveBuff({
                        id: String(summary.buffName).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                        name: summary.buffName,
                        icon: summary.buffName === 'Sanctuary' ? '🛡️' : '✨',
                        detail: summary.damageReductionPct
                            ? `${summary.damageReductionPct}% DR from shrine blessing`
                            : summary.hint || '',
                        durationSeconds: Number(summary.buffDurationSeconds),
                        expiresAt: Date.now() + (Number(summary.buffDurationSeconds) * 1000)
                    });
                }
                const previousDungeonRoomState = this.currentDungeonRoomState;
                if (this.currentDungeonRoomState) {
                    const updatedRooms = Array.isArray(this.currentDungeonRoomState.rooms)
                        ? this.currentDungeonRoomState.rooms.map((room) => {
                            if (!room || typeof room.index !== 'number') return room;
                            if (typeof summary.roomIndex === 'number' && room.index === summary.roomIndex) {
                                return { ...room, explored: true, cleared: true };
                            }
                            if (typeof summary.objectiveRoomIndex === 'number' && summary.objectiveRoomIndex >= 0 && room.index === summary.objectiveRoomIndex) {
                                return { ...room, explored: true };
                            }
                            return room;
                        })
                        : this.currentDungeonRoomState.rooms;

                    this.currentDungeonRoomState = decorateDungeonRoomState({
                        ...this.currentDungeonRoomState,
                        currentRoomIndex: typeof summary.currentRoomIndex === 'number'
                            ? summary.currentRoomIndex
                            : this.currentDungeonRoomState.currentRoomIndex,
                        objectiveRoomIndex: typeof summary.objectiveRoomIndex === 'number'
                            ? summary.objectiveRoomIndex
                            : this.currentDungeonRoomState.objectiveRoomIndex,
                        rooms: updatedRooms
                    });
                    this.activeWorldGenerator?.updateDungeonRoomState?.(this.currentDungeonRoomState);
                }
                if (this.uiManager && this.uiManager.showRoomClearReward) {
                    this.uiManager.showRoomClearReward(summary);
                }
                const beatAdvanceCallout = this.buildDungeonBeatAdvanceCallout(previousDungeonRoomState, this.currentDungeonRoomState);
                if (beatAdvanceCallout) {
                    this.uiManager?.showCombatCallout?.(beatAdvanceCallout);
                }
            }
        } else if (msg.type === 'telegraph') {
            // Boss AoE telegraph — show a warning circle on the ground
            const data = msg.payload;
            if (data) {
                const pos = new THREE.Vector3(data.x, 0, data.z);
                const threatTier = data.threatTier || 'boss';
                const label = data.label || (threatTier === 'boss' ? 'BOSS' : threatTier === 'lethal' ? 'DANGER' : 'WATCH');
                this.spawnTransientEffect('telegraph', pos, 0xff2200, {
                    radius: data.radius || 10,
                    telegraphDuration: data.duration || 2.0,
                    threatTier,
                    label,
                    theme: data.theme || '',
                    attack: data.attack || ''
                });
                if (this.uiManager?.showCombatCallout) {
                    this.uiManager.showCombatCallout({
                        title: label,
                        tone: threatTier,
                        duration: Number(data.duration || 2.0),
                        subtitle: threatTier === 'boss' ? 'Brace for impact' : 'Incoming attack'
                    });
                }
            }
        } else if (msg.type === 'error') {
            this.uiManager?.quest?.handleQuestActionError?.(msg.payload);
            console.error("Server Error:", msg.payload);

            // Special-case: Inventory full is a common, non-fatal error.
            // If we're in the middle of an auto-retry pickup interaction, stop retrying.
            if (typeof msg.payload === 'string' && msg.payload.toLowerCase().includes('inventory full')) {
                const now = Date.now();

                // Stop the pickup retry loop (auto-walk interact) immediately.
                if (this.pendingInteraction instanceof LootDrop) {
                    this.pendingInteraction = null;
                    if (this.player) {
                        this.player.targetPosition = null;
                        this.player.state = 'IDLE';
                        if (this.player.playAnimation) this.player.playAnimation('Idle');
                    }
                }

                // Show a single, throttled message instead of spamming alert().
                if (now - (this.lastServerInventoryFullTime || 0) > 1000) {
                    this.lastServerInventoryFullTime = now;
                    this.showLootFailureFeedback('inventory_full');
                }
                return;
            }

            if (typeof alert !== 'undefined') {
                alert(`Server Error: ${msg.payload}`);
            }
            if (typeof msg.payload === 'string' && msg.payload.includes("Logged in from another location")) {
                this.network.isExpectedDisconnect = true;
                window.location.reload();
            }
        } else if (msg.type === 'qa_animation_ready') {
            this.animationQAReadySequence = (this.animationQAReadySequence || 0) + 1;
            if (this.player) {
                const lowHealth = Boolean(msg.payload?.lowHealth);
                this.player.abilityCooldown = 0;
                this.player.cooldowns = {};
                if (this.player.stats) {
                    this.player.stats.mana = this.player.stats.maxMana;
                    this.player.stats.hp = lowHealth
                        ? Math.max(1, Math.floor(this.player.stats.maxHp / 4))
                        : this.player.stats.maxHp;
                }
                this.abilityController.inputBuffer.length = 0;
                this.uiManager.updateHotbarCooldowns?.(this.player);
            }
        } else if (msg.type === 'enter_instance') {
            const instanceData = msg.payload;
            console.log(`GameEngine: Received enter_instance. ID: ${instanceData.instanceId}, Type: ${instanceData.type}`);
            void this.enterInstance(instanceData.instanceId, instanceData.type, instanceData.layout, instanceData.roomState || null)
                .catch(e => console.error('Failed to enter instance:', e));
        } else if (msg.type === 'dungeon_room_state') {
            const previousDungeonRoomState = this.currentDungeonRoomState;
            this.currentDungeonRoomState = decorateDungeonRoomState(msg.payload || null);
            this.activeWorldGenerator?.updateDungeonRoomState?.(this.currentDungeonRoomState);
            const beatAdvanceCallout = this.buildDungeonBeatAdvanceCallout(previousDungeonRoomState, this.currentDungeonRoomState);
            if (beatAdvanceCallout) {
                this.uiManager?.showCombatCallout?.(beatAdvanceCallout);
            }
            this.refreshDungeonEntranceHint();
        } else if (msg.type === 'get_dungeon_status') {
            if (this.uiManager) {
                this.uiManager.showDungeonMenu(msg.payload);
            }
        } else if (msg.type === 'state') {
            const state = msg.payload;
            const seenIds = new Set();
            const seenHazardIds = new Set();

            // One-time log on first state message received
            if (!this._firstStateReceived) {
                this._firstStateReceived = true;
                const entityCount = Object.keys(state).length;
                const types = {};
                Object.values(state).forEach(e => { types[e.type] = (types[e.type] || 0) + 1; });
                console.log(`First state received: ${entityCount} entities`, types);
                // Request initial friend list on login (0.38.1).
                if (this.isMultiplayer) this.network.send('friend_list', {});
                if (this.isMultiplayer) this.network.send('guild_get', {});
            }

            // Debug log for entity count (throttled)
            if (this.frameCount % 600 === 0) {
                console.log(`Received state with ${Object.keys(state).length} entities`);
            }

            // Update remote players
            Object.values(state).forEach(pData => {
                this.applyPositionHacks(pData);

                seenIds.add(pData.id);

                // Hazards are intentionally managed outside remotePlayers. Handle
                // them before generic entity sync so repeated full snapshots do
                // not recreate and orphan a second set of animated meshes.
                if (pData.type === 'Hazard') {
                    seenHazardIds.add(pData.id);
                    this.syncEnvironmentalHazardSnapshot(pData);
                    return;
                }

                if (pData.id === this.player.id) {
                    // Update local player stats from server
                    if (this.player) {
                        // Initialize currentInstanceId if null (first connection)
                        if (!this.currentInstanceId && pData.instanceId) {
                            this.currentInstanceId = pData.instanceId;
                        }

                        const previousX = this.player.position?.x;
                        const previousZ = this.player.position?.z;

                        // Check for instance mismatch (ignore stale state updates during transition)
                        if (pData.instanceId && this.currentInstanceId && pData.instanceId !== this.currentInstanceId) {
                            // console.log(`Ignoring state update from wrong instance: ${pData.instanceId} vs ${this.currentInstanceId}`);
                            return;
                        }

                        let justRespawned = false;

                        // Sync State
                        const nextHp = pData.health !== undefined ? pData.health : this.player.stats?.hp;
                        const hasPredictedJump = !!this.playerJumpState && !this.playerJumpState.serverDriven;
                        const hasPredictedAttack = this.shouldPreservePredictedPlayerAttack(pData.state);
                        const hasPredictedMovement = this.shouldPreservePredictedPlayerMovement(pData.state);
                        if (pData.state !== undefined) {
                            if (this.player.state !== 'DEAD' && (pData.state === 'DEAD' || (nextHp !== undefined && nextHp <= 0))) {
                                this.handlePlayerDeathTransition();
                            } else if (this.player.state === 'DEAD' && pData.state !== 'DEAD') {
                                if (nextHp !== undefined && nextHp <= 0) {
                                    this.handlePlayerDeathTransition();
                                } else {
                                    // Revived?
                                    // Force town spawn (-1.25, 200) to ensure immediate visual feedback
                                    const x = -1.25;
                                    const z = 200;

                                    console.log(`GameEngine: Respawn detected. Teleporting to Town (${x}, ${z})`);
                                    this.player.respawn(x, z);
                                    this.player.state = pData.state; // Ensure state matches server
                                    this.player.timeSinceDeath = null;

                                    this.chunkManager.updateEntityChunk(this.player);
                                    this.renderSystem.setCameraTarget(this.player.position);
                                    this.announceRespawnRecovery('state');
                                    this.syncTownRecoveryGuidance(previousX, previousZ, this.player.position.x, this.player.position.z, 'respawn');
                                    justRespawned = true;
                                }
                            } else if (!(hasPredictedJump && pData.state !== 'JUMPING') &&
                                !hasPredictedAttack && !hasPredictedMovement) {
                                this.player.state = pData.state;
                            }
                        } else if (pData.health !== undefined && pData.health <= 0 && this.player.state !== 'DEAD') {
                            // Some delta/full packets can arrive with HP updates before/without state.
                            // Ensure local death presentation still triggers when health reaches zero.
                            this.handlePlayerDeathTransition();
                        }
                        if (pData.isCharging !== undefined) this.player.isCharging = pData.isCharging;

                        // Check for forced teleport (large distance discrepancy)
                        // This handles portals or admin teleports where state might not change from DEAD

                        if (pData.state === 'JUMPING') {
                            this.syncAuthoritativeJumpState(this.player, pData);
                        } else if (pData.state !== undefined) {
                            this.clearAuthoritativeJumpState(this.player);
                        }

                        if (!justRespawned && pData.x !== undefined && pData.z !== undefined) {
                            const serverPos = new THREE.Vector3(pData.x, pData.y || 0, pData.z);
                            const horizontalPos = new THREE.Vector3(pData.x, this.player.position.y, pData.z);
                            const dist = this.player.position.distanceTo(horizontalPos);
                            const correctionReason = this.getLocalPositionCorrectionReason(pData, serverPos, dist);
                            if (correctionReason) {
                                const previousPosition = this.player.position.clone();
                                console.log(`GameEngine: Applying ${correctionReason} position correction. Dist: ${dist}, Server: ${serverPos.x},${serverPos.z}, Client: ${this.player.position.x},${this.player.position.z}`);
                                if (pData.state === 'JUMPING') {
                                    this.player.position.x = serverPos.x;
                                    this.player.position.z = serverPos.z;
                                } else {
                                    this.player.position.copy(serverPos);
                                    this.beginPlayerCorrectionVisual(previousPosition, serverPos);
                                }
                                this.player.targetPosition = null;
                                this.chunkManager.updateEntityChunk(this.player);
                                this.renderSystem.setCameraTarget(this.player.position);
                            }
                        }
                        if (!justRespawned && pData.x !== undefined && pData.z !== undefined) {
                            this.syncTownRecoveryGuidance(previousX, previousZ, this.player.position.x, this.player.position.z);
                        }


                        const previousXP = this.player.xp;
                        const previousLevel = this.player.level;
                        const hadSyncedProgress = Boolean(this.player.hasSyncedLevel);

                        this.player.xp = pData.experience;
                        this.player.xpToNextLevel = pData.maxExperience;

                        // Level Up Detection
                        if (this.player.level < pData.level) {
                            // Only trigger if we have synced at least once (avoid login level up)
                            if (this.player.hasSyncedLevel) {
                                console.log(`Level Up! ${this.player.level} -> ${pData.level}`);
                                this.handleLevelUpFeedback(this.player.level, pData.level);
                            }
                            this.player.level = pData.level;
                        } else {
                            this.player.level = pData.level;
                        }
                        this.player.hasSyncedLevel = true;
                        this.announceExperienceGain(
                            previousXP,
                            this.player.xp,
                            previousLevel,
                            this.player.level,
                            hadSyncedProgress
                        );

                        if (this.player.stats) {
                            if (pData.scale !== undefined && this.player.scale !== pData.scale) this.player.setScale(pData.scale);
                            this.player.stats.hp = pData.health;
                            this.player.stats.maxHp = pData.maxHealth;
                            this.player.stats.mana = pData.mana;
                            this.player.stats.maxMana = pData.maxMana;

                            // Sync Attributes from Server
                            if (pData.stats) {
                                this.player.stats.strength = pData.stats.strength;
                                this.player.stats.dexterity = pData.stats.dexterity;
                                this.player.stats.intelligence = pData.stats.intelligence;
                                this.player.stats.wisdom = pData.stats.wisdom;
                                this.player.stats.vitality = pData.stats.vitality;
                            }
                            if (pData.baseStats) {
                                this.player.baseStats.strength = pData.baseStats.strength;
                                this.player.baseStats.dexterity = pData.baseStats.dexterity;
                                this.player.baseStats.intelligence = pData.baseStats.intelligence;
                                this.player.baseStats.wisdom = pData.baseStats.wisdom;
                                this.player.baseStats.vitality = pData.baseStats.vitality;
                            }

                            // Sync Derived Stats
                            if (pData.damage !== undefined) this.player.stats.damage = pData.damage;
                            if (pData.defense !== undefined) this.player.stats.defense = pData.defense;
                            if (pData.speed !== undefined) this.player.stats.speed = pData.speed;
                            if (pData.attackSpeed !== undefined) this.player.stats.attackSpeed = pData.attackSpeed;
                            if (pData.cooldownReduction !== undefined) this.player.stats.cooldownReduction = pData.cooldownReduction;
                            if (pData.hpRegen !== undefined) this.player.stats.hpRegen = pData.hpRegen;
                            if (pData.manaRegen !== undefined) this.player.stats.manaRegen = pData.manaRegen;
                            if (pData.castSpeed !== undefined) this.player.stats.castSpeed = pData.castSpeed;
                        }

                        // Sync Skills
                        const prevBranch = this.player.selectedBranch;
                        const prevPoints = this.player.skillPoints;
                        const prevUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;

                        // Sync Talents
                        const prevTalentPoints = this.player.talentPoints || 0;
                        const talentSig = (ranks) => {
                            if (!ranks) return '0:0';
                            let keys = 0;
                            let sum = 0;
                            for (const k in ranks) {
                                const v = ranks[k] | 0;
                                if (v > 0) { keys++; sum += v; }
                            }
                            return `${keys}:${sum}`;
                        };
                        const prevTalentSig = talentSig(this.player.talentRanks);

                        this.player.skillPoints = pData.skillPoints;
                        this.player.selectedBranch = pData.selectedBranch;
                        this.player.unlockedSkills = pData.unlockedSkills;

                        // Server-authoritative talents: always apply the decoded values.
                        // (Proto3 defaults will decode as 0/empty when truly unset.)
                        if (pData.talentPoints !== undefined) this.player.talentPoints = pData.talentPoints;
                        if (pData.talentRanks !== undefined) this.player.talentRanks = pData.talentRanks || {};
                        if (pData.unlockedTalents !== undefined) this.player.unlockedTalents = pData.unlockedTalents || [];

                        // Server-authoritative skill runes
                        if (pData.skillRunes !== undefined) this.player.skillRunes = pData.skillRunes || {};

                        const currUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;

                        // Update Hotbar if skills changed or if we have skills but hotbar is empty
                        const isHotbarEmpty = !this.player.hotbar || this.player.hotbar.every(s => !s);
                        if (prevUnlocked !== currUnlocked || prevBranch !== this.player.selectedBranch || (currUnlocked > 0 && isHotbarEmpty)) {
                            console.log(`Updating Hotbar: Skills=${currUnlocked}, Branch=${this.player.selectedBranch}, Empty=${isHotbarEmpty}`);
                            this.uiManager.updateHotbar(this.player);
                        }

                        // Refresh Skill Tree if open and data changed
                        if (this.uiManager.skillTree.isOpen) {
                             if (prevBranch !== this.player.selectedBranch ||
                                 prevPoints !== this.player.skillPoints ||
                                 prevUnlocked !== currUnlocked ||
                                 prevTalentPoints !== (this.player.talentPoints || 0) ||
                                 prevTalentSig !== talentSig(this.player.talentRanks)) {
                                     const classType = this.player.subType || this.playerType;
                                     this.uiManager.skillTree.renderSkillTree(classType);
                             }
                        }

                        // Sync Equipment
                        if (pData.equipment) {
                            this.player.equipment = pData.equipment;
                            // Hydrate Rarity for UI
                            for (const key in this.player.equipment) {
                                this.player.equipment[key] = this.hydrateItem(this.player.equipment[key]);
                            }
                            this.player.syncEquipmentVisuals?.();

                            // Force UI Update if Forge is open
                            if (this.uiManager.forge.isOpen) {
                                this.uiManager.forge.updateForgeUI(this.player);
                                this.uiManager.forge.updateForgePotencyUI(this.player);
                                this.uiManager.forge.updateForgeSocketUI(this.player);

                                // Update selected item info if any
                                if (this.uiManager.forge.selectedForgeSlot) {
                                    const item = this.player.equipment[this.uiManager.forge.selectedForgeSlot];
                                    this.uiManager.forge.updateForgeInfo(item);
                                }
                                if (this.uiManager.forge.selectedForgePotencySlot) {
                                    const item = this.player.equipment[this.uiManager.forge.selectedForgePotencySlot];
                                    this.uiManager.forge.updateForgePotencyInfo(item);
                                }
                                if (this.uiManager.forge.selectedForgeSocketSlot) {
                                    const item = this.player.equipment[this.uiManager.forge.selectedForgeSocketSlot];
                                    this.uiManager.forge.updateForgeSocketInfo(item);
                                }
                            }
                        }

                        if (Object.prototype.hasOwnProperty.call(pData, 'quests')) {
                            this.player.quests = Array.isArray(pData.quests) ? pData.quests : [];
                            this.uiManager.updateQuestWindow?.(this.player.quests);
                            this.uiManager.updateJournal?.(this.player.quests);
                        }

                        this.syncPlayerSupportEffects(this.player, pData);
                        this.syncPlayerStatusClears(this.player, pData);
                        this.syncPlayerStatusDetails(this.player, pData);

                        // Optimization: Only update UI if values changed
                        if (this.player.xp !== this.lastXP || this.player.xpToNextLevel !== this.lastMaxXP || this.player.level !== this.lastLevel) {
                            console.log(`Updating XP/Level UI: Level=${this.player.level}, XP=${this.player.xp}`);
                            this.uiManager.updateXP(this.player);
                            this.lastXP = this.player.xp;
                            this.lastMaxXP = this.player.xpToNextLevel;
                            this.lastLevel = this.player.level;
                        }

                        // Check stats change (simple heuristic or deep compare)
                        // We can just check a few key stats or use a dirty flag if we had one
                        // For now, let's just throttle it to once per second or check key values
                        const currentStatsHash = `${this.player.stats.hp}/${this.player.stats.maxHp}/${this.player.stats.mana}/${this.player.stats.strength}`;
                        if (currentStatsHash !== this.lastStatsHash) {
                            this.uiManager.updateCharacterSheet(this.player);
                            this.uiManager.updatePlayerStats(this.player);
                            this.lastStatsHash = currentStatsHash;
                        }

                        // Update Gold
                        if (pData.gold !== undefined && pData.gold !== this.lastGold) {
                            this.player.gold = pData.gold;
                            this.uiManager.updateInventory(this.player);
                            this.lastGold = pData.gold;
                        }

                        // Party highlight (0.37.2): track local player's partyId from state stream.
                        if (pData.partyId !== undefined) {
                            this.socialController?.setMyPartyId(pData.partyId);
                        }
                    }
                    this.syncDeathScreen();
                    return; // Skip self
                }

                let remoteEntity = this.remotePlayers.get(pData.id);
                if (!remoteEntity) {
                    this.queueEntityCreation(pData);
                    this.syncDeathScreen();
                    return;
                }

                this.syncRemoteEntity(remoteEntity, pData);
            });

            // Cleanup removed entities
            for (const [id] of this.remotePlayers) {
                if (!seenIds.has(id)) {
                    this.removeRemoteEntity(id);
                }
            }
            this.reconcileEnvironmentalHazards(seenHazardIds);
            this.reconcilePendingEntitySnapshot(seenIds);
        } else if (msg.type === 'delta') {
            // Delta compression: Only changed entities and removals
            const delta = msg.payload;
            const updates = delta.u || {};  // Updated/new entities
            const removed = delta.r || [];  // Removed entity IDs

            // Process updated entities
            Object.values(updates).forEach(pData => {
                this.applyPositionHacks(pData);

                if (pData.type === 'Hazard') {
                    this.syncEnvironmentalHazardSnapshot(pData);
                    return;
                }

                // Skip self - local player updates come through full state messages
                if (pData.id === this.player.id) {
                    // Still update critical player state from delta
                    if (this.player && this.player.stats) {
                        const previousX = this.player.position?.x;
                        const previousZ = this.player.position?.z;
                        const nextHp = pData.health !== undefined ? pData.health : this.player.stats.hp;
                        const hasPredictedJump = !!this.playerJumpState && !this.playerJumpState.serverDriven;
                        const hasPredictedAttack = this.shouldPreservePredictedPlayerAttack(pData.state);
                        const hasPredictedMovement = this.shouldPreservePredictedPlayerMovement(pData.state);
                        if (pData.state !== undefined) {
                            if (this.player.state !== 'DEAD' && (pData.state === 'DEAD' || (nextHp !== undefined && nextHp <= 0))) {
                                this.handlePlayerDeathTransition();
                            } else if (this.player.state === 'DEAD' && pData.state !== 'DEAD') {
                                if (nextHp !== undefined && nextHp <= 0) {
                                    this.handlePlayerDeathTransition();
                                } else {
                                    const x = pData.x !== undefined ? pData.x : -1.25;
                                    const z = pData.z !== undefined ? pData.z : 200;
                                    console.log(`GameEngine: Respawn detected from delta. Teleporting to (${x}, ${z})`);
                                    this.player.respawn(x, z);
                                    this.player.state = pData.state;
                                    this.player.timeSinceDeath = null;
                                    this.chunkManager.updateEntityChunk(this.player);
                                    this.renderSystem.setCameraTarget(this.player.position);
                                    this.chunkManager.update(this.player, 0, this.collisionManager);
                                    this.announceRespawnRecovery('delta');
                                    this.syncTownRecoveryGuidance(previousX, previousZ, this.player.position.x, this.player.position.z, 'respawn');
                                }
                            } else if (!(hasPredictedJump && pData.state !== 'JUMPING') &&
                                !hasPredictedAttack && !hasPredictedMovement) {
                                this.player.state = pData.state;
                            }
                        }
                        if (pData.isCharging !== undefined) this.player.isCharging = pData.isCharging;

                        if (pData.state === 'JUMPING') {
                            this.syncAuthoritativeJumpState(this.player, pData);
                        } else if (pData.state !== undefined) {
                            this.clearAuthoritativeJumpState(this.player);
                        }

                        if (pData.x !== undefined && pData.z !== undefined) {
                            const serverPos = new THREE.Vector3(pData.x, pData.y || 0, pData.z);
                            const horizontalPos = new THREE.Vector3(pData.x, this.player.position.y, pData.z);
                            const dist = this.player.position.distanceTo(horizontalPos);
                            // Normal prediction differs by only a fraction of a
                            // movement step. Correct larger drift before stale
                            // chase input can visually undo a server teleport.
                            const correctionReason = this.getLocalPositionCorrectionReason(pData, serverPos, dist);
                            if (correctionReason) {
                                const previousPosition = this.player.position.clone();
                                console.log(`GameEngine: Applying ${correctionReason} self correction from delta. Dist: ${dist}`);
                                if (pData.state === 'JUMPING') {
                                    this.player.position.x = serverPos.x;
                                    this.player.position.z = serverPos.z;
                                } else {
                                    this.player.position.copy(serverPos);
                                    this.beginPlayerCorrectionVisual(previousPosition, serverPos);
                                }
                                this.player.targetPosition = null;
                                this.chunkManager.updateEntityChunk(this.player);
                                this.renderSystem.setCameraTarget(this.player.position);
                            }
                        }
                        if (pData.x !== undefined && pData.z !== undefined) {
                            this.syncTownRecoveryGuidance(previousX, previousZ, this.player.position.x, this.player.position.z);
                        }

                        if (pData.scale !== undefined && this.player.scale !== pData.scale) this.player.setScale(pData.scale);
                        if (pData.health !== undefined) this.player.stats.hp = pData.health;
                        if (pData.maxHealth !== undefined) this.player.stats.maxHp = pData.maxHealth;
                        if (pData.mana !== undefined) this.player.stats.mana = pData.mana;
                        if (pData.maxMana !== undefined) this.player.stats.maxMana = pData.maxMana;

                        if (pData.state === undefined && pData.health !== undefined && pData.health <= 0 && this.player.state !== 'DEAD') {
                            this.handlePlayerDeathTransition();
                        }

                        // Sync Attributes from Server
                        if (pData.stats) {
                            this.player.stats.strength = pData.stats.strength;
                            this.player.stats.dexterity = pData.stats.dexterity;
                            this.player.stats.intelligence = pData.stats.intelligence;
                            this.player.stats.wisdom = pData.stats.wisdom;
                            this.player.stats.vitality = pData.stats.vitality;
                        }
                        if (pData.baseStats) {
                            this.player.baseStats.strength = pData.baseStats.strength;
                            this.player.baseStats.dexterity = pData.baseStats.dexterity;
                            this.player.baseStats.intelligence = pData.baseStats.intelligence;
                            this.player.baseStats.wisdom = pData.baseStats.wisdom;
                            this.player.baseStats.vitality = pData.baseStats.vitality;
                        }

                        // Sync Derived Stats
                        if (pData.damage !== undefined) this.player.stats.damage = pData.damage;
                        if (pData.defense !== undefined) this.player.stats.defense = pData.defense;
                        if (pData.speed !== undefined) this.player.stats.speed = pData.speed;
                        if (pData.attackSpeed !== undefined) this.player.stats.attackSpeed = pData.attackSpeed;
                        if (pData.cooldownReduction !== undefined) this.player.stats.cooldownReduction = pData.cooldownReduction;
                        if (pData.hpRegen !== undefined) this.player.stats.hpRegen = pData.hpRegen;
                        if (pData.manaRegen !== undefined) this.player.stats.manaRegen = pData.manaRegen;
                        if (pData.castSpeed !== undefined) this.player.stats.castSpeed = pData.castSpeed;
                        this.syncPlayerSupportEffects(this.player, pData);
                        this.syncPlayerStatusClears(this.player, pData);
                        this.syncPlayerStatusDetails(this.player, pData);
                    }

                    // Sync Skills
                    if (pData.selectedBranch !== undefined || pData.unlockedSkills !== undefined || pData.skillPoints !== undefined) {
                        const prevBranch = this.player.selectedBranch;
                        const prevPoints = this.player.skillPoints;
                        const prevUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;

                        if (pData.skillPoints !== undefined) this.player.skillPoints = pData.skillPoints;
                        if (pData.selectedBranch !== undefined) this.player.selectedBranch = pData.selectedBranch;
                        if (pData.unlockedSkills !== undefined) this.player.unlockedSkills = pData.unlockedSkills;

                        const currUnlocked = this.player.unlockedSkills ? this.player.unlockedSkills.length : 0;

                        // Update Hotbar if skills changed
                        const isHotbarEmpty = !this.player.hotbar || this.player.hotbar.every(s => !s);
                        if (prevUnlocked !== currUnlocked || prevBranch !== this.player.selectedBranch || (currUnlocked > 0 && isHotbarEmpty)) {
                            console.log(`[Delta] Updating Hotbar: Skills=${currUnlocked}, Branch=${this.player.selectedBranch}`);
                            this.uiManager.updateHotbar(this.player);
                        }

                        // Refresh Skill Tree if open
                        if (this.uiManager.skillTree.isOpen) {
                            if (prevBranch !== this.player.selectedBranch ||
                                prevPoints !== this.player.skillPoints ||
                                prevUnlocked !== currUnlocked) {
                                const classType = this.player.subType || this.playerType;
                                this.uiManager.skillTree.renderSkillTree(classType);
                            }
                        }
                    }

                    // Sync Talents (delta path)
                    if (pData.talentPoints !== undefined || pData.talentRanks !== undefined || pData.unlockedTalents !== undefined) {
                        const prevTalentPoints = this.player.talentPoints || 0;
                        const talentSig = (ranks) => {
                            if (!ranks) return '0:0';
                            let keys = 0;
                            let sum = 0;
                            for (const k in ranks) {
                                const v = ranks[k] | 0;
                                if (v > 0) { keys++; sum += v; }
                            }
                            return `${keys}:${sum}`;
                        };
                        const prevTalentSig = talentSig(this.player.talentRanks);

                        // Server-authoritative talents: always apply the decoded values.
                        if (pData.talentPoints !== undefined) this.player.talentPoints = pData.talentPoints;
                        if (pData.talentRanks !== undefined) this.player.talentRanks = pData.talentRanks || {};
                        if (pData.unlockedTalents !== undefined) this.player.unlockedTalents = pData.unlockedTalents || [];

                        if (this.uiManager.skillTree.isOpen) {
                            if (prevTalentPoints !== (this.player.talentPoints || 0) ||
                                prevTalentSig !== talentSig(this.player.talentRanks)) {
                                const classType = this.player.subType || this.playerType;
                                this.uiManager.skillTree.renderSkillTree(classType);
                            }
                        }
                    }

                    if (pData.skillRunes !== undefined) {
                        this.player.skillRunes = pData.skillRunes || {};
                    }

                    // Sync XP, Level, Gold
                    // Protobuf entity fields use experience/maxExperience; legacy JSON used xp/xpToNextLevel.
                    const previousXP = this.player.xp;
                    const previousLevel = this.player.level;
                    const hadSyncedProgress = Boolean(this.player.hasSyncedLevel);
                    if (pData.experience !== undefined) this.player.xp = pData.experience;
                    if (pData.maxExperience !== undefined) this.player.xpToNextLevel = pData.maxExperience;
                    if (pData.xp !== undefined) this.player.xp = pData.xp;
                    if (pData.xpToNextLevel !== undefined) this.player.xpToNextLevel = pData.xpToNextLevel;

                    // Level Up Detection (delta path)
                    if (pData.level !== undefined) {
                        if (this.player.level < pData.level) {
                            if (this.player.hasSyncedLevel) {
                                console.log(`Level Up! ${this.player.level} -> ${pData.level}`);
                                this.handleLevelUpFeedback(this.player.level, pData.level);
                            }
                            this.player.level = pData.level;
                        } else {
                            this.player.level = pData.level;
                        }
                        this.player.hasSyncedLevel = true;
                    }
                    this.announceExperienceGain(
                        previousXP,
                        this.player.xp,
                        previousLevel,
                        this.player.level,
                        hadSyncedProgress
                    );

                    if (pData.gold !== undefined) this.player.gold = pData.gold;

                    // Party highlight (0.37.2): track local player's partyId from delta stream.
                    if (pData.partyId !== undefined) {
                        this.socialController?.setMyPartyId(pData.partyId);
                    }

                    // Keep XP/Level UI responsive when updates arrive via delta.
                    if (this.player.xp !== this.lastXP || this.player.xpToNextLevel !== this.lastMaxXP || this.player.level !== this.lastLevel) {
                        console.log(`Updating XP/Level UI: Level=${this.player.level}, XP=${this.player.xp}`);
                        this.uiManager.updateXP(this.player);
                        this.lastXP = this.player.xp;
                        this.lastMaxXP = this.player.xpToNextLevel;
                        this.lastLevel = this.player.level;
                    }

                    // Sync Inventory
                    if (pData.inventory !== undefined) {
                        const inventory = Array.isArray(pData.inventory) ? [...pData.inventory] : [];
                        while (inventory.length < 25) {
                            inventory.push(null);
                        }
                        this.player.inventory = inventory;
                        for (let i = 0; i < this.player.inventory.length; i++) {
                            this.player.inventory[i] = this.hydrateItem(this.player.inventory[i]);
                        }
                        this.uiManager.updateInventory(this.player);
                    }

                    // Sync Equipment
                    if (pData.equipment) {
                        this.player.equipment = pData.equipment;
                        for (const key in this.player.equipment) {
                            this.player.equipment[key] = this.hydrateItem(this.player.equipment[key]);
                        }
                        this.player.syncEquipmentVisuals?.();
                    }

                    if (Object.prototype.hasOwnProperty.call(pData, 'quests')) {
                        this.player.quests = Array.isArray(pData.quests) ? pData.quests : [];
                        this.uiManager.updateQuestWindow?.(this.player.quests);
                        this.uiManager.updateJournal?.(this.player.quests);
                    }

                    return;
                }

                const remoteEntity = this.remotePlayers.get(pData.id);
                if (!remoteEntity) {
                    this.queueEntityCreation(pData);
                    return;
                }

                this.syncRemoteEntity(remoteEntity, pData);
            });

            // Process removed entities
            for (const id of removed) {
                this.cancelPendingEntityCreation(id);
                // Check if it's a hazard first
                if (this.hazards.has(id)) {
                    this.removeEnvironmentalHazard(id);
                    continue;
                }

                this.removeRemoteEntity(id);
            }
        } else if (msg.type === 'raid_phase') {
            const phase = msg.payload || {};
            this.uiManager?.showCombatCallout?.({
                title: phase.title || `Resonance Phase ${phase.phase || ''}`,
                subtitle: `${phase.eidolon || 'An Eidolon'} · ${phase.effect || 'The resonance answers.'}`,
                tone: phase.phase >= 4 ? 'victory' : phase.phase >= 3 ? 'danger' : 'boss',
                duration: 8
            });
            this.uiManager?.addGameMessage?.('Dark King', phase.dialogue || 'The Dark Realm trembles.');
            this.uiManager?.addGameMessage?.('Resonance', phase.effect || 'The Eidolons answer your call.');
            if (this.player?.position && this.floatingTextManager) {
                this.floatingTextManager.spawn(`${phase.element || 'Resonance'}: ${phase.eidolon || 'Eidolon'}`, this.player.position, phase.color || '#dfb5ff', '26px');
            }
        } else if (msg.type === 'crystal_repair') {
            const repair = msg.payload || {};
            const completed = repair.stage === 'complete';
            this.uiManager?.showCombatCallout?.({
                title: repair.title || `${repair.crystal || repair.element || 'Crystal'} Repair`,
                subtitle: repair.hint || repair.dialogue || 'Defend the ritual circle.',
                tone: completed ? 'victory' : repair.stage === 'wave_start' ? 'danger' : 'boss',
                duration: completed ? 8 : 5
            });
            if (repair.dialogue) this.uiManager?.addGameMessage?.('Maelin', repair.dialogue.replace(/^Maelin:\s*/, ''));
            if (repair.wave > 0 && !completed) {
                this.uiManager?.addGameMessage?.('Crystal Vigil', `${repair.element} repair: wave ${repair.wave} of ${repair.totalWaves || 3} · ${repair.progress || 0}% aligned.`);
            }
        } else if (msg.type === 'chronicle_advance') {
            const chapter = msg.payload || {};
            const finale = Boolean(chapter.finale);
            this.uiManager?.showCombatCallout?.({
                title: finale ? 'THE CHRONICLE IS COMPLETE' : `CHAPTER COMPLETE · ${chapter.completedTitle || 'The Chronicle'}`,
                subtitle: finale
                    ? 'Malachar has fallen. The four crystals sing as one.'
                    : `New chapter: ${chapter.nextTitle || 'The resonance continues'}`,
                tone: finale ? 'victory' : 'boss',
                duration: 6
            });
            this.uiManager?.addGameMessage?.(
                'Chronicle',
                finale
                    ? 'Malachar, the Dark King, is defeated. Earth, Water, Fire, and Air have reclaimed their covenant.'
                    : `${chapter.completedTitle || 'Chapter complete'} — Next: ${chapter.nextTitle || 'follow the resonance'}.`
            );
            if (!finale && chapter.nextLore) {
                this.uiManager?.addGameMessage?.('Recovered Lore', chapter.nextLore);
            }
        } else if (msg.type === 'quest_update') {
            const quests = msg.payload;
            if (this.player) {
                this.player.quests = quests;
                this.uiManager.updateQuestWindow(quests);
                this.uiManager.updateJournal(quests);
            }
        }
    }

    // ------------------------------------------------------------------
    // Shared helpers for state/delta remote-entity sync
    // ------------------------------------------------------------------

    /**
     * Apply position-override hacks for entities whose server coords
     * are known to be stale / incorrect.
     * @param {Object} pData  Entity payload (mutated in-place)
     */
}

export function installGameEngineNetworkMessages(targetClass) {
    installPrototypeMethods(targetClass, GameEngineNetworkMessageMethods);
}
