import * as THREE from 'three';

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

    // Simple circle-box collision resolution
    // Returns the corrected position if collision occurs, or null if no collision
    checkCollision(position, radius) {
        let collided = false;
        const tempPos = position.clone();
        
        // We treat the entity as a sphere/circle
        const sphere = new THREE.Sphere(tempPos, radius);

        for (const box of this.colliders) {
            if (box.intersectsSphere(sphere)) {
                collided = true;
                
                // Find closest point on box to sphere center
                const closestPoint = new THREE.Vector3();
                box.clampPoint(tempPos, closestPoint);
                
                // Calculate push vector
                const push = new THREE.Vector3().subVectors(tempPos, closestPoint);
                const distance = push.length();
                
                // If center is inside box, push will be 0, handle that
                if (distance === 0) {
                    // Push out along shortest axis (simple heuristic)
                    // For now, just push back along velocity (not available here) or just ignore
                    continue; 
                }

                // Push out
                if (distance < radius) {
                    push.normalize();
                    push.multiplyScalar(radius - distance);
                    tempPos.add(push);
                }
            }
        }

        return collided ? tempPos : null;
    }
}
