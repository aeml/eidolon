import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export class ChunkManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map(); // Key: "x,z", Value: Set of Entities
        this.activeChunkKeys = new Set();
        this.chunkSize = CONSTANTS.SCENE.CHUNK_SIZE;
        this.loadDistance = CONSTANTS.SCENE.LOAD_DISTANCE;
    }

    getChunkKey(x, z) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        return `${cx},${cz}`;
    }

    update(player, dt, collisionManager) {
        if (!player) return;
        
        // console.log("ChunkManager: update running"); // Uncomment for spammy debug

        const playerPos = player.position;
        const playerChunkKey = this.getChunkKey(playerPos.x, playerPos.z);
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

        // 4. Update entities in active chunks
        for (const key of this.activeChunkKeys) {
            if (this.chunks.has(key)) {
                const entities = this.chunks.get(key);
                // We need to iterate over a copy or be careful because moveEntity modifies the Set
                const entitiesArray = Array.from(entities); 
                for (const entity of entitiesArray) {
                    entity.update(dt, collisionManager, player);
                    
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
        console.log(`ChunkManager: Adding entity ${entity.id} to chunk ${key}`);
        if (!this.chunks.has(key)) {
            this.chunks.set(key, new Set());
        }
        this.chunks.get(key).add(entity);
        
        // If adding to an active chunk, ensure it's visible
        if (this.activeChunkKeys.has(key)) {
            if (entity.mesh) {
                this.scene.add(entity.mesh);
            }
        } else {
            // Ensure it is NOT in the scene if the chunk is inactive
            // (In case the entity was just created with a mesh that hasn't been added yet, 
            // or if we are re-adding an entity)
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

        // Handle visibility changes if crossing active/inactive boundary
        const isActiveOld = this.activeChunkKeys.has(oldKey);
        const isActiveNew = this.activeChunkKeys.has(newKey);

        if (isActiveOld && !isActiveNew) {
            if (entity.mesh) this.scene.remove(entity.mesh);
        } else if (!isActiveOld && isActiveNew) {
            if (entity.mesh) this.scene.add(entity.mesh);
        }
    }

    loadChunk(key) {
        console.log(`ChunkManager: Loading chunk ${key}`);
        if (this.chunks.has(key)) {
            for (const entity of this.chunks.get(key)) {
                if (entity.mesh) {
                    console.log(`ChunkManager: Adding mesh for ${entity.id} to scene`);
                    this.scene.add(entity.mesh);
                } else {
                    console.log(`ChunkManager: Entity ${entity.id} has no mesh yet`);
                }
            }
        }
    }

    unloadChunk(key) {
        if (this.chunks.has(key)) {
            for (const entity of this.chunks.get(key)) {
                if (entity.mesh) this.scene.remove(entity.mesh);
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
}
