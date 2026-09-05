import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

// Optimization: Reusable temp objects to avoid GC pressure
const TEMP_VEC3 = new THREE.Vector3();
const TEMP_POINT = new THREE.Vector3();
const TEMP_PUSH = new THREE.Vector3();
const TEMP_SPHERE = new THREE.Sphere();
const TEMP_CLOSEST = new THREE.Vector3();
const TEMP_ENTITY_PUSH = new THREE.Vector3();

function stableHash32(str) {
    // FNV-1a 32-bit
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

export class CollisionManager {
    constructor() {
        this.colliders = []; // Array of THREE.Box3
        this.orientedColliders = [];
        this.circularColliders = []; // Array of {x, z, radius}
        this.safeZones = []; // Array of THREE.Box3
        this.dungeonWalkableRects = []; // Canonical server-provided walk rects for local containment
    }

    addCollider(box) {
        this.colliders.push(box);
    }

    addOrientedCollider(collider) {
        this.orientedColliders.push(collider);
    }

    removeOrientedCollider(collider) {
        const index = this.orientedColliders.indexOf(collider);
        if (index >= 0) this.orientedColliders.splice(index, 1);
    }

    addCircularCollider(x, z, radius) {
        // Debug logging removed for performance
        this.circularColliders.push({x, z, radius});
    }

    clear() {
        this.colliders = [];
        this.orientedColliders = [];
        this.circularColliders = [];
        this.safeZones = [];
        this.clearDungeonWalkableGeometry();
    }

    addSafeZone(box) {
        this.safeZones.push(box);
    }

    isPositionSafe(x, z) {
        // Reuse temp vector to avoid allocation
        TEMP_POINT.set(x, 0, z);
        for (let i = 0; i < this.safeZones.length; i++) {
            if (this.safeZones[i].containsPoint(TEMP_POINT)) {
                return true;
            }
        }
        return false;
    }

    setDungeonWalkableGeometry(walkRects = []) {
        if (!Array.isArray(walkRects)) {
            this.dungeonWalkableRects = [];
            return;
        }

        this.dungeonWalkableRects = walkRects
            .filter((rect) => rect && Number.isFinite(rect.x) && Number.isFinite(rect.z) && Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0)
            .map((rect) => ({
                x: rect.x,
                z: rect.z,
                width: rect.width,
                height: rect.height,
                kind: rect.kind,
                minX: rect.x - (rect.width / 2),
                maxX: rect.x + (rect.width / 2),
                minZ: rect.z - (rect.height / 2),
                maxZ: rect.z + (rect.height / 2)
            }));
    }

    clearDungeonWalkableGeometry() {
        this.dungeonWalkableRects = [];
    }

    isPositionInDungeonWalkableArea(x, z, radius = 0) {
        if (this.dungeonWalkableRects.length === 0) return false;

        for (let i = 0; i < this.dungeonWalkableRects.length; i++) {
            const rect = this.dungeonWalkableRects[i];
            if (
                x >= rect.minX + radius &&
                x <= rect.maxX - radius &&
                z >= rect.minZ + radius &&
                z <= rect.maxZ - radius
            ) {
                return true;
            }
        }

        return false;
    }

    constrainToDungeonWalkableArea(position, radius) {
        if (this.dungeonWalkableRects.length === 0) return false;
        if (this.isPositionInDungeonWalkableArea(position.x, position.z, radius)) return false;

        let bestRect = null;
        let bestX = position.x;
        let bestZ = position.z;
        let bestDistSq = Infinity;

        for (let i = 0; i < this.dungeonWalkableRects.length; i++) {
            const rect = this.dungeonWalkableRects[i];
            const minX = rect.minX + radius;
            const maxX = rect.maxX - radius;
            const minZ = rect.minZ + radius;
            const maxZ = rect.maxZ - radius;

            if (minX > maxX || minZ > maxZ) continue;

            const clampedX = Math.max(minX, Math.min(maxX, position.x));
            const clampedZ = Math.max(minZ, Math.min(maxZ, position.z));
            const dx = position.x - clampedX;
            const dz = position.z - clampedZ;
            const distSq = dx * dx + dz * dz;

            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestRect = rect;
                bestX = clampedX;
                bestZ = clampedZ;
            }
        }

        if (!bestRect) return false;

        position.x = bestX;
        position.z = bestZ;
        return true;
    }

    // Check collision against other entities
    checkEntityCollision(entity, chunkManager, ignoreEntity = null) {
        if (!chunkManager) return null;
        
        // Collision always owns logical transforms. Mesh transforms are
        // interpolated presentation state and can intentionally lag one fixed
        // tick; feeding them back into collision creates a correction loop.
        const position = entity.position;
        const radius = entity.radius || 1.0;
        TEMP_ENTITY_PUSH.set(0, 0, 0);
        let count = 0;

        // Optimization: Only check entities in the same chunk and neighbors
        const centerKey = chunkManager.getChunkKey(position.x, position.z);
        const [cx, cz] = centerKey.split(',').map(Number);
        
        // Check 3x3 grid
        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let z = cz - 1; z <= cz + 1; z++) {
                const key = `${x},${z}`;
                if (chunkManager.chunks.has(key)) {
                    const chunkEntities = chunkManager.chunks.get(key);
                    for (const other of chunkEntities) {
                        if (other === entity) continue;
                        if (other === ignoreEntity) continue;
                        if (other.state === 'DEAD') continue; // Ignore dead bodies
                        if (!other.isActive) continue;
                        if (other instanceof THREE.Mesh) continue; // Skip raw meshes if any
                        
                        // Only collide with other Actors (things with stats)
                        if (!other.stats) continue;

                        const otherPos = other.position;

                        // Calculate distance
                        const dx = position.x - otherPos.x;
                        const dz = position.z - otherPos.z;
                        const distSq = dx*dx + dz*dz;
                        
                        const otherRadius = other.radius || 1.0;
                        const minDist = radius + otherRadius;
                        
                        if (distSq < minDist * minDist) {
                            const dist = Math.sqrt(distSq);
                            
                            // Prevent division by zero
                            if (dist < 0.001) {
                                // Too close: deterministic push direction to avoid jitter/non-repro bugs
                                const h = stableHash32(`${entity.id}|${other.id}`);
                                const angle = (h % 360) * (Math.PI / 180);
                                TEMP_ENTITY_PUSH.x += Math.cos(angle);
                                TEMP_ENTITY_PUSH.z += Math.sin(angle);
                            } else {
                                const overlap = minDist - dist;
                                // Push away
                                TEMP_ENTITY_PUSH.x += (dx / dist) * overlap;
                                TEMP_ENTITY_PUSH.z += (dz / dist) * overlap;
                            }
                            count++;
                        }
                    }
                }
            }
        }
        
        if (count > 0) {
            // Return the separation vector
            return TEMP_ENTITY_PUSH;
        }
        return null;
    }

    // Simple circle-box collision resolution
    // Returns the corrected position if collision occurs, or null if no collision
    checkCollision(position, radius, oldPosition = null) {
        let collided = false;
        // Reuse temp vector instead of cloning
        TEMP_VEC3.copy(position);
        
        // 1. Check World Bounds
        const bounds = CONSTANTS.SCENE.BOUNDS;
        
        if (TEMP_VEC3.x < bounds.MIN_X + radius) {
            TEMP_VEC3.x = bounds.MIN_X + radius;
            collided = true;
        } else if (TEMP_VEC3.x > bounds.MAX_X - radius) {
            TEMP_VEC3.x = bounds.MAX_X - radius;
            collided = true;
        }

        if (TEMP_VEC3.z < bounds.MIN_Z + radius) {
            TEMP_VEC3.z = bounds.MIN_Z + radius;
            collided = true;
        } else if (TEMP_VEC3.z > bounds.MAX_Z - radius) {
            TEMP_VEC3.z = bounds.MAX_Z - radius;
            collided = true;
        }

        // Reuse temp sphere instead of creating new one
        TEMP_SPHERE.set(TEMP_VEC3, radius);

        // Use indexed loop for slight performance gain
        const collidersLen = this.colliders.length;
        for (let i = 0; i < collidersLen; i++) {
            const box = this.colliders[i];
            if (box.intersectsSphere(TEMP_SPHERE)) {
                collided = true;
                
                let preferredFace = null;
                if (oldPosition) {
                    const distMinX = box.min.x - oldPosition.x;
                    const distMaxX = oldPosition.x - box.max.x;
                    const distMinZ = box.min.z - oldPosition.z;
                    const distMaxZ = oldPosition.z - box.max.z;

                    const maxDist = Math.max(distMinX, distMaxX, distMinZ, distMaxZ);
                    
                    if (maxDist > 0) {
                        if (maxDist === distMinX) preferredFace = 'minX';
                        else if (maxDist === distMaxX) preferredFace = 'maxX';
                        else if (maxDist === distMinZ) preferredFace = 'minZ';
                        else if (maxDist === distMaxZ) preferredFace = 'maxZ';
                    }
                }

                // Check if center is inside the box (Tunneling fix)
                if (box.containsPoint(TEMP_VEC3)) {
                     const min = box.min;
                     const max = box.max;
                     const epsilon = 0.01;
                     
                     if (preferredFace === 'minX') { TEMP_VEC3.x = min.x - radius - epsilon; continue; }
                     if (preferredFace === 'maxX') { TEMP_VEC3.x = max.x + radius + epsilon; continue; }
                     if (preferredFace === 'minZ') { TEMP_VEC3.z = min.z - radius - epsilon; continue; }
                     if (preferredFace === 'maxZ') { TEMP_VEC3.z = max.z + radius + epsilon; continue; }

                     // Distances to each face
                     const dx1 = TEMP_VEC3.x - min.x;
                     const dx2 = max.x - TEMP_VEC3.x;
                     const dz1 = TEMP_VEC3.z - min.z;
                     const dz2 = max.z - TEMP_VEC3.z;
                     
                     // Find minimum penetration
                     const minP = Math.min(dx1, dx2, dz1, dz2);
                     
                     // Push out + radius buffer + epsilon
                     if (minP === dx1) TEMP_VEC3.x = min.x - radius - epsilon;
                     else if (minP === dx2) TEMP_VEC3.x = max.x + radius + epsilon;
                     else if (minP === dz1) TEMP_VEC3.z = min.z - radius - epsilon;
                     else if (minP === dz2) TEMP_VEC3.z = max.z + radius + epsilon;
                     
                     continue;
                }

                // Find closest point on box to sphere center - reuse temp vector
                box.clampPoint(TEMP_VEC3, TEMP_CLOSEST);
                
                // Calculate push vector - reuse temp vector
                TEMP_PUSH.subVectors(TEMP_VEC3, TEMP_CLOSEST);
                const distance = TEMP_PUSH.length();
                
                // Push out
                if (distance < radius && distance > 0) {
                    TEMP_PUSH.normalize();
                    TEMP_PUSH.multiplyScalar(radius - distance);
                    TEMP_VEC3.add(TEMP_PUSH);
                }
            }
        }

        // Resolve in each building's local frame, not its oversized rotated AABB.
        for (const collider of this.orientedColliders) {
            TEMP_POINT.copy(TEMP_VEC3).applyMatrix4(collider.inverse);
            TEMP_CLOSEST.setFromMatrixScale(collider.matrix);
            const localRadius = radius / Math.min(Math.abs(TEMP_CLOSEST.x), Math.abs(TEMP_CLOSEST.z));
            const box = collider.box;
            const x = Math.max(box.min.x, Math.min(box.max.x, TEMP_POINT.x));
            const z = Math.max(box.min.z, Math.min(box.max.z, TEMP_POINT.z));
            const dx = TEMP_POINT.x - x, dz = TEMP_POINT.z - z;
            const distance = Math.hypot(dx, dz);
            if (distance >= localRadius || TEMP_POINT.y > box.max.y + localRadius) continue;
            if (distance > 0.00001) {
                TEMP_POINT.x = x + dx / distance * localRadius;
                TEMP_POINT.z = z + dz / distance * localRadius;
            } else {
                const faces = [TEMP_POINT.x - box.min.x, box.max.x - TEMP_POINT.x, TEMP_POINT.z - box.min.z, box.max.z - TEMP_POINT.z];
                let face = faces.indexOf(Math.min(...faces));
                if (oldPosition) {
                    TEMP_CLOSEST.copy(oldPosition).applyMatrix4(collider.inverse);
                    if (TEMP_CLOSEST.x < box.min.x) face = 0;
                    else if (TEMP_CLOSEST.x > box.max.x) face = 1;
                    else if (TEMP_CLOSEST.z < box.min.z) face = 2;
                    else if (TEMP_CLOSEST.z > box.max.z) face = 3;
                }
                if (face === 0) TEMP_POINT.x = box.min.x - localRadius;
                if (face === 1) TEMP_POINT.x = box.max.x + localRadius;
                if (face === 2) TEMP_POINT.z = box.min.z - localRadius;
                if (face === 3) TEMP_POINT.z = box.max.z + localRadius;
            }
            const height = TEMP_VEC3.y;
            TEMP_VEC3.copy(TEMP_POINT).applyMatrix4(collider.matrix);
            TEMP_VEC3.y = height;
            collided = true;
        }

        // 3. Circular Colliders
        const circularLen = this.circularColliders.length;
        for (let i = 0; i < circularLen; i++) {
            const circle = this.circularColliders[i];
            const dx = TEMP_VEC3.x - circle.x;
            const dz = TEMP_VEC3.z - circle.z;
            const distSq = dx*dx + dz*dz;
            const minDist = circle.radius + radius;
            
            if (distSq < minDist * minDist) {
                collided = true;
                const dist = Math.sqrt(distSq);
                if (dist > 0) {
                    // Push out
                    const overlap = minDist - dist;
                    const pushX = (dx / dist) * overlap;
                    const pushZ = (dz / dist) * overlap;
                    TEMP_VEC3.x += pushX;
                    TEMP_VEC3.z += pushZ;
                }
            }
        }

        if (this.constrainToDungeonWalkableArea(TEMP_VEC3, radius)) {
            collided = true;
        }

        return collided ? TEMP_VEC3.clone() : null;
    }
}
