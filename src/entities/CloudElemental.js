import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * CloudElemental - Air Realm enemy (Level 75-80)
 * Special Ability: Mist Form - 50% miss chance for 3s
 */
export class CloudElemental extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 4200, STAMINA: 5500, DEXTERITY: 800, INTELLIGENCE: 1500, WISDOM: 1500 } });
        this.xpValue = 3500;
        
        // AI State
        this.sightRange = 45;
        this.attackRange = 4.0;
        this.roamRadius = 12;
        this.roamTimer = 0;
        this.roamInterval = 3.5;
        
        this.isRunning = false;

        this.meshType = 'CloudElemental';
        this.name = 'Cloud Elemental';
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
