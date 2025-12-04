import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export class CollisionManager {
    constructor() {
        this.colliders = []; // Array of THREE.Box3
        this.safeZones = []; // Array of THREE.Box3
    }

    addCollider(box) {
        this.colliders.push(box);
    }

    addSafeZone(box) {
        this.safeZones.push(box);
    }

    isPositionSafe(x, z) {
        const point = new THREE.Vector3(x, 0, z);
        for (const zone of this.safeZones) {
            if (zone.containsPoint(point)) {
                return true;
            }
        }
        return false;
    }

    // Check collision against other entities
    checkEntityCollision(entity, activeEntities, ignoreEntity = null) {
        if (!activeEntities) return null;
        
        // Use mesh position if available for visual collision (prevents jitter)
        const position = entity.mesh ? entity.mesh.position : entity.position;
        const radius = entity.radius || 1.0;
        const pushVec = new THREE.Vector3();
        let count = 0;

        for (const other of activeEntities) {
            if (other === entity) continue;
            if (other === ignoreEntity) continue;
            if (other.state === 'DEAD') continue; // Ignore dead bodies
            if (!other.isActive) continue;
            if (other instanceof THREE.Mesh) continue; // Skip raw meshes if any
            
            // Only collide with other Actors (things with stats)
            // This prevents enemies from vibrating against Loot, Projectiles, etc.
            if (!other.stats) continue;

            const otherPos = other.mesh ? other.mesh.position : other.position;

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
                    // Too close, push in random direction
                    pushVec.x += (Math.random() - 0.5);
                    pushVec.z += (Math.random() - 0.5);
                } else {
                    const overlap = minDist - dist;
                    // Push away
                    pushVec.x += (dx / dist) * overlap;
                    pushVec.z += (dz / dist) * overlap;
                }
                count++;
            }
        }
        
        if (count > 0) {
            // Return the separation vector
            // We can weigh it if needed, but returning the sum of overlaps works well for iterative solving
            return pushVec;
        }
        return null;
    }

    // Simple circle-box collision resolution
    // Returns the corrected position if collision occurs, or null if no collision
    checkCollision(position, radius, oldPosition = null) {
        let collided = false;
        const tempPos = position.clone();
        
        // 1. Check World Bounds
        const bounds = CONSTANTS.SCENE.BOUNDS;
        
        if (tempPos.x < bounds.MIN_X + radius) {
            tempPos.x = bounds.MIN_X + radius;
            collided = true;
        } else if (tempPos.x > bounds.MAX_X - radius) {
            tempPos.x = bounds.MAX_X - radius;
            collided = true;
        }

        if (tempPos.z < bounds.MIN_Z + radius) {
            tempPos.z = bounds.MIN_Z + radius;
            collided = true;
        } else if (tempPos.z > bounds.MAX_Z - radius) {
            tempPos.z = bounds.MAX_Z - radius;
            collided = true;
        }

        // We treat the entity as a sphere/circle
        const sphere = new THREE.Sphere(tempPos, radius);

        for (const box of this.colliders) {
            if (box.intersectsSphere(sphere)) {
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
                if (box.containsPoint(tempPos)) {
                     const min = box.min;
                     const max = box.max;
                     const epsilon = 0.01;
                     
                     if (preferredFace === 'minX') { tempPos.x = min.x - radius - epsilon; continue; }
                     if (preferredFace === 'maxX') { tempPos.x = max.x + radius + epsilon; continue; }
                     if (preferredFace === 'minZ') { tempPos.z = min.z - radius - epsilon; continue; }
                     if (preferredFace === 'maxZ') { tempPos.z = max.z + radius + epsilon; continue; }

                     // Distances to each face
                     const dx1 = tempPos.x - min.x;
                     const dx2 = max.x - tempPos.x;
                     const dz1 = tempPos.z - min.z;
                     const dz2 = max.z - tempPos.z;
                     
                     // Find minimum penetration
                     const minP = Math.min(dx1, dx2, dz1, dz2);
                     
                     // Push out + radius buffer + epsilon
                     if (minP === dx1) tempPos.x = min.x - radius - epsilon;
                     else if (minP === dx2) tempPos.x = max.x + radius + epsilon;
                     else if (minP === dz1) tempPos.z = min.z - radius - epsilon;
                     else if (minP === dz2) tempPos.z = max.z + radius + epsilon;
                     
                     continue;
                }

                // Find closest point on box to sphere center
                const closestPoint = new THREE.Vector3();
                box.clampPoint(tempPos, closestPoint);
                
                // Calculate push vector
                const push = new THREE.Vector3().subVectors(tempPos, closestPoint);
                const distance = push.length();
                
                // Push out
                if (distance < radius && distance > 0) {
                    push.normalize();
                    push.multiplyScalar(radius - distance);
                    tempPos.add(push);
                }
            }
        }

        return collided ? tempPos : null;
    }
}
