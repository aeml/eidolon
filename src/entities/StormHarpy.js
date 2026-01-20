import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * StormHarpy - Air Realm enemy (Level 70-75)
 * Special Ability: Gust - Knockback (10 units)
 */
export class StormHarpy extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 3800, STAMINA: 4200, DEXTERITY: 1500, INTELLIGENCE: 1000, WISDOM: 1000 } });
        this.xpValue = 2500;
        
        // AI State
        this.sightRange = 55;
        this.attackRange = 3.5;
        this.roamRadius = 15;
        this.roamTimer = 0;
        this.roamInterval = 2.5;
        
        this.isRunning = false;

        this.meshType = 'StormHarpy';
        this.name = 'Storm Harpy';
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
