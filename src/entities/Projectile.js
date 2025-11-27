import * as THREE from 'three';
import { Entity } from './Entity.js';

export class Projectile extends Entity {
    constructor(owner, type, startPos, targetPos) {
        super();
        this.owner = owner;
        this.type = type; // 'Fireball', 'Dagger'
        this.position.copy(startPos);
        
        // Calculate velocity
        const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
        this.speed = type === 'Fireball' ? 15 : 25;
        this.velocity = direction.multiplyScalar(this.speed);
        
        this.damage = 0;
        this.radius = 0.5;
        this.lifeTime = 3.0; // Seconds
        
        this.initMesh();
    }

    initMesh() {
        let geometry, material;
        
        if (this.type === 'Fireball') {
            geometry = new THREE.SphereGeometry(0.5, 8, 8);
            material = new THREE.MeshStandardMaterial({ 
                color: 0xff4500, 
                emissive: 0xff0000,
                emissiveIntensity: 2
            });
            this.damage = 20 + (this.owner.stats.intelligence * 2);
        } else if (this.type === 'Dagger') {
            // Increased size for visibility
            geometry = new THREE.ConeGeometry(0.2, 1.0, 8);
            geometry.rotateX(Math.PI / 2); // Point forward
            material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
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

    update(dt, collisionManager, player) { // player arg not really needed here but keeping signature
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

        // Collision Check (Simple sphere check against enemies)
        // We need access to enemies list... passed via collisionManager or we need a new system.
        // For now, let's assume GameEngine handles projectile collision against entities?
        // Or we can pass the entity list to update.
        // Let's stick to simple movement here, and GameEngine can check overlaps.
    }
}
