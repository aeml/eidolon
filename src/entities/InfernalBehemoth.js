import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * InfernalBehemoth - Fire Realm enemy (Level 85-90)
 * Special Ability: Ground Slam - AoE stun (2s)
 */
export class InfernalBehemoth extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 6000, STAMINA: 7000, DEXTERITY: 600, INTELLIGENCE: 1000, WISDOM: 1000 } });
        this.xpValue = 6000;
        
        // AI State
        this.sightRange = 50;
        this.attackRange = 5.0;
        this.roamRadius = 10;
        this.roamTimer = 0;
        this.roamInterval = 5;
        
        this.isRunning = false;

        this.meshType = 'InfernalBehemoth';
        this.name = 'Infernal Behemoth';
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
