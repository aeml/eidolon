import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

export class InfernoTitan extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.INFERNO_TITAN);
        this.xpValue = 300; // Higher XP reward
        
        // AI State
        this.sightRange = 60; 
        this.attackRange = 4.0;
        this.roamRadius = 20;
        this.roamTimer = 0;
        this.roamInterval = 4; 
        
        this.radius = 1.0; // Reduced collision radius
        this.isRunning = false; // Enemies always walk

        this.meshType = 'InfernoTitan';
        this.name = 'Inferno Titan';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);

        if (this.state === 'DEAD') return;

        // AI Logic
        if (player && player.state !== 'DEAD') {
            const dist = this.position.distanceTo(player.position);

            if (dist < this.sightRange) {
                // Player seen!
                if (dist < this.attackRange) {
                    // Attack!
                    this.attack(player);
                } else {
                    // Chase!
                    this.move(player.position);
                }
                return; 
            }
        }

        // Roam Logic
        if (this.state === 'IDLE') {
            this.roamTimer -= dt;
            if (this.roamTimer <= 0) {
                this.roam();
                this.roamTimer = this.roamInterval + Math.random() * 2; 
            }
        }
    }

    roam() {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.roamRadius;
        const dx = Math.cos(angle) * radius;
        const dz = Math.sin(angle) * radius;

        const target = new THREE.Vector3(
            this.position.x + dx,
            this.position.y,
            this.position.z + dz
        );

        this.move(target);
    }
}
