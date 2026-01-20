import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * ThunderRoc - Air Realm enemy (Level 80-85)
 * Special Ability: Chain Lightning - Bounces to 3 targets
 */
export class ThunderRoc extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5000, STAMINA: 5000, DEXTERITY: 1200, INTELLIGENCE: 1800, WISDOM: 1800 } });
        this.xpValue = 4500;
        
        // AI State
        this.sightRange = 50;
        this.attackRange = 5.0;
        this.roamRadius = 15;
        this.roamTimer = 0;
        this.roamInterval = 3;
        
        this.isRunning = false;

        this.meshType = 'ThunderRoc';
        this.name = 'Thunder Roc';
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
