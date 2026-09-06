import * as THREE from 'three';
import { getProjectileImpactRadius } from '../skills/abilityRadii.js';
import { Actor } from '../entities/Actor.js';
import { DungeonNPC } from '../entities/DungeonNPC.js';
import { DwarfSalesman } from '../entities/DwarfSalesman.js';
import { EnvironmentalHazard } from '../entities/EnvironmentalHazard.js';
import { Fence } from '../entities/Fence.js';
import { Forge } from '../entities/Forge.js';
import { LootDrop } from '../entities/LootDrop.js';
import { Projectile } from '../entities/Projectile.js';
import { QuestNPC } from '../entities/QuestNPC.js';
import { RespecNPC } from '../entities/RespecNPC.js';
import { Stash } from '../entities/Stash.js';
import { TradingHouse } from '../entities/TradingHouse.js';
import {
    MAX_FRAME_SIMULATION_DELTA,
    POINTER_RAYCAST_INTERVAL
} from './GameEngineRuntimeConstants.js';
import { installPrototypeMethods } from './PrototypeInstaller.js';

class GameEngineRuntimeMethods {
    loop(time) {
        try {
            const seconds = time * 0.001;
            // Catch-up logic: If we are too far behind (e.g. tab backgrounded), jump ahead
            if (seconds - this.lastTime > 1.0) {
                console.log("GameEngine: Large lag spike detected, skipping simulation catch-up.");
                this.lastTime = seconds;
                this.accumulator = 0;
                // Force a render to update positions from any pending network messages
                this.render(1.0);
                return;
            }

            const dt = Math.min(seconds - this.lastTime, MAX_FRAME_SIMULATION_DELTA);
            this.lastTime = seconds;

            this.accumulator += dt;

            while (this.accumulator >= this.fixedTimeStep) {
                this.update(this.fixedTimeStep);
                this.accumulator -= this.fixedTimeStep;
            }

            const alpha = this.accumulator / this.fixedTimeStep;
            this.render(alpha);
        } catch (err) {
            console.error("GameEngine Loop Error:", err);
            // Drop any accumulated catch-up work after a failed tick. Keeping
            // it would immediately replay the same stale simulation window
            // and turn a recoverable entity/effect error into a frame spiral.
            this.accumulator = 0;
        } finally {
            // One bad update used to terminate requestAnimationFrame forever,
            // which made the entire world appear frozen. Keep the frame pump
            // alive so transient failures can recover on the next tick.
            if (!this.isDestroyed) {
                this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
            }
        }
    }

    destroy() {
        console.log("GameEngine: Destroying instance...");
        this.isDestroyed = true;
        this.clearCombatIntentState();
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.inputManager) {
            this.inputManager.dispose();
        }

        this.uiManager?.characterPreview?.dispose();
        this.uiManager?.windowLayoutObserver?.disconnect();
        this.uiManager?.chat?.sizeObserver?.disconnect();

        if (this.renderSystem) {
            this.renderSystem.dispose();
        }

        // Close socket if it was created internally (not passed in)
        // But here we usually pass it in. If we want to reuse it, we shouldn't close it.
        // The main.js logic reuses the socket.
    }


    update(dt) {
        this.frameCount++;
        this.activeWorldGenerator?.updateDungeonPresentation?.(dt);

        // Manual movement owns this tick before buffered casts, actor movement
        // and pursuit can execute. The joystick's start callback clears older
        // buffered inputs once; preserve new casts requested while moving.
        if (this.isMobile && this.player && !this.isPlayerDead()
            && !this.playerJumpState && this.player.state !== 'JUMPING'
            && this.inputManager.getMovementDirection().lengthSq() > 0) {
            this.cancelMobilePursuit(false);
        }

        // Process Input Buffer
        this.abilityController.processInputBuffer();

        // Cleanup Rogue Stashes and Quest NPCs (Fix for extra entities at 0,0,0)
        if (this.frameCount % 60 === 0) {
            const activeEntities = this.chunkManager.getActiveEntities();
            let stashCount = 0;
            let questNpcCount = 0;

            // Use a copy or be careful about modification during iteration
            // activeEntities is an array copy from ChunkManager, so it's safe to iterate
            // but removing from ChunkManager won't affect this array immediately

            for (const entity of activeEntities) {
                // Stash Cleanup
                if (entity instanceof Stash) {
                    // Allow server stashes (stash-1) and local stash (stash-local)
                    if (entity.id === 'stash-local') {
                        stashCount++;
                        if (stashCount > 1) {
                             console.warn(`Removing duplicate stash-local`);
                             this.chunkManager.removeEntity(entity);
                        } else if (entity.position.lengthSq() < 1) {
                             console.warn(`Fixing stash-local position from 0,0,0 to 0,0,185`);
                             entity.position.set(0, 0, 185);
                             this.chunkManager.updateEntityChunk(entity);
                        }
                    }
                }

                // QuestNPC Cleanup
                if (entity instanceof QuestNPC) {
                    // Allow server quest npc (quest-npc-1) and local (quest-npc-local)
                    if (!['quest-npc-local', 'quest-npc-1', 'story-wizard-1', 'story-wizard-local'].includes(entity.id)) {
                        console.warn(`Removing rogue QuestNPC entity: ${entity.id} at ${entity.position.x}, ${entity.position.z}`);
                        this.chunkManager.removeEntity(entity);
                    } else if (entity.id === 'quest-npc-local') {
                        questNpcCount++;
                        if (questNpcCount > 1) {
                             console.warn(`Removing duplicate quest-npc-local`);
                             this.chunkManager.removeEntity(entity);
                        } else if (entity.position.lengthSq() < 1) {
                             console.warn(`Fixing quest-npc-local position from 0,0,0 to -20,0,200`);
                             entity.position.set(-20, 0, 200);
                             this.chunkManager.updateEntityChunk(entity);
                        }
                    }
                }
            }
        }

        // Process Network Message Queue
        // 1. Handle critical messages (Chat, Inventory, etc.)
        // Healthy clients normally receive at most a few packets per frame.
        // A bounded limit lets NetworkManager compact slow-client backlogs
        // before stale state processing becomes a render death spiral.
        const maxMessages = 40;

        const pendingMessages = this.network.drainMessages(maxMessages);

        // Debug queue size if backlog persists across frames
        if (this.network.messageQueue.length > 100 && this.frameCount % 60 === 0) {
            console.warn(`Message Queue Backlog: ${this.network.messageQueue.length} remaining`);
        }

        for (let i = 0; i < pendingMessages.length; i++) {
            const msg = pendingMessages[i];
            try {
                this.handleServerMessage(msg);
            } catch (e) {
                console.error("Error handling message:", msg.type, e);
            }
        }

        // 2. Handle latest state update (Coalesced) - REMOVED to ensure all state transitions (like Attacks) are processed
        // if (this.latestServerState) { ... }

        // 3. Handle latest time update (Coalesced)
        if (this.network.latestServerTime) {
            try {
                let payload;
                const rawTime = this.network.latestServerTime;
                if (typeof rawTime === 'string') {
                    if (rawTime.startsWith('{')) {
                        const msg = JSON.parse(rawTime);
                        payload = msg.payload;
                    } else {
                        payload = JSON.parse(rawTime);
                    }
                } else {
                    payload = rawTime;
                }
                this.handleServerMessage({ type: 'time', payload: payload });
            } catch (e) {
                console.error("Error handling server time:", e);
            } finally {
                this.network.latestServerTime = null;
            }
        }

        // Process Entity Creation Queue (Throttle to 5 per frame)
        const creationLimit = 5;
        let createdCount = 0;
        while (this.entityCreationQueue.length > 0 && createdCount < creationLimit) {
            const pData = this.entityCreationQueue.shift();
            this.pendingEntityIds.delete(pData.id);

            // Double check if it was already created (race condition)
            if (this.remotePlayers.has(pData.id) || this.hazards.has(pData.id)) continue;

            // Skip loot that was recently picked up (prevents phantom items)
            if (pData.type === 'Loot' && this.recentlyPickedUpLoot.has(pData.id)) {
                console.log(`Skipping phantom loot creation: ${pData.id}`);
                continue;
            }

            try {
                let remoteEntity;
                // Pass subType (e.g. "Skeleton", "DwarfSalesman")
                if (pData.type === 'Loot') {
                    // Map rarity string to object
                    this.hydrateItem(pData.lootItem);

                    // Create LootDrop
                    remoteEntity = new LootDrop(pData.lootItem, pData.x, pData.z, pData.id);
                    remoteEntity.id = pData.id;
                    // Add click handler for pickup
                    remoteEntity.onClick = () => {
                        return this.pickupLoot(pData.id);
                    };
                } else if (pData.type === 'Projectile') {
                    // All multiplayer projectiles come from the authoritative
                    // state stream. Class handlers no longer create a second
                    // local projectile, so the caster and observers now see the
                    // same entity, path, duration, and removal.
                    const y = pData.y ?? 0;
                    const start = new THREE.Vector3(pData.x, y, pData.z);
                    const target = new THREE.Vector3(pData.x + (pData.velX || 1), y, pData.z + (pData.velZ || 0));

                    const owner = this.remotePlayers.get(pData.ownerId) || (pData.ownerId === this.player.id ? this.player : null);
                    const dummyOwner = {
                        stats: { intelligence: 10, dexterity: 10, wisdom: 10 },
                        skillRunes: {},
                        isRemote: true,
                        isMultiplayer: true
                    };

                    remoteEntity = new Projectile(pData.id, owner || dummyOwner, pData.subType, start, target);
                    const verticalVelocity = pData.subType === 'Meteor' ? -20 : 0;
                    remoteEntity.velocity.set(pData.velX || 0, verticalVelocity, pData.velZ || 0);
                    const horizontalSpeed = Math.hypot(pData.velX || 0, pData.velZ || 0);
                    if (horizontalSpeed > 0) remoteEntity.speed = horizontalSpeed;
                    remoteEntity.explosionRadius = getProjectileImpactRadius(
                        pData.subType,
                        owner,
                        pData.scale
                    );
                    // Server removal is the lifetime authority for every
                    // multiplayer projectile, including reconnect reconstruction.
                    remoteEntity.lifeTime = Number.POSITIVE_INFINITY;
                    remoteEntity.serverAuthoritativeLifetime = true;
                } else if (pData.type === 'Fence') {
                    remoteEntity = new Fence(pData.id, pData.x, pData.z, pData.rotation || 0);
                    // Add to collision manager
                    const box = new THREE.Box3();

                    // Calculate AABB for rotated fence
                    // Original dimensions: Width 4 (X), Depth 1 (Z)
                    // Increased depth to 4.0 for more solid collision
                    const w = 4.5;
                    const d = 4.0;
                    const rot = pData.rotation || 0;

                    const absCos = Math.abs(Math.cos(rot));
                    const absSin = Math.abs(Math.sin(rot));

                    const newWidth = w * absCos + d * absSin;
                    const newDepth = w * absSin + d * absCos;

                    // Height 8, Center Y 4
                    box.setFromCenterAndSize(new THREE.Vector3(pData.x, 4.0, pData.z), new THREE.Vector3(newWidth, 8, newDepth));
                    this.collisionManager.addCollider(box);
                } else if (pData.type === 'Hazard') {
                    // Environmental hazards - create visual effect
                    // SubType is the hazard type (lava_pool, sandstorm, lightning_zone, wind_gust)
                    // Scale contains the radius
                    const hazardType = pData.subType || 'lava_pool';
                    const radius = pData.scale || 5.0;
                    const position = { x: pData.x, y: 0, z: pData.z };

                    const hazard = new EnvironmentalHazard(pData.id, hazardType, position, {
                        radius,
                        quality: this.renderSystem.graphicsQuality
                    });
                    hazard.addToScene(this.getInstanceEnvironmentGroup());
                    this.hazards.set(pData.id, hazard);

                    // Skip adding to remotePlayers/entities - hazards are managed separately
                    continue;
                } else {
                    remoteEntity = this.createRemotePlayer(pData.type || 'Enemy', pData.id, pData.subType);
                    console.log(`Created remote entity: ${pData.id} (${pData.type}/${pData.subType})`);
                }

                if (remoteEntity) {
                    // Set initial position immediately.  For actors first seen mid-jump,
                    // seed the logical Y at the jump base so syncRemoteEntity can build
                    // the same visual arc/flip used by already-visible remote players.
                    remoteEntity.position.set(pData.x, this.getInitialRemoteEntityY(pData), pData.z);

                    // Set initial scale
                    if (pData.scale !== undefined) {
                        remoteEntity.setScale(pData.scale);
                    }

                    // Set initial rotation immediately to prevent spin-up glitch
                    if (pData.rotation !== undefined) {
                        remoteEntity.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pData.rotation);
                        remoteEntity.targetServerRotation = pData.rotation;
                    }

                    this.remotePlayers.set(pData.id, remoteEntity);
                    this.addEntity(remoteEntity);
                    if (pData.state !== undefined && pData.type !== 'Loot' && pData.type !== 'Projectile' && pData.type !== 'Fence') {
                        this.syncRemoteEntity(remoteEntity, { ...pData, _newlyCreated: true });
                    }
                }
            } catch (e) {
                console.error("Error creating entity:", pData.id, e);
            }
            createdCount++;
        }

        // Remote Entity Corpse Cleanup
        if (this.isMultiplayer) {
            this.remotePlayers.forEach(entity => {
                if (entity.state === 'DEAD') {
                    if (typeof entity.deadTimer !== 'number') entity.deadTimer = 0;
                    entity.deadTimer += dt;

                    // Hide after 2 seconds
                    if (entity.deadTimer > 2.0 && entity.mesh && entity.mesh.visible) {
                        entity.mesh.visible = false;
                    }
                }
            });
        }

        this.activeEntitiesCache = this.chunkManager.getActiveEntities();
        this.updateRemoteJumpVisuals(dt);
        this.updateLootVisualFeedback();
        this.processAutoLoot();

        this.raycastTimer += dt;
        // Keep a stationary pointer attached to moving actors. Actor queries
        // use their lightweight interaction proxy, so this remains cheaper
        // than recursively raycasting every animated rig on each refresh.
        const shouldRefreshMovingHover = !this.isMobile &&
            this.inputManager.pointerOverCanvas &&
            this.hoveredEntity instanceof Actor;
        if ((this.needsRaycast || shouldRefreshMovingHover) && this.raycastTimer > POINTER_RAYCAST_INTERVAL) {
             this.performRaycast();
             this.raycastTimer = 0;
             this.needsRaycast = false;
        }

        this.gameTime += dt;
        // Timer updated by server message

        this.updatePlayerJump(dt);
        const playerCorrectionDisplayTarget = !this.playerJumpState ? this.updatePlayerCorrectionVisual(dt) : null;

        const cameraFollowTarget = this.cameraLocked
            ? (this.playerJumpState?.serverDriven && this.playerJumpState?.displayPosition
                ? this.playerJumpState.displayPosition
                : playerCorrectionDisplayTarget || this.player?.position)
            : null;

        if (this.player) {
            if (!this.inputManager.isMouseDown && this._primaryMovementPointerWasDown) {
                this.player.clearBlockedMovementTarget?.();
            }
            this._primaryMovementPointerWasDown = Boolean(this.inputManager.isMouseDown);
            const playerIsJumping = this.player.state === 'JUMPING' || !!this.playerJumpState;
            if (!playerIsJumping && this.inputManager.isRightMouseDown) {
                this.needsRaycast = true;
                this.abilityController.performAbility();
            }

            if (!playerIsJumping && !this.isMobile && this.inputManager.isMouseDown && !this.uiManager.isEscMenuOpen && !this.uiManager.isShopOpen) {
                if (this.inputManager.keys.control || this.inputManager.keys.meta) {
                    this.player.targetPosition = null;
                    this.pendingInteraction = null;
                    this.abilityController.pendingAbilityTarget = null;
        this.abilityController.pendingAbilitySkill = null;

                    let lookTarget = null;
                    if (this.hoveredEntity && this.hoveredEntity instanceof Actor && this.hoveredEntity !== this.player) {
                        lookTarget = new THREE.Vector3(this.hoveredEntity.position.x, this.player.position.y, this.hoveredEntity.position.z);
                    } else {
                        const point = this.inputManager.getGroundIntersection();
                        if (point) {
                            lookTarget = new THREE.Vector3(point.x, this.player.position.y, point.z);
                        }
                    }

                    if (lookTarget && this.player.mesh) {
                        this.player.mesh.lookAt(lookTarget);
                        this.player.rotation.copy(this.player.mesh.quaternion);
                    }

                    if (this.player.state !== 'ATTACKING') {
                        // Check Attack Speed Cooldown
                        const now = Date.now();
                        const cooldownMs = this.player.stats.attackSpeed * 1000;
                        if (now - this.player.lastAttackTime >= cooldownMs) {
                            this.player.lastAttackTime = now;

                            this.player.state = 'ATTACKING';
                            this.player.playAnimation('Attack', false);

                            const hitDelay = this.player.getAttackHitDelay();

                            setTimeout(() => {
                                if (this.player.state === 'DEAD') return;

                                const attackRange = 6.0;
                                const attackAngle = Math.PI / 3;
                                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);

                                this.chunkManager.getActiveEntities().forEach(entity => {
                                    if (entity !== this.player && entity.isActive && entity.state !== 'DEAD' && entity.stats && entity.stats.hp > 0) {
                                        const dirToEntity = new THREE.Vector3().subVectors(entity.position, this.player.position);
                                        const dist = dirToEntity.length();

                                        if (dist < attackRange) {
                                            dirToEntity.normalize();
                                            const angle = forward.angleTo(dirToEntity);
                                            if (angle < attackAngle / 2) {
                                                const baseDmg = this.player.stats.damage;
                                                const variance = (Math.random() * 0.4) + 0.8;
                                                const finalDmg = Math.floor(baseDmg * variance);

                                                // In multiplayer, we should send an attack event to server
                                                // For now, we only apply damage locally if singleplayer
                                                if (!this.isMultiplayer) {
                                                    entity.takeDamage(finalDmg);
                                                    if (entity.stats.hp <= 0) {
                                                        this.handleEnemyDeath(entity);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                });
                            }, 500);
                        }
                    }
                } else if (this.hoveredEntity && this.hoveredEntity instanceof Actor && this.hoveredEntity !== this.player && this.hoveredEntity.state !== 'DEAD') {
                    const dist = this.player.position.distanceTo(this.hoveredEntity.position);
                    const range = this.getBasicAttackRangeForEntity(this.hoveredEntity);

                    if (dist < range) {
                        this.player.targetPosition = null;
                        if (this.isMultiplayer) {
                            // Check Attack Speed Cooldown
                            const now = Date.now();
                            const cooldownMs = this.player.stats.attackSpeed * 1000;
                            if (now - this.player.lastAttackTime < cooldownMs) {
                                // Do not return here, as it exits the entire update loop!
                                // Just skip the attack logic for this frame.
                            } else {
                                this.player.lastAttackTime = now;
                                this.abilityController.performAttack(this.hoveredEntity);
                            }
                        } else {
                            this.player.attack(this.hoveredEntity);
                        }
                    } else {
                        const targetLabel = this.hoveredEntity.name || this.hoveredEntity.displayName || this.hoveredEntity.subType || 'target';
                        this.showReadabilityFeedback(
                            'basic-attack-range',
                            {
                                title: 'Move into range',
                                tone: 'warning',
                                metaText: `${dist.toFixed(1)}m away`,
                                subtitle: `Basic attacks need ${range.toFixed(1)}m. Closing on ${targetLabel}.`
                            },
                            900
                        );
                        this.player.move(this.hoveredEntity.position);
                    }
                } else {
                    const point = this.inputManager.getGroundIntersection();
                    if (point) {
                        if (!this.pendingInteraction) {
                            this.player.move(point);
                        }
                    }
                }
            }

            this.chunkManager.update(this.player, dt, this.collisionManager, this.floatingTextManager, this);
            this.applyRemoteJumpVisuals({ smoothDisplayPosition: false });

            if (this.pendingInteraction) {
                // 1. Validate Target
                if (!this.pendingInteraction.isActive || (this.pendingInteraction.state === 'DEAD' && !(this.pendingInteraction instanceof LootDrop))) {
                    this.pendingInteraction = null;
                    // Stop moving if the target is invalid/gone
                    this.player.targetPosition = null;
                    this.player.state = 'IDLE';
                    this.player.playAnimation('Idle');
                } else {
                    // 2. Calculate Distance & Range
                    // Optimization: Avoid Vector2 allocation
                    const dx = this.player.position.x - this.pendingInteraction.position.x;
                    const dz = this.player.position.z - this.pendingInteraction.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    let range = this.getInteractionRangeForEntity(this.pendingInteraction);

                    if (this.pendingInteraction.name === 'DungeonEntrance') {
                        // Fallback if userData not set, or override
                        if (range < 60.0) range = 60.0;
                        this.hoveredEntity = this.pendingInteraction;
                        this.refreshDungeonEntranceHint();
                    }

                    // 3. Execute Logic
                    if (dist <= range) {
                        // ARRIVED: Interact

                        if (this.pendingInteraction instanceof LootDrop) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            // Extra check: If item is gone from server (multiplayer), stop trying immediately
                            if (this.isMultiplayer && !this.remotePlayers.has(this.pendingInteraction.id)) {
                                this.pendingInteraction = null;
                                this.player.targetPosition = null;
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            } else {
                                const now = Date.now();
                                if (now - this.lastPickupTime > 250) { // 250ms throttle for retries
                                    this.lastPickupTime = now;

                                    if (this.isMultiplayer && this.pendingInteraction.onClick) {
                                        const didSendPickup = this.pendingInteraction.onClick();
                                        if (didSendPickup === false) {
                                            // Inventory is full; stop the retry loop.
                                            this.pendingInteraction = null;
                                            this.player.targetPosition = null;
                                            this.player.state = 'IDLE';
                                            this.player.playAnimation('Idle');
                                        }
                                        // Do NOT clear pendingInteraction immediately.
                                        // We wait for the server to remove the item (via state update).
                                        // This ensures we keep trying or stay close until it's actually gone.
                                    } else if (this.player.addToInventory(this.pendingInteraction.item)) {
                                        console.log(`Picked up ${this.pendingInteraction.item.name}`);
                                        this.uiManager.updateInventory(this.player);

                                        this.pendingInteraction.isActive = false;

                                        if (this.pendingInteraction.dispose) {
                                            this.pendingInteraction.dispose();
                                        } else if (this.pendingInteraction.mesh) {
                                            if (this.pendingInteraction.mesh.parent?.remove) {
                                                this.pendingInteraction.mesh.parent.remove(this.pendingInteraction.mesh);
                                            } else {
                                                this.renderSystem.remove(this.pendingInteraction.mesh);
                                            }
                                        }

                                        const key = this.chunkManager.getChunkKey(this.pendingInteraction.position.x, this.pendingInteraction.position.z);
                                        if (this.chunkManager.chunks.has(key)) {
                                            this.chunkManager.chunks.get(key).delete(this.pendingInteraction);
                                        }
                                        this.pendingInteraction = null; // Local success, clear immediately
                                    } else {
                                        console.log("Inventory full!");
                                        this.pendingInteraction = null; // Stop trying if full
                                    }
                                }
                            }

                        } else if (this.pendingInteraction.name === 'DungeonEntrance') {
                            this.player.targetPosition = null;
                            this.player.state = 'IDLE';
                            this.player.playAnimation('Idle');

                            const dungeonType = this.pendingInteraction.userData
                                ? this.pendingInteraction.userData.dungeonType
                                : null;
                            this.requestDungeonStatus(dungeonType);
                            this.pendingInteraction = null;
                            this.refreshDungeonEntranceHint();

                        } else if (this.pendingInteraction instanceof DungeonNPC) {
                            this.player.targetPosition = null;
                            this.player.state = 'IDLE';
                            this.player.playAnimation('Idle');

                            this.requestDungeonStatus();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof DwarfSalesman) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleShop();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof QuestNPC) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleQuestWindow(this.pendingInteraction.story ? 'story' : 'daily');
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof RespecNPC) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.showRespecMenu();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof Stash) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleStash();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof Forge) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleForge();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof TradingHouse) {
                            this.player.targetPosition = null;
                            if (this.player.state === 'MOVING') {
                                this.player.state = 'IDLE';
                                this.player.playAnimation('Idle');
                            }
                            this.uiManager.toggleTradingHouse();
                            this.pendingInteraction = null;

                        } else if (this.pendingInteraction instanceof Actor) {
                            let attacked = false;
                            if (this.isMultiplayer) {
                                // Check Attack Speed Cooldown
                                const now = Date.now();
                                const cooldownMs = this.player.stats.attackSpeed * 1000;
                                if (now - this.player.lastAttackTime >= cooldownMs) {
                                    this.player.lastAttackTime = now;

                                    this.abilityController.performAttack(this.pendingInteraction);
                                    attacked = true;

                                    // Do NOT clear pendingInteraction to enable Auto-Attack / Chase
                                    // The loop will continue, checking range and cooldown every frame
                                }
                            } else {
                                // Singleplayer Attack
                                if (this.player.attack(this.pendingInteraction, (dmg, target) => {
                                    this.floatingTextManager.spawn(dmg, target.position, '#ffffff');
                                })) {
                                    attacked = true;
                                }
                                // Do NOT clear pendingInteraction
                            }

                            // Movement Logic (Hysteresis)
                            if (!attacked) {
                                const stopRange = range - 0.5;
                                if (dist <= stopRange) {
                                    this.player.targetPosition = null;
                                    if (this.player.state === 'MOVING') {
                                        this.player.state = 'IDLE';
                                        this.player.playAnimation('Idle');
                                    }
                                } else {
                                    // Close in
                                    const target = this.pendingInteraction.position.clone();
                                    target.y = this.player.position.y;
                                    this.player.move(target);
                                }
                            }
                        }
                    } else {
                        // MOVING: Chase Target
                        // Continuously update target position to handle moving targets
                        const target = this.pendingInteraction.position.clone();
                        target.y = this.player.position.y;

                        // Force move every frame to override any idle states
                        this.player.move(target);
                    }
                }
            }

            this.abilityController.updatePendingTarget();
            this.refreshCombatIntentState();

            if (this.isPlayerDead()) {
                this.pendingInteraction = null;
                this.abilityController.pendingAbilityTarget = null;
                this.abilityController.pendingAbilitySkill = null;
                this.clearCombatIntentState();
                this.player.targetPosition = null;
                this.uiManager.showDeathScreen();
            } else {
                this.uiManager.hideDeathScreen();
                this.player.timeSinceDeath = null;
            }
        }

        if (this.player) {
            if (this.isPlayerDead()) {
                this.inputManager.clearInputState();
            }
            if (this.isMobile) {
                if (this.isPlayerDead()) {
                    this.player.targetPosition = null;
                    if (this.player.state !== 'DEAD') {
                        this.player.state = 'DEAD';
                    }
                } else if (!this.playerJumpState) {
                const moveDir = this.inputManager.getMovementDirection();
                if (moveDir.lengthSq() > 0) {
                    const speed = this.player.stats.speed;
                    const moveVec = moveDir.multiplyScalar(speed * dt);

                    const nextPos = this.player.position.clone().add(moveVec);

                    if (this.collisionManager) {
                        const correctedPos = this.collisionManager.checkCollision(nextPos, this.player.radius, this.player.position);
                        if (correctedPos) {
                            this.player.position.copy(correctedPos);
                        } else {
                            this.player.position.copy(nextPos);
                        }
                    } else {
                        this.player.position.copy(nextPos);
                    }

                    this.player.state = 'MOVING';
                    this.player.playAnimation('Run');

                    const lookTarget = this.player.position.clone().add(moveDir);
                    if (this.player.mesh) {
                        this.player.mesh.lookAt(lookTarget);
                        this.player.rotation.copy(this.player.mesh.quaternion);
                    }

                    this.player.targetPosition = null;
                } else {
                    if (this.player.state === 'MOVING' && !this.player.targetPosition) {
                        this.player.state = 'IDLE';
                        this.player.playAnimation('Idle');
                    }
                }
                }
            }

            if (this.cameraLocked) {
                if (cameraFollowTarget) {
                    this.renderSystem.setCameraTarget(cameraFollowTarget);
                }
            } else {
                const panSpeed = 30;
                const keys = this.inputManager.keys;
                let dx = 0;
                let dz = 0;

                if (keys.w) { dx -= 1; dz -= 1; }
                if (keys.s) { dx += 1; dz += 1; }
                if (keys.a) { dx -= 1; dz += 1; }
                if (keys.d) { dx += 1; dz -= 1; }

                const currentTarget = this.renderSystem.cameraTarget.clone();

                if (dx !== 0 || dz !== 0) {
                    const length = Math.sqrt(dx*dx + dz*dz);
                    dx /= length;
                    dz /= length;

                    currentTarget.x += dx * panSpeed * dt;
                    currentTarget.z += dz * panSpeed * dt;
                }

                const maxDist = 50;
                const dist = currentTarget.distanceTo(this.player.position);

                if (dist > maxDist) {
                    const dir = new THREE.Vector3().subVectors(currentTarget, this.player.position).normalize();
                    currentTarget.copy(this.player.position).add(dir.multiplyScalar(maxDist));
                }

                this.renderSystem.setCameraTarget(currentTarget);
            }
        }

        // Network Update
        this.sendPlayerMovementIfNeeded(dt);

        // Update realm lighting based on player position
        if (this.player) {
            this.renderSystem.updateEnvironmentLighting(this.player.position, dt);
        }

        this.floatingTextManager.update(dt);

        // Update Effects
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.update(dt);
            if (!effect.isActive) {
                this.effects.splice(i, 1);
            }
        }

        // Update Environmental Hazards
        for (const hazard of this.hazards.values()) {
            hazard.update(dt);
        }
    }

    render(alpha) {
        // Optimization: Use cached active entities from ChunkManager
        // This avoids re-iterating chunks just for rendering if update() already did it
        const activeEntities = this.chunkManager.getActiveEntities();

        // Use a simple for loop for performance instead of forEach
        for (let i = 0; i < activeEntities.length; i++) {
            const entity = activeEntities[i];
            if (entity.isActive) {
                if (entity !== this.player && entity.jumpVisualState) {
                    this.applyEntityJumpVisuals(entity, entity.jumpVisualState);
                } else {
                    entity.render(alpha);
                }
            }
        }

        this.applyPlayerJumpVisuals();
        this.applyPlayerCorrectionVisuals();

        for (let i = 0; i < activeEntities.length; i++) {
            activeEntities[i]?.syncPresentationTransform?.();
        }

        if (this.cameraLocked && this.player?.mesh?.position) {
            if (!this._renderCameraTarget) this._renderCameraTarget = new THREE.Vector3();
            this._renderCameraTarget.copy(this.player.mesh.position);
            // Jump squash/stretch is presentation-only; following its vertical
            // arc would make every landing shake the whole screen.
            this._renderCameraTarget.y = this.player.position.y;
            this.renderSystem.setCameraTarget(this._renderCameraTarget);
        }

        this.renderSystem.render();

        if (this.player) {
            // Throttle Minimap updates (every 3 frames)
            if (this.frameCount % 3 === 0) {
                this.minimap.update(this.player, activeEntities);
            }

            const playerStats = this.player.stats || {};
            const hudSignature = this.uiManager.serializePlayerStats
                ? this.uiManager.serializePlayerStats(this.player)
                : [
                    Math.ceil(playerStats.hp ?? 0),
                    playerStats.maxHp ?? 0,
                    Math.floor(playerStats.mana ?? 0),
                    playerStats.maxMana ?? 0,
                    this.player.abilityName || '',
                    this.player.abilityDescription || '',
                    this.player.abilityCooldown > 0 ? Math.ceil(this.player.abilityCooldown) : 0,
                    this.player.abilityManaCost ?? 0,
                    playerStats.manaCostReduction ?? 0
                ].join('|');
            if (hudSignature !== this.lastRenderHudSignature) {
                this.uiManager.updatePlayerStats(this.player);
                this.lastRenderHudSignature = hudSignature;
            }

            const xpSignature = this.uiManager.serializeXP
                ? this.uiManager.serializeXP(this.player)
                : [
                    this.player.level ?? 0,
                    this.player.xp ?? 0,
                    this.player.xpToNextLevel ?? 0
                ].join('|');
            if (xpSignature !== this.lastRenderXpSignature) {
                this.uiManager.updateXP(this.player);
                this.lastRenderXpSignature = xpSignature;
            }

            const hotbarCooldownSignature = this.uiManager.serializeHotbarCooldowns
                ? this.uiManager.serializeHotbarCooldowns(this.player)
                : (this.player.hotbar || []).map((skillName, index) => {
                    if (!skillName) return `${index}:empty`;
                    const mappedCooldown = this.player.cooldowns?.[skillName] ?? 0;
                    const fallbackCooldown = skillName === this.player.abilityName ? (this.player.abilityCooldown ?? 0) : 0;
                    const displayedCooldown = Math.max(mappedCooldown, fallbackCooldown);
                    return `${index}:${skillName}:${displayedCooldown > 0 ? Math.ceil(displayedCooldown) : 0}`;
                }).join('|');
            if (hotbarCooldownSignature !== this.lastRenderHotbarCooldownSignature) {
                this.uiManager.updateHotbarCooldowns(this.player);
                this.lastRenderHotbarCooldownSignature = hotbarCooldownSignature;
            }

            // Dynamic UI Updates (Throttled)
            if (this.frameCount % 10 === 0) {
                if (this.uiManager.isCharacterSheetOpen) {
                    const characterSheetSignature = this.uiManager.serializeCharacterSheet
                        ? this.uiManager.serializeCharacterSheet(this.player)
                        : [
                            this.player.level ?? 0,
                            this.player.xp ?? 0,
                            this.player.xpToNextLevel ?? 0,
                            this.player.statPoints ?? 0,
                            this.player.isMultiplayer ? '1' : '0',
                            Math.ceil(playerStats.hp ?? 0),
                            playerStats.maxHp ?? 0,
                            Math.floor(playerStats.mana ?? 0),
                            playerStats.maxMana ?? 0,
                            playerStats.strength ?? 0,
                            playerStats.dexterity ?? 0,
                            playerStats.intelligence ?? 0,
                            playerStats.vitality ?? 0,
                            playerStats.wisdom ?? 0,
                            playerStats.damage ?? 0,
                            playerStats.defense ?? 0,
                            this.player.equipment?.head?.id || '',
                            this.player.equipment?.shoulders?.id || '',
                            this.player.equipment?.chest?.id || '',
                            this.player.equipment?.belt?.id || '',
                            this.player.equipment?.legs?.id || '',
                            this.player.equipment?.feet?.id || '',
                            this.player.equipment?.gloves?.id || '',
                            this.player.equipment?.neck?.id || '',
                            this.player.equipment?.mainHand?.id || '',
                            this.player.equipment?.offHand?.id || '',
                            this.player.equipment?.ring1?.id || '',
                            this.player.equipment?.ring2?.id || '',
                            this.player.equipment?.trinket1?.id || '',
                            this.player.equipment?.trinket2?.id || ''
                        ].join('|');
                    if (characterSheetSignature !== this.lastRenderCharacterSheetSignature) {
                        this.uiManager.updateCharacterSheet(this.player);
                        this.lastRenderCharacterSheetSignature = characterSheetSignature;
                    }
                }
            }

            const enemyBarSignature = [
                this.hoveredEntity?.id || '',
                this.inputManager.keys.alt ? '1' : '0',
                activeEntities
                    .filter((entity) => !entity.id.startsWith('player') && entity.stats && entity.stats.hp > 0 && entity.mesh)
                    .map((entity) => `${entity.id}:${Math.ceil(entity.stats.hp ?? 0)}/${entity.stats.maxHp ?? 0}`)
                    .join('|')
            ].join('::');
            if (enemyBarSignature !== this.lastRenderEnemyBarSignature) {
                this.uiManager.updateEnemyBars(
                    activeEntities,
                    this.renderSystem.camera,
                    this.hoveredEntity,
                    this.inputManager.keys.alt
                );
                this.lastRenderEnemyBarSignature = enemyBarSignature;
            }
            if (this.worldMap?.isVisible?.()) {
                const dungeonBeatSignature = this.currentDungeonRoomState
                    ? [
                        this.currentDungeonRoomState.currentRoomIndex ?? '',
                        this.currentDungeonRoomState.objectiveRoomIndex ?? '',
                        Array.isArray(this.currentDungeonRoomState.rooms)
                            ? this.currentDungeonRoomState.rooms
                                .map((room) => room
                                    ? `${room.index ?? ''}:${room.cleared ? 1 : 0}:${room.explored ? 1 : 0}:${room.hook ?? ''}:${room.type ?? ''}`
                                    : '')
                                .join(',')
                            : ''
                    ].join('::')
                    : '';
                const worldMapSignature = [
                    Math.floor(this.player.position.x ?? 0),
                    Math.floor(this.player.position.z ?? 0),
                    this.currentInstanceId || '',
                    this.currentInstanceType || '',
                    dungeonBeatSignature
                ].join('|');
                if (worldMapSignature !== this.lastRenderWorldMapSignature) {
                    this.worldMap.update(this.player);
                    this.lastRenderWorldMapSignature = worldMapSignature;
                }
            }
        }
    }
}

export function installGameEngineRuntime(targetClass) {
    installPrototypeMethods(targetClass, GameEngineRuntimeMethods);
}
