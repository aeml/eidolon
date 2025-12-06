import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { Projectile } from './Projectile.js';

export class Wizard extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.WIZARD);
        this.scaleAnimSpeed = false;
        this.meshType = 'Wizard';

        this.abilityName = "Fireball";
        this.abilityDescription = "Launch a fiery orb that explodes on impact.";
        this.abilityManaCost = 30;
        this.abilityMaxCooldown = 2.0;
    }

    useAbility(targetVector, gameEngine) {
        if (!targetVector) return;
        if (!super.useAbility(targetVector, gameEngine)) return;

        if (this.abilityName === "Teleport") {
            console.log("Wizard used Teleport!");
            
            // Visual Effect: Fade out/in or particles (Simplified for now)
            // Just move instantly
            
            const maxRange = 15.0;
            const dist = this.position.distanceTo(targetVector);
            
            let finalTarget = targetVector.clone();
            if (dist > maxRange) {
                const dir = new THREE.Vector3().subVectors(targetVector, this.position).normalize();
                finalTarget = this.position.clone().add(dir.multiplyScalar(maxRange));
            }
            
            // Clamp to bounds (Client side check, server is authority)
            if (finalTarget.x < -1000) finalTarget.x = -1000;
            if (finalTarget.x > 1000) finalTarget.x = 1000;
            if (finalTarget.z < -2200) finalTarget.z = -2200;
            if (finalTarget.z > 1000) finalTarget.z = 1000;

            this.position.copy(finalTarget);
            if (this.mesh) this.mesh.position.copy(this.position);
            
            return;
        }

        console.log("Wizard used Fireball!");
        this.playAnimation('Attack', false, true);
        
        // Spawn Projectile
        const startPos = this.position.clone();
        startPos.y += 1.5; // Shoot from chest/staff height
        
        // Adjust target height to match start height for horizontal flight
        const adjustedTarget = targetVector.clone();
        adjustedTarget.y = startPos.y;

        const fireball = new Projectile(null, this, 'Fireball', startPos, adjustedTarget);
        
        // Damage Calculation: Base 20 + (Intelligence * 2.0)
        fireball.damage = 20 + (this.stats.intelligence * 2.0);
        
        gameEngine.addEntity(fireball);
    }
}