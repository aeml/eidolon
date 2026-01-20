import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * PhoenixSentinel - Fire Realm enemy (Level 90-95)
 * Special Ability: Rebirth - Heals 50% HP once per fight
 */
export class PhoenixSentinel extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5500, STAMINA: 5500, DEXTERITY: 1200, INTELLIGENCE: 2500, WISDOM: 2500 } });
        this.xpValue = 8000;
        
        // AI State
        this.sightRange = 60;
        this.attackRange = 5.0;
        this.roamRadius = 15;
        this.roamTimer = 0;
        this.roamInterval = 3;
        
        this.isRunning = false;

        this.meshType = 'PhoenixSentinel';
        this.name = 'Phoenix Sentinel';
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
