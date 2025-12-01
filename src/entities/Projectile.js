import * as THREE from 'three';
import { Entity } from './Entity.js';

// Shared Resources
const FIREBALL_GEO = new THREE.SphereGeometry(0.5, 8, 8);
const FIREBALL_MAT = new THREE.MeshStandardMaterial({ 
    color: 0xff4500, 
    emissive: 0xff0000,
    emissiveIntensity: 2
});

const DAGGER_GEO = new THREE.ConeGeometry(0.2, 1.0, 8);
DAGGER_GEO.rotateX(Math.PI / 2); // Point forward
const DAGGER_MAT = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });

export class Projectile extends Entity {
    constructor(id, owner, type, startPos, targetPos) {
        super(id);
        this.owner = owner;
        this.type = type; // 'Fireball', 'Dagger'
        if (startPos) {
            this.position.copy(startPos);
        }
        
        // Calculate velocity
        if (targetPos && startPos) {
            const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
            this.speed = type === 'Fireball' ? 20 : 35; // Increased speed
            this.velocity = direction.multiplyScalar(this.speed);
        } else {
            this.velocity = new THREE.Vector3(0, 0, 1);
        }
        
        this.damage = 0;
        this.radius = type === 'Fireball' ? 2.0 : 1.5; // Increased hit radius
        this.lifeTime = 10.0; // Increased lifetime to allow long-range shots
        
        this.hitEntities = new Set(); // Track entities hit by this projectile

        this.initMesh();
    }

    initMesh() {
        let geometry, material;
        
        if (this.type === 'Fireball') {
            geometry = FIREBALL_GEO;
            material = FIREBALL_MAT;
            this.damage = 20 + (this.owner.stats.intelligence * 2);
        } else if (this.type === 'Dagger') {
            geometry = DAGGER_GEO;
            material = DAGGER_MAT;
            this.damage = 15 + (this.owner.stats.dexterity * 1.5);
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.userData.entityId = this.id; // Ensure ID is set for raycasting/identification
        
        // Rotate to face direction
        const lookTarget = this.position.clone().add(this.velocity);
        this.mesh.lookAt(lookTarget);
        this.rotation.copy(this.mesh.quaternion);
    }

    update(dt, collisionManager, player, activeEntities) { 
        // In multiplayer, position is authoritative from server, but we can interpolate
        // If this is a remote projectile, we might want to just let the server update position
        // However, for smoothness, we can predict movement
        
        this.lifeTime -= dt;
        if (this.lifeTime <= 0) {
            this.isActive = false;
            return;
        }

        // Move
        const moveStep = this.velocity.clone().multiplyScalar(dt);
        this.position.add(moveStep);
        
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }

        // Collision Detection (Client-side prediction / Singleplayer)
        if (activeEntities) {
            const hitRadius = 1.0; // Collision radius

            for (const entity of activeEntities) {
                // Skip self, owner, dead entities, and already hit entities (for pierce)
                if (entity === this || entity === this.owner || entity.state === 'DEAD' || !entity.isActive) continue;
                if (this.hitEntities.has(entity.id)) continue;
                
                // Skip friendly fire (Player vs Player handled by server, but locally we ignore)
                // Assuming owner is Player, ignore other Players? Or if owner is Enemy, ignore Enemies?
                // For now, simple check: If owner is Player, ignore Player.
                if (this.owner && this.owner.constructor.name === entity.constructor.name) continue;
                // Also ignore Loot
                if (entity.constructor.name === 'LootDrop') continue;

                const dist = this.position.distanceTo(entity.position);
                if (dist < hitRadius + (entity.radius || 0.5)) {
                    // HIT!
                    
                    if (this.type === 'Dagger') {
                        // Pierce Logic: Hit and continue
                        this.hitEntities.add(entity.id);
                        // Visual effect?
                        // Apply damage if singleplayer
                        if (!this.owner.isMultiplayer && !this.owner.isRemote) {
                            entity.takeDamage(this.damage);
                        }
                    } else if (this.type === 'Fireball') {
                        // Explode Logic: Hit, Splash, Destroy
                        this.isActive = false; // Destroy projectile
                        
                        // Splash Damage
                        const splashRadius = 4.0;
                        // Find all entities in splash radius
                        for (const splashTarget of activeEntities) {
                            if (splashTarget.state === 'DEAD' || !splashTarget.isActive) continue;
                            if (splashTarget.constructor.name === 'LootDrop') continue;
                            if (this.owner && this.owner.constructor.name === splashTarget.constructor.name) continue;

                            const splashDist = this.position.distanceTo(splashTarget.position);
                            if (splashDist < splashRadius) {
                                if (!this.owner.isMultiplayer && !this.owner.isRemote) {
                                    splashTarget.takeDamage(this.damage);
                                }
                            }
                        }
                        
                        // Visual Explosion (Simple scale up and fade out or particle system)
                        // For now, we just remove it. Ideally, spawn an explosion entity.
                        break; // Stop checking other entities since we exploded
                    }
                }
            }
        }
    }
}
