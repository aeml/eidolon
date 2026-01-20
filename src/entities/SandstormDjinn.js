import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * SandstormDjinn - Fire Realm enemy (Level 70-75)
 * Special Ability: Sandstorm - AoE slow (30% for 5s)
 */
export class SandstormDjinn extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 4000, STAMINA: 4500, DEXTERITY: 1000, INTELLIGENCE: 1200, WISDOM: 1200 } });
        this.xpValue = 2500;
        
        // AI State
        this.sightRange = 50;
        this.attackRange = 4.0;
        this.roamRadius = 12;
        this.roamTimer = 0;
        this.roamInterval = 3;
        
        this.isRunning = false;

        this.meshType = 'SandstormDjinn';
        this.name = 'Sandstorm Djinn';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);

        if (this.state === 'DEAD') return;

        if (player && player.state !== 'DEAD') {
            const dist = this.position.distanceTo(player.position);

            if (dist < this.sightRange) {
                if (dist < this.attackRange) {
                    this.attack(player);
                } else {
                    this.move(player.position);
                }
                return;
            }
        }

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
