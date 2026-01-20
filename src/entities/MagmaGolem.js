import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * MagmaGolem - Fire Realm enemy (Level 75-80)
 * Special Ability: Lava Pool - Ground DoT zone (3s duration)
 */
export class MagmaGolem extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5000, STAMINA: 6000, DEXTERITY: 400, INTELLIGENCE: 500, WISDOM: 500 } });
        this.xpValue = 3500;
        
        // AI State
        this.sightRange = 45;
        this.attackRange = 3.5;
        this.roamRadius = 10;
        this.roamTimer = 0;
        this.roamInterval = 4;
        
        this.isRunning = false;

        this.meshType = 'MagmaGolem';
        this.name = 'Magma Golem';
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
