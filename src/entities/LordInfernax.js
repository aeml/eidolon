import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * LordInfernax - Molten Core Final Boss (Boss 5)
 * Phase 1 (100%-70%): Introduction phase, learn mechanics
 * Phase 2 (70%-40%): Fire wall maze, Meteor targets (stack to split)
 * Phase 3 (40%-0%): Floor is lava (rotating safe spots), must interrupt Cataclysm
 * Soft enrage: +10% damage every 30s
 */
export class LordInfernax extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 6000, STAMINA: 8000000, DEXTERITY: 300, INTELLIGENCE: 3000, WISDOM: 3000 } });
        this.xpValue = 1500000;
        
        this.sightRange = 100;
        this.attackRange = 10.0;
        this.roamRadius = 5;
        this.roamTimer = 0;
        this.roamInterval = 5;
        
        this.isRunning = false;
        this.meshType = 'LordInfernax';
        this.name = 'Lord Infernax';
        this.isBoss = true;
        this.isFinalBoss = true;
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
        const target = new THREE.Vector3(
            this.position.x + Math.cos(angle) * radius,
            this.position.y,
            this.position.z + Math.sin(angle) * radius
        );
        this.move(target);
    }
}
