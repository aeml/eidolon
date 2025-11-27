import { MeshFactory } from '../utils/MeshFactory.js';
import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export class ChunkManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map(); // Key: "x,z", Value: Set of Entities
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
        
        // Only update active chunks if player moved to a new chunk
        if (playerChunkKey !== this.lastPlayerChunkKey) {
            this.lastPlayerChunkKey = playerChunkKey;
            const [px, pz] = playerChunkKey.split(',').map(Number);

            // 1. Determine which chunks should be active
            const newActiveKeys = new Set();
            for (let x = px - this.loadDistance; x <= px + this.loadDistance; x++) {
                for (let z = pz - this.loadDistance; z <= pz + this.loadDistance; z++) {
                    newActiveKeys.add(`${x},${z}`);
                }
            }

            // 2. Unload chunks that are no longer active
            for (const key of this.activeChunkKeys) {
                if (!newActiveKeys.has(key)) {
                    this.unloadChunk(key);
                }
            }

            // 3. Load new active chunks
            for (const key of newActiveKeys) {
                if (!this.activeChunkKeys.has(key)) {
                    this.loadChunk(key);
                }
            }

            this.activeChunkKeys = newActiveKeys;
        }

        // 4. Update entities in active chunks
        for (const key of this.activeChunkKeys) {
            if (this.chunks.has(key)) {
                const entities = this.chunks.get(key);
                // Iterate directly to avoid GC. Use frame check to prevent double updates.
                for (const entity of entities) {
                    if (entity._lastUpdateFrame === this.frameCount) continue;
                    entity._lastUpdateFrame = this.frameCount;

                    entity.update(dt, collisionManager, player);
                    
                    if (!entity.isActive) {
                        // Remove entity
                        this.removeEntity(entity);
                        continue;
                    }

                    // Check if entity moved to a different chunk
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
        entity._chunkKey = key; // Track chunk key on entity
        console.log(`ChunkManager: Adding entity ${entity.id} to chunk ${key}`);
        if (!this.chunks.has(key)) {
            this.chunks.set(key, new Set());
        }
        this.chunks.get(key).add(entity);
        
        // If adding to an active chunk, ensure it's visible
        // Special Case: DwarfSalesman is always visible
        if (this.activeChunkKeys.has(key) || entity.type === 'DwarfSalesman') {
            // Lazy Load Mesh if needed
            if (!entity.mesh && entity.ensureMesh) {
                entity.ensureMesh();
            }

            if (entity.mesh) {
                this.scene.add(entity.mesh);
            }
        } else {
            // Ensure it is NOT in the scene if the chunk is inactive
            if (entity.mesh && entity.mesh.parent === this.scene) {
                this.scene.remove(entity.mesh);
            }
        }
    }

    moveEntity(entity, oldKey, newKey) {
        // Remove from old
        if (this.chunks.has(oldKey)) {
            this.chunks.get(oldKey).delete(entity);
        }

        // Add to new
        if (!this.chunks.has(newKey)) {
            this.chunks.set(newKey, new Set());
        }
        this.chunks.get(newKey).add(entity);
        entity._chunkKey = newKey; // Update key

        // Handle visibility changes if crossing active/inactive boundary
        const isActiveOld = this.activeChunkKeys.has(oldKey);
        const isActiveNew = this.activeChunkKeys.has(newKey);

        if (isActiveOld && !isActiveNew) {
            if (entity.mesh) this.scene.remove(entity.mesh);
        } else if (!isActiveOld && isActiveNew) {
            if (entity.mesh) this.scene.add(entity.mesh);
        }
    }

    // Force update an entity's chunk (useful after teleporting)
    updateEntityChunk(entity) {
        if (!entity._chunkKey) {
            // If for some reason it's missing, try to find it or just add it
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
                // Lazy Load Mesh
                if (!entity.mesh && entity.ensureMesh) {
                    entity.ensureMesh();
                }

                if (entity.mesh) {
                    console.log(`ChunkManager: Adding mesh for ${entity.id} to scene`);
                    this.scene.add(entity.mesh);
                } else {
                    // console.log(`ChunkManager: Entity ${entity.id} has no mesh yet`);
                }
            }
        }
    }

    unloadChunk(key) {
        if (this.chunks.has(key)) {
            for (const entity of this.chunks.get(key)) {
                // Special Case: DwarfSalesman is always visible/loaded
                if (entity.type === 'DwarfSalesman') continue;

                if (entity.mesh) {
                    this.scene.remove(entity.mesh);
                    
                    // Aggressive Memory Saving: Recycle mesh if it's not the player
                    if (entity.id !== 'player-1' && entity.meshType) {
                        // console.log(`ChunkManager: Recycling mesh for ${entity.id}`);
                        MeshFactory.releaseMesh(entity.meshType, entity.mesh);
                        entity.mesh = null; 
                        entity.isMeshLoading = false; 
                    }
                }
            }
        }
    }
    
    getActiveEntities() {
        const active = [];
        for (const key of this.activeChunkKeys) {
            if (this.chunks.has(key)) {
                for (const entity of this.chunks.get(key)) {
                    active.push(entity);
                }
            }
        }
        return active;
    }

    removeEntity(entity) {
        const key = entity._chunkKey || this.getChunkKey(entity.position.x, entity.position.z);
        if (this.chunks.has(key)) {
            this.chunks.get(key).delete(entity);
        }
        if (entity.mesh) {
            this.scene.remove(entity.mesh);
            // Optional: Dispose geometry/material if not shared
        }
    }
}
