import * as THREE from 'three';
import { LevelUpEffect } from '../ui/LevelUpEffect.js';
import { LootDrop } from '../entities/LootDrop.js';
import { Projectile } from '../entities/Projectile.js';
import { AUDIO_CUES } from '../audio/AudioManager.js';
import { installPrototypeMethods } from './PrototypeInstaller.js';

class GameEngineEntitySyncMethods {
    applyPositionHacks(pData) {
        if (pData.id === 'stash-1') {
            pData.x = 0;
            pData.z = 185;
        }
        if (pData.id === 'merchant-1') {
            pData.x = 22.5;
            pData.z = 200;
        }
    }

    /**
     * Queue a new remote entity for batched creation when it hasn't been
     * seen before.  Returns true if the entity was queued (caller should
     * skip the rest of the update for this entity).
     *
     * @param {Object} pData  Entity payload
     * @returns {boolean}
     */
    queueEntityCreation(pData) {
        if (pData.type === 'Loot' && this.recentlyPickedUpLoot.has(pData.id)) {
            return true; // skip phantom loot
        }

        if (!this.pendingEntityIds.has(pData.id)) {
            this.pendingEntityIds.add(pData.id);
            this.entityCreationQueue.push(pData);
        } else {
            // Update pending creation with latest data
            const idx = this.entityCreationQueue.findIndex(e => e.id === pData.id);
            if (idx !== -1) {
                this.entityCreationQueue[idx] = { ...this.entityCreationQueue[idx], ...pData };
            }
        }
        return true;
    }

    cancelPendingEntityCreation(id) {
        const previousLength = this.entityCreationQueue?.length || 0;
        if (previousLength > 0) {
            this.entityCreationQueue = this.entityCreationQueue.filter(entry => entry?.id !== id);
        }
        this.pendingEntityIds?.delete(id);
        return (this.entityCreationQueue?.length || 0) !== previousLength;
    }

    reconcilePendingEntitySnapshot(seenIds) {
        if (!this.entityCreationQueue?.length) return;
        this.entityCreationQueue = this.entityCreationQueue.filter((entry) => {
            if (seenIds.has(entry?.id)) return true;
            this.pendingEntityIds?.delete(entry?.id);
            return false;
        });
    }

    getEnvironmentalHazardSnapshot(pData) {
        const requestedRadius = Number(pData?.scale);
        return {
            id: pData?.id,
            hazardType: pData?.subType || 'lava_pool',
            radius: Number.isFinite(requestedRadius) && requestedRadius > 0 ? requestedRadius : 5.0,
            x: Number(pData?.x) || 0,
            z: Number(pData?.z) || 0
        };
    }

    environmentalHazardMatchesSnapshot(hazard, snapshot) {
        if (!hazard || !snapshot) return false;
        const sameNumber = (a, b) => Math.abs(Number(a) - Number(b)) < 0.000001;
        return hazard.id === snapshot.id
            && hazard.hazardType === snapshot.hazardType
            && sameNumber(hazard.radius, snapshot.radius)
            && sameNumber(hazard.position?.x, snapshot.x)
            && sameNumber(hazard.position?.z, snapshot.z);
    }

    removeEnvironmentalHazard(id) {
        const hazard = this.hazards?.get(id);
        if (!hazard) return false;
        hazard.removeFromScene(this.renderSystem?.environmentGroup);
        hazard.dispose();
        this.hazards.delete(id);
        return true;
    }

    syncEnvironmentalHazardSnapshot(pData) {
        if (!this.hazards) this.hazards = new Map();
        const snapshot = this.getEnvironmentalHazardSnapshot(pData);
        const existing = this.hazards.get(snapshot.id);
        if (this.environmentalHazardMatchesSnapshot(existing, snapshot)) {
            return false;
        }
        if (existing) {
            this.removeEnvironmentalHazard(snapshot.id);
        }
        this.queueEntityCreation({ ...pData, ...snapshot, subType: snapshot.hazardType, scale: snapshot.radius });
        return true;
    }

    reconcileEnvironmentalHazards(seenHazardIds) {
        if (!this.hazards) this.hazards = new Map();
        for (const id of this.hazards.keys()) {
            if (!seenHazardIds.has(id)) {
                this.removeEnvironmentalHazard(id);
            }
        }

        // Full state is authoritative. A removed hazard must not materialize a
        // frame later merely because it was still waiting in the throttled
        // creation queue.
        this.entityCreationQueue = (this.entityCreationQueue || []).filter((entry) => {
            if (entry?.type !== 'Hazard' || seenHazardIds.has(entry.id)) return true;
            this.pendingEntityIds?.delete(entry.id);
            return false;
        });
    }

    getInitialRemoteEntityY(pData) {
        if (pData?.state !== 'JUMPING') {
            return pData?.y ?? 0;
        }

        if (Object.prototype.hasOwnProperty.call(pData, 'jumpStartY')) {
            return pData.jumpStartY;
        }
        if (Object.prototype.hasOwnProperty.call(pData, 'jumpTargetY')) {
            return pData.jumpTargetY;
        }

        return 0;
    }

    /**
     * Synchronise a remote entity's position, state, health, animation,
     * rotation, and level from a server payload (used by both `state` and
     * `delta` message handlers).
     *
     * @param {import('../entities/Actor.js').Actor} remoteEntity
     * @param {Object} pData  Entity payload from server
     */
    syncRemoteEntity(remoteEntity, pData) {
        const previousRemotePosition = remoteEntity.position?.clone?.() || new THREE.Vector3();
        const previousRemoteState = remoteEntity.state || '';
        if (Object.prototype.hasOwnProperty.call(pData, 'equipment')) {
            remoteEntity.syncEquipmentVisuals?.(pData.equipment || {});
        }
        if (pData.skillRunes !== undefined) {
            remoteEntity.skillRunes = { ...(pData.skillRunes || {}) };
        }
        // --- Position / Interpolation ---
        if (pData.type === 'Projectile') {
            remoteEntity.position.set(pData.x, pData.y ?? 0, pData.z);
            if (pData.velX !== undefined && pData.velZ !== undefined) {
                const verticalVelocity = remoteEntity.type === 'Meteor' ? -20 : 0;
                remoteEntity.velocity.set(pData.velX, verticalVelocity, pData.velZ);
                const horizontalSpeed = Math.hypot(pData.velX, pData.velZ);
                if (horizontalSpeed > 0) remoteEntity.speed = horizontalSpeed;
            }
        } else {
            const newPos = new THREE.Vector3(pData.x, pData.y ?? 0, pData.z);
            if (!remoteEntity.targetServerPosition) {
                remoteEntity.position.copy(newPos);
                remoteEntity.resetTransformInterpolation?.();
            }
            remoteEntity.targetServerPosition = newPos;
            if (pData.state !== 'JUMPING') {
                remoteEntity.pushRemoteTransform?.(newPos, pData.rotation, {
                    serverTimeMs: pData._serverTimeMs,
                    state: pData.state
                });
            }
        }

        if (pData.state === 'JUMPING') {
            if (previousRemoteState !== 'JUMPING') {
                remoteEntity.clearRemoteTransformBuffer?.();
            }
            this.syncAuthoritativeJumpState(remoteEntity, {
                ...pData,
                _previousPosition: previousRemotePosition,
                _previousState: previousRemoteState
            });
            // Bug 1 fix: syncAuthoritativeJumpState set entity.position.y = baseY (ground level).
            // Neutralise targetServerPosition.y so Actor.update() lerp doesn't re-introduce
            // the server arc height and cause a double-arc at render time.
            if (remoteEntity.targetServerPosition) {
                remoteEntity.targetServerPosition.y = remoteEntity.position.y;
            }
        } else {
            this.clearAuthoritativeJumpState(remoteEntity);
        }

        // Chunk visibility
        this.chunkManager.updateEntityChunk(remoteEntity);

        // Name
        if (pData.name && remoteEntity.name !== pData.name) {
            remoteEntity.setName(pData.name);
        }

        if ((pData.guildId !== undefined || pData.guildTag !== undefined) &&
            (pData.guildId !== remoteEntity.guildId || pData.guildTag !== remoteEntity.guildTag)) {
            remoteEntity.setGuildIdentity?.(pData.guildId, pData.guildTag);
        }

        // Party-member highlight (0.37.2): driven exclusively by partyId from the
        // state stream — single source of truth, no MsgPartyUpdate cross-reference.
        if (pData.partyId !== undefined && pData.partyId !== remoteEntity.partyId) {
            remoteEntity.partyId = pData.partyId;
            if (typeof remoteEntity.setPartyHighlight === 'function') {
                remoteEntity.setPartyHighlight(!!(this.socialController?.myPartyId && pData.partyId === this.socialController?.myPartyId));
            }
        }
        remoteEntity.setPvPHostile?.(Boolean(this.socialController?.isPvPHostile?.(pData.id)));

        // Scale
        if (pData.scale !== undefined && remoteEntity.scale !== pData.scale) {
            remoteEntity.setScale(pData.scale);
        }

        // --- Death handling ---
        if (pData.state === 'DEAD') {
            if (!remoteEntity.isDead) {
                remoteEntity.isDead = true;
                remoteEntity.deadTimer = 0;
                if (remoteEntity.updateState) {
                    remoteEntity.updateState('DEAD');
                } else {
                    remoteEntity.state = 'DEAD';
                }
                if (remoteEntity.playAnimation) {
                    remoteEntity.playAnimation('Death', false);
                }
            }
        } else {
            remoteEntity.isDead = false;
            remoteEntity.deadTimer = 0;
            if (remoteEntity.mesh) remoteEntity.mesh.visible = true;

            // Stats
            if (remoteEntity.stats) {
                if (pData.health !== undefined) remoteEntity.stats.hp = pData.health;
                if (pData.maxHealth !== undefined) remoteEntity.stats.maxHp = pData.maxHealth;
                if (pData.mana !== undefined) remoteEntity.stats.mana = pData.mana;
                if (pData.maxMana !== undefined) remoteEntity.stats.maxMana = pData.maxMana;
                if (pData.speed !== undefined) remoteEntity.stats.speed = pData.speed;
                if (pData.attackSpeed !== undefined) remoteEntity.stats.attackSpeed = pData.attackSpeed;
            }

            // State / Animation
            if (remoteEntity.state !== pData.state || (pData.isCharging !== undefined && remoteEntity.isCharging !== pData.isCharging)) {
                if (remoteEntity.updateState) {
                    remoteEntity.updateState(pData.state);
                } else {
                    remoteEntity.state = pData.state;
                }
                if (pData.isCharging !== undefined) remoteEntity.isCharging = pData.isCharging;
            } else if (pData.state === 'ATTACKING' && remoteEntity.updateState) {
                remoteEntity.updateState(pData.state);
            }
            this.showRemoteStateReadability(remoteEntity, pData.state, previousRemoteState);
            this.syncRemoteSupportEffects(remoteEntity, pData);
            this.syncPlayerStatusClears(remoteEntity, pData);
            this.syncPlayerStatusDetails(remoteEntity, pData);
            remoteEntity.syncAttachedStatusEffects?.(0);

            // Rotation
            if (pData.rotation !== undefined) {
                remoteEntity.targetServerRotation = pData.rotation;
            }

            // Remote level-up detection
            if (pData.level !== undefined) {
                if (!remoteEntity.hasSyncedLevel) {
                    remoteEntity.level = pData.level;
                    remoteEntity.hasSyncedLevel = true;
                } else if (remoteEntity.level < pData.level) {
                    remoteEntity.level = pData.level;
                    const effect = new LevelUpEffect(this.renderSystem.effectGroup, remoteEntity.position);
                    this.effects.push(effect);
                }
            }
        }
    }

    /**
     * Remove an entity by id — disposes mesh, removes from chunk and
     * remotePlayers map.
     * @param {string} id
     */
    removeRemoteEntity(id) {
        const entity = this.remotePlayers.get(id);
        if (!entity) return;

        // A typed server impact normally arrives before removal. Retain a
        // deduplicated Meteor fallback for packet loss without guessing that
        // ordinary projectile expiry was a hit.
        if (entity instanceof Projectile && entity.type === 'Meteor' && !entity.hasExploded) {
            this.renderProjectileImpactFeedback({
                projectileId: entity.id,
                projectileType: entity.type,
                sourceId: entity.owner?.id || '',
                instanceId: this.currentInstanceId || '',
                x: entity.position.x,
                y: 0.1,
                z: entity.position.z,
                radius: entity.explosionRadius || 26.4,
                terminal: true
            });
            entity.hasExploded = true;
        }

        entity.isActive = false;

        if (entity.dispose) {
            entity.dispose();
        } else if (entity.mesh) {
            if (entity.mesh.parent?.remove) {
                entity.mesh.parent.remove(entity.mesh);
            } else {
                this.renderSystem.remove(entity.mesh);
            }
        }

        if (entity.healthBar?.remove) {
            entity.healthBar.remove();
        }

        const key = this.chunkManager.getChunkKey(entity.position.x, entity.position.z);
        if (this.chunkManager.chunks.has(key)) {
            this.chunkManager.chunks.get(key).delete(entity);
        }
        this.remotePlayers.delete(id);
    }

    confirmPendingLootPickups(inventory) {
        if (!this.pendingLootPickups?.size) return;

        const quantityByName = new Map();
        for (const item of inventory || []) {
            if (!item?.id || !item.name) continue;
            quantityByName.set(item.name, (quantityByName.get(item.name) || 0) + (item.stack || 1));
        }

        for (const [lootId, pending] of this.pendingLootPickups) {
            if ((quantityByName.get(pending.itemName) || 0) <= pending.quantityBefore) continue;

            this.pendingLootPickups.delete(lootId);
            this.recentlyPickedUpLoot.add(lootId);
            setTimeout(() => {
                this.recentlyPickedUpLoot.delete(lootId);
            }, this.recentlyPickedUpLootTimeout);
            this.showLootPickupFeedback(pending.entity, 'picked_up');
            this.removeRemoteEntity(lootId);
        }
    }

    isLootEntity(entity) {
        return entity instanceof LootDrop;
    }

    getLootPickupRadius(entity = null) {
        const radius = this.getInteractionRangeForEntity ? this.getInteractionRangeForEntity(entity) : 5.0;
        return Math.max(2.5, radius);
    }

    canAttemptLootPickup(entity) {
        if (!this.player || !this.isLootEntity(entity) || !entity?.isActive || !entity?.position) return false;
        const dx = this.player.position.x - entity.position.x;
        const dz = this.player.position.z - entity.position.z;
        return Math.sqrt(dx * dx + dz * dz) <= this.getLootPickupRadius(entity);
    }

    formatLootPickupMessage(entity) {
        const item = entity?.item;
        if (!item) return 'Picked up loot';
        const rarityName = typeof item.rarity === 'string'
            ? item.rarity
            : (item.rarity?.name || item.gemQuality || 'Loot');
        return `${rarityName}: ${item.name}`;
    }

    showLootPickupFeedback(entity, result = 'picked_up') {
        if (!entity || result !== 'picked_up') return;
        const message = this.formatLootPickupMessage(entity);
        const color = this.uiManager?.getRarityColor?.(entity.item?.rarity) || entity.itemColor || '#ffd700';
        this.playAudioCue(AUDIO_CUES.lootPickup, { pitch: entity.item?.gemQuality ? 1.15 : 1 });

        if (this.floatingTextManager && this.player?.position) {
            this.floatingTextManager.spawn(message.toUpperCase(), this.player.position, color);
        }
        if (this.uiManager?.showLootPickupToast) {
            this.uiManager.showLootPickupToast(message, { sender: 'Loot' });
        }
    }

    showLootFailureFeedback(reason = 'inventory_full') {
        if (!this.player?.position) return;
        const now = Date.now();
        if (reason === 'inventory_full') {
            if (now - (this.lastInventoryFullTime || 0) <= 1000) return;
            this.lastInventoryFullTime = now;
            this.playAudioCue(AUDIO_CUES.lootBlocked);
            this.floatingTextManager?.spawn('INVENTORY FULL', this.player.position, '#ff4444');
            this.uiManager?.showLootPickupToast?.('Inventory full', { sender: 'Loot' });
        }
    }

    findNearestLootInRange(radius = this.getLootPickupRadius()) {
        if (!this.player || !this.activeEntitiesCache) return null;
        let nearest = null;
        let nearestDistance = radius;

        for (const entity of this.activeEntitiesCache) {
            if (!this.isLootEntity(entity) || !entity.isActive || this.recentlyPickedUpLoot.has(entity.id)) continue;
            const dx = this.player.position.x - entity.position.x;
            const dz = this.player.position.z - entity.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= nearestDistance) {
                nearest = entity;
                nearestDistance = dist;
            }
        }

        return nearest;
    }

    shouldAutoLootEntity(entity) {
        return Boolean(this.autoLootEnabled && this.canAttemptLootPickup(entity));
    }

    processAutoLoot() {
        if (!this.autoLootEnabled || !this.player || this.isPlayerDead?.()) return;
        const now = Date.now();
        if (now - (this.lastAutoLootAttemptTime || 0) < this.autoLootAttemptCooldownMs) return;

        const nearestLoot = this.findNearestLootInRange();
        if (!nearestLoot) return;

        this.lastAutoLootAttemptTime = now;
        this.pickupLoot(nearestLoot.id);
    }

    updateLootVisualFeedback() {
        if (!this.activeEntitiesCache) return;
        const targetLoot = this.isLootEntity(this.pendingInteraction) ? this.pendingInteraction : null;

        for (const entity of this.activeEntitiesCache) {
            if (!this.isLootEntity(entity) || typeof entity.setPickupVisualState !== 'function') continue;
            if (entity === targetLoot) {
                entity.setPickupVisualState('targeted');
            } else if (this.canAttemptLootPickup(entity)) {
                entity.setPickupVisualState('in_range');
            } else {
                entity.setPickupVisualState('default');
            }
        }
    }

    pickupLoot(lootId) {
        const entity = this.remotePlayers.get(lootId);

        const isEmptyInventorySlot = (slot) => !slot || !slot.id;

        // Only request pickup when the entire stack can fit in the current
        // inventory state; the server remains authoritative for acceptance.
        const canFitPickup = (() => {
            if (!entity || !entity.item || !this.player || !this.player.inventory) return false;

            const item = this.hydrateItem({ ...entity.item });
            const inventory = this.player.inventory;

            const maxStack = item.maxStack || 1;
            let remaining = item.stack || 1;

            if (maxStack > 1) {
                // First, see how much can be absorbed into existing partial stacks.
                for (let i = 0; i < inventory.length && remaining > 0; i++) {
                    const invItem = inventory[i];
                    if (invItem && invItem.id && invItem.name === item.name && (invItem.maxStack || 1) > 1) {
                        const invMax = invItem.maxStack || maxStack;
                        if ((invItem.stack || 1) < invMax) {
                            const space = invMax - (invItem.stack || 1);
                            remaining -= Math.min(space, remaining);
                        }
                    }
                }

                if (remaining <= 0) return true;

                // Then we need empty slots for whatever is left.
                let emptySlots = 0;
                for (let i = 0; i < inventory.length; i++) {
                    if (isEmptyInventorySlot(inventory[i])) emptySlots++;
                }

                // One empty slot can take up to maxStack items of this type.
                return emptySlots * maxStack >= remaining;
            }

            // Non-stackable: must have at least one empty slot.
            for (let i = 0; i < inventory.length; i++) {
                if (isEmptyInventorySlot(inventory[i])) return true;
            }
            return false;
        })();

        if (!canFitPickup) {
            // No point sending a request the server must reject.
            this.showLootFailureFeedback('inventory_full');
            return false;
        }

        if (!this.pendingLootPickups.has(lootId)) {
            const item = this.hydrateItem({ ...entity.item });
            const quantityBefore = this.player.inventory.reduce((total, inventoryItem) =>
                total + (inventoryItem?.id && inventoryItem.name === item.name
                    ? (inventoryItem.stack || 1)
                    : 0), 0);
            this.pendingLootPickups.set(lootId, {
                entity,
                itemName: item.name,
                quantityBefore
            });
            setTimeout(() => {
                this.pendingLootPickups.delete(lootId);
            }, this.pendingLootPickupTimeout);
        }

        // Keep the item and inventory unchanged until the server's inventory
        // response confirms success. The interaction loop can safely retry a
        // request rejected because the authoritative player position lagged.
        this.network.send('pickup', { lootId: lootId });

        return true;
    }

}

export function installGameEngineEntitySync(targetClass) {
    installPrototypeMethods(targetClass, GameEngineEntitySyncMethods);
}
