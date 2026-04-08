import { MeshFactory } from '../utils/MeshFactory.js';
import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export const ALWAYS_RESIDENT_ENTITY_TYPES = new Set([
    'DwarfSalesman',
    'Stash',
    'QuestNPC',
    'RespecNPC',
    'Forge',
    'TradingHouse'
]);

export function isAlwaysResidentEntityType(type) {
    return ALWAYS_RESIDENT_ENTITY_TYPES.has(type);
}

export class ChunkManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.activeChunkKeys = new Set();
        this.chunkSize = CONSTANTS.SCENE.CHUNK_SIZE;
        this.loadDistance = CONSTANTS.SCENE.LOAD_DISTANCE;
        this.lastPlayerChunkKey = null;
        this.frameCount = 0;
        this._cachedActiveEntities = [];
        this._cachedActiveEntitiesFrame = -1;
        this._activeChunksChanged = true; // Track when active chunks change for cache invalidation
    }

    getChunkKey(x, z) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        return `${cx},${cz}`;
    }

    update(player, dt, collisionManager, floatingTextManager, gameEngine) {
        if (!player) return;
        
        this.frameCount++;

        const playerPos = player.position;
        const playerChunkKey = this.getChunkKey(playerPos.x, playerPos.z);
        
        if (playerChunkKey !== this.lastPlayerChunkKey) {
            this.lastPlayerChunkKey = playerChunkKey;
            const [px, pz] = playerChunkKey.split(',').map(Number);

            const newActiveKeys = new Set();
            for (let x = px - this.loadDistance; x <= px + this.loadDistance; x++) {
                for (let z = pz - this.loadDistance; z <= pz + this.loadDistance; z++) {
                    newActiveKeys.add(`${x},${z}`);
                }
            }

            for (const key of this.activeChunkKeys) {
                if (!newActiveKeys.has(key)) {
                    this.unloadChunk(key);
                }
            }

            for (const key of newActiveKeys) {
                if (!this.activeChunkKeys.has(key)) {
                    this.loadChunk(key);
                }
            }

            this.activeChunkKeys = newActiveKeys;
            this._activeChunksChanged = true; // Mark cache as stale
        }

        // Calculate active entities once for this frame to pass to entities that need it (like Projectiles)
        // Note: CollisionManager now uses chunkManager directly for spatial queries, but Projectiles might still use this list.
        const activeEntities = this.getActiveEntities();

        for (const key of this.activeChunkKeys) {
            if (this.chunks.has(key)) {
                const entities = this.chunks.get(key);
                for (const entity of entities) {
                    if (entity._lastUpdateFrame === this.frameCount) continue;
                    entity._lastUpdateFrame = this.frameCount;

                    // Robust mesh recovery: if a previous mesh load failed/transiently stalled,
                    // retry for active entities every ~30 frames.
                    if (!entity.mesh && !entity.isMeshLoading && entity.ensureMesh) {
                        if (!entity._nextMeshRetryFrame || this.frameCount >= entity._nextMeshRetryFrame) {
                            entity._nextMeshRetryFrame = this.frameCount + 30;
                            entity.ensureMesh().then(() => {
                                const currentKey = this.getChunkKey(entity.position.x, entity.position.z);
                                if (this.activeChunkKeys.has(currentKey) && entity.mesh && entity.mesh.parent !== this.scene) {
                                    this.scene.add(entity.mesh);
                                }
                            }).catch((err) => {
                                console.warn(`ChunkManager: mesh retry failed for ${entity.id}`, err);
                            });
                        }
                    }

                    // Pass 'this' (ChunkManager) instead of activeEntities for collision optimization
                    // But we also pass activeEntities for legacy support if needed by other systems
                    // Actually, we need to update Entity.update signature or just pass both?
                    // Let's pass 'this' as the 4th argument, replacing activeEntities?
                    // Wait, Entity.update(dt, collisionManager, player, activeEntities, ...)
                    // If we change the signature, we break Projectile.js etc.
                    // Let's pass 'this' as a property of activeEntities? No that's hacky.
                    // Let's just pass 'this' INSTEAD of activeEntities?
                    // Projectile.js uses activeEntities for collision?
                    // Let's check Projectile.js.
                    
                    // For now, let's assume we update Entity.update to accept chunkManager OR activeEntities.
                    // But CollisionManager.checkEntityCollision now EXPECTS chunkManager.
                    // So we MUST pass chunkManager to Entity.update, which passes it to CollisionManager.
                    
                    // Let's pass chunkManager as the 4th argument.
                    entity.update(dt, collisionManager, player, this, floatingTextManager, gameEngine);
                    
                    if (!entity.isActive) {
                        this.removeEntity(entity);
                        continue;
                    }

                    const newKey = this.getChunkKey(entity.position.x, entity.position.z);
                    if (newKey !== key) {
                        this.moveEntity(entity, key, newKey);
                    }
                }
            }
        }
    }

    addEntity(entity) {
        const key = this.getChunkKey(entity.position.x, entity.position.z);
        entity._chunkKey = key;
        // Debug logging removed for performance
        if (!this.chunks.has(key)) {
            this.chunks.set(key, new Set());
        }
        this.chunks.get(key).add(entity);
        
        if (this.activeChunkKeys.has(key) || isAlwaysResidentEntityType(entity.type)) {
            if (!entity.mesh && entity.ensureMesh) {
                entity.ensureMesh().then(() => {
                    const currentKey = this.getChunkKey(entity.position.x, entity.position.z);
                    if ((this.activeChunkKeys.has(currentKey) || isAlwaysResidentEntityType(entity.type)) && entity.mesh) {
                        this.scene.add(entity.mesh);
                    }
                });
            }

            if (entity.mesh) {
                this.scene.add(entity.mesh);
            }
        } else {
            if (entity.mesh && entity.mesh.parent === this.scene) {
                this.scene.remove(entity.mesh);
            }
        }
    }

    moveEntity(entity, oldKey, newKey) {
        if (this.chunks.has(oldKey)) {
            this.chunks.get(oldKey).delete(entity);
        }

        if (!this.chunks.has(newKey)) {
            this.chunks.set(newKey, new Set());
        }
        this.chunks.get(newKey).add(entity);
        entity._chunkKey = newKey;

        const isActiveOld = this.activeChunkKeys.has(oldKey);
        const isActiveNew = this.activeChunkKeys.has(newKey);

        if (isActiveOld && !isActiveNew) {
            if (entity.mesh?.parent?.remove) entity.mesh.parent.remove(entity.mesh);
        } else if (!isActiveOld && isActiveNew) {
            if (entity.mesh) {
                this.scene.add(entity.mesh);
            } else if (entity.ensureMesh) {
                entity.ensureMesh().then(() => {
                    const currentKey = this.getChunkKey(entity.position.x, entity.position.z);
                    if (this.activeChunkKeys.has(currentKey) && entity.mesh) {
                        this.scene.add(entity.mesh);
                    }
                });
            }
        }
    }

    updateEntityChunk(entity) {
        if (!entity._chunkKey) {
            this.addEntity(entity);
            return;
        }

        const oldKey = entity._chunkKey;
        const newKey = this.getChunkKey(entity.position.x, entity.position.z);
        
        if (oldKey !== newKey) {
            // Debug logging removed for performance
            this.moveEntity(entity, oldKey, newKey);
        }
    }

    loadChunk(key) {
        // Debug logging removed for performance
        if (this.chunks.has(key)) {
            for (const entity of this.chunks.get(key)) {
                if (!entity.mesh && entity.ensureMesh) {
                    entity.ensureMesh().then(() => {
                        const currentKey = this.getChunkKey(entity.position.x, entity.position.z);
                        if ((this.activeChunkKeys.has(currentKey) || isAlwaysResidentEntityType(entity.type)) && entity.mesh) {
                            this.scene.add(entity.mesh);
                        }
                    });
                }

                if (entity.mesh) {
                    // Debug logging removed for performance
                    this.scene.add(entity.mesh);
                }
            }
        }
    }

    unloadChunk(key) {
        if (this.chunks.has(key)) {
            for (const entity of this.chunks.get(key)) {
                if (isAlwaysResidentEntityType(entity.type)) continue;

                if (entity.dispose) {
                    entity.dispose();
                } else if (entity.mesh?.parent?.remove) {
                    entity.mesh.parent.remove(entity.mesh);
                }
                
                // Ensure state is reset for reloading
                entity.mesh = null;
                entity.isMeshLoading = false;
            }
        }
    }
    
    getActiveEntities() {
        // Use frame-based caching with chunk change detection for optimal performance
        if (this._cachedActiveEntitiesFrame === this.frameCount && !this._activeChunksChanged) {
            return this._cachedActiveEntities;
        }
        
        // Only rebuild if chunks changed or first call this frame
        if (this._activeChunksChanged || this._cachedActiveEntitiesFrame !== this.frameCount) {
            // Clear array without allocating new one
            this._cachedActiveEntities.length = 0;
            
            for (const key of this.activeChunkKeys) {
                const chunk = this.chunks.get(key);
                if (chunk) {
                    for (const entity of chunk) {
                        this._cachedActiveEntities.push(entity);
                    }
                }
            }
            
            this._cachedActiveEntitiesFrame = this.frameCount;
            this._activeChunksChanged = false;
        }
        
        return this._cachedActiveEntities;
    }

    removeEntity(entity) {
        const key = entity._chunkKey || this.getChunkKey(entity.position.x, entity.position.z);
        if (this.chunks.has(key)) {
            this.chunks.get(key).delete(entity);
        }
        
        if (entity.dispose) {
            entity.dispose();
        } else if (entity.mesh?.parent?.remove) {
            entity.mesh.parent.remove(entity.mesh);
        }
    }
}
