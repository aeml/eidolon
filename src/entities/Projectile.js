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
    constructor(owner, type, startPos, targetPos) {
        super();
        this.owner = owner;
        this.type = type; // 'Fireball', 'Dagger'
        this.position.copy(startPos);
        
        // Calculate velocity
        const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
        this.speed = type === 'Fireball' ? 20 : 35; // Increased speed
        this.velocity = direction.multiplyScalar(this.speed);
        
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

    update(dt, collisionManager, player) { 
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
    }
}
