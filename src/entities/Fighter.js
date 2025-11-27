import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Fighter extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.FIGHTER);
        this.scaleAnimSpeed = false;
        this.initMesh();
        
        this.abilityName = "Charge";
        this.abilityDescription = "Dash towards an enemy and deal damage.";
        this.abilityManaCost = 20;
        this.abilityMaxCooldown = 5.0;
        
        this.isCharging = false;
        this.chargeTarget = null;
    }

    async initMesh() {
        console.log("Fighter: initMesh started");
        try {
            const mesh = await MeshFactory.createMeshForType('Fighter');
            console.log("Fighter: mesh created", mesh);
            this.setMesh(mesh);
            console.log("Fighter: setMesh called");
        } catch (e) {
            console.error("Fighter: initMesh failed", e);
        }
    }

    useAbility(targetVector, gameEngine) {
        if (!super.useAbility(targetVector, gameEngine)) return;

        console.log("Fighter used Charge!");
        this.isCharging = true;
        this.state = 'ATTACKING'; // Lock movement
        this.playAnimation('Run'); // Fast run
        
        // Calculate charge direction
        this.chargeTarget = targetVector.clone();
        
        // Face target
        const lookTarget = new THREE.Vector3(targetVector.x, this.position.y, targetVector.z);
        if (this.mesh) {
            this.mesh.lookAt(lookTarget);
            this.rotation.copy(this.mesh.quaternion);
        }
    }

    cancelAbilities() {
        this.isCharging = false;
    }

    update(dt, collisionManager) {
        if (this.isCharging) {
            const speed = 25; // Fast charge speed
            const direction = new THREE.Vector3().subVectors(this.chargeTarget, this.position);
            const dist = direction.length();
            
            if (dist < 1.0) {
                // Impact!
                this.isCharging = false;
                this.state = 'IDLE';
                this.playAnimation('Idle');
                
                // Deal AoE damage at location? Or just stop.
                // For now, we rely on GameEngine to check if we hit an enemy during charge?
                // Or we just stop at the point.
                // Let's do a small AoE hit at the end
                // We need access to enemies... handled in GameEngine or we pass it down.
                // For now, just stop.
            } else {
                direction.normalize();
                let moveDist = speed * dt;
                if (moveDist > dist) moveDist = dist; // Prevent overshoot
                
                this.position.add(direction.multiplyScalar(moveDist));
                
                // Update mesh
                if (this.mesh) this.mesh.position.copy(this.position);
            }
            
            // Skip normal update movement logic
            if (this.mixer) this.mixer.update(dt);
            return;
        }

        super.update(dt, collisionManager);
    }
}