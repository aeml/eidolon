import { MeshFactory } from '../utils/MeshFactory.js';
import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export class ChunkManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.activeChunkKeys = new Set();
        this.chunkSize = CONSTANTS.SCENE.CHUNK_SIZE;
        this.loadDistance = CONSTANTS.SCENE.LOAD_DISTANCE;
        this.lastPlayerChunkKey = null;
        this.frameCount = 0;
    }

    getChunkKey(x, z) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        return `${cx},${cz}`;
    }

    update(player, dt, collisionManager) {
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
        }

        // Calculate active entities once for this frame to pass to entities that need it (like Projectiles)
        const activeEntities = this.getActiveEntities();

        for (const key of this.activeChunkKeys) {
            if (this.chunks.has(key)) {
                const entities = this.chunks.get(key);
                for (const entity of entities) {
                    if (entity._lastUpdateFrame === this.frameCount) continue;
                    entity._lastUpdateFrame = this.frameCount;

                    entity.update(dt, collisionManager, player, activeEntities);
                    
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
        console.log(`ChunkManager: Adding entity ${entity.id} to chunk ${key}`);
        if (!this.chunks.has(key)) {
            this.chunks.set(key, new Set());
        }
        this.chunks.get(key).add(entity);
        
        if (this.activeChunkKeys.has(key) || entity.type === 'DwarfSalesman') {
            if (!entity.mesh && entity.ensureMesh) {
                entity.ensureMesh().then(() => {
                    const currentKey = this.getChunkKey(entity.position.x, entity.position.z);
                    if ((this.activeChunkKeys.has(currentKey) || entity.type === 'DwarfSalesman') && entity.mesh) {
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
            if (entity.mesh) this.scene.remove(entity.mesh);
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
            console.log(`ChunkManager: Force moving entity ${entity.id} from ${oldKey} to ${newKey}`);
            this.moveEntity(entity, oldKey, newKey);
        }
    }

    loadChunk(key) {
        console.log(`ChunkManager: Loading chunk ${key}`);
        if (this.chunks.has(key)) {
            for (const entity of this.chunks.get(key)) {
                if (!entity.mesh && entity.ensureMesh) {
                    entity.ensureMesh().then(() => {
                        const currentKey = this.getChunkKey(entity.position.x, entity.position.z);
                        if ((this.activeChunkKeys.has(currentKey) || entity.type === 'DwarfSalesman') && entity.mesh) {
                            this.scene.add(entity.mesh);
                        }
                    });
                }

                if (entity.mesh) {
                    console.log(`ChunkManager: Adding mesh for ${entity.id} to scene`);
                    this.scene.add(entity.mesh);
                }
            }
        }
    }

    unloadChunk(key) {
        if (this.chunks.has(key)) {
            for (const entity of this.chunks.get(key)) {
                if (entity.type === 'DwarfSalesman') continue;

                if (entity.dispose) {
                    entity.dispose();
                } else if (entity.mesh) {
                    this.scene.remove(entity.mesh);
                }
                
                // Ensure state is reset for reloading
                entity.mesh = null;
                entity.isMeshLoading = false;
            }
        }
    }
    
    getActiveEntities() {
        if (this._cachedActiveEntitiesFrame === this.frameCount && this._cachedActiveEntities) {
            return this._cachedActiveEntities;
        }
        const active = [];
        for (const key of this.activeChunkKeys) {
            if (this.chunks.has(key)) {
                for (const entity of this.chunks.get(key)) {
                    active.push(entity);
                }
            }
        }
        this._cachedActiveEntities = active;
        this._cachedActiveEntitiesFrame = this.frameCount;
        return active;
    }

    removeEntity(entity) {
        const key = entity._chunkKey || this.getChunkKey(entity.position.x, entity.position.z);
        if (this.chunks.has(key)) {
            this.chunks.get(key).delete(entity);
        }
        
        if (entity.dispose) {
            entity.dispose();
        } else if (entity.mesh) {
            this.scene.remove(entity.mesh);
        }
    }
}
