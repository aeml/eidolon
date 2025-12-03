import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Fighter extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.FIGHTER);
        this.scaleAnimSpeed = false;
        this.meshType = 'Fighter';
        
        this.abilityName = "Charge";
        this.abilityDescription = "Dash towards an enemy and deal damage.";
        this.abilityManaCost = 20;
        this.abilityMaxCooldown = 5.0;
        
        this.isCharging = false;
        this.chargeTarget = null;
    }

    useAbility(targetVector, gameEngine) {
        if (!super.useAbility(targetVector, gameEngine)) return;

        this.gameEngine = gameEngine;
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

    update(dt, collisionManager, player, activeEntities, floatingTextManager) {
        if (this.isCharging) {
            // Remote entities are moved by server updates, so we skip local physics simulation
            if (this.isRemote) {
                if (this.mixer) this.mixer.update(dt);
                return;
            }

            // Safety check: If chargeTarget is missing, abort charge
            if (!this.chargeTarget) {
                this.isCharging = false;
                super.update(dt, collisionManager);
                return;
            }

            const speed = 25; // Fast charge speed
            const direction = new THREE.Vector3().subVectors(this.chargeTarget, this.position);
            const dist = direction.length();
            
            if (dist < 1.0) {
                // Impact!
                this.isCharging = false;
                this.state = 'IDLE';
                this.playAnimation('Idle');

                // Charge Damage Logic
                if (activeEntities) {
                    const chargeRadius = 2.5;
                    const damage = 25 + (this.stats.strength * 1.5);
                    
                    for (const entity of activeEntities) {
                        if (entity === this || entity.state === 'DEAD' || !entity.isActive) continue;
                        if (entity.constructor.name === 'LootDrop') continue;
                        if (entity.constructor.name === 'DwarfSalesman') continue;
                        
                        const d = this.position.distanceTo(entity.position);
                        if (d < chargeRadius) {
                             // if (!this.isMultiplayer && !this.isRemote) {
                             //    entity.takeDamage(damage);
                             // }
                             
                             // if (!this.isMultiplayer) {
                             //     if (floatingTextManager) {
                             //         floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffffff');
                             //     } else if (this.gameEngine && this.gameEngine.floatingTextManager) {
                             //         this.gameEngine.floatingTextManager.spawn(Math.floor(damage), entity.position, '#ffffff');
                             //     }
                             // }
                        }
                    }
                }

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