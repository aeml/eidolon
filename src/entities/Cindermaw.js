import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * Cindermaw - Molten Core Boss 1 (Fire Elemental)
 * Phase 1 (100%-50%): Flame Breath, Scatter Flame, Fire Sprite Spawn
 * Phase 2 (50%-0%): Enrage, Molten Rain, 360 Breath
 */
export class Cindermaw extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 4000, STAMINA: 3000000, DEXTERITY: 200, INTELLIGENCE: 2000, WISDOM: 2000 } });
        this.xpValue = 500000;
        
        this.sightRange = 80;
        this.attackRange = 8.0;
        this.roamRadius = 5;
        this.roamTimer = 0;
        this.roamInterval = 5;
        
        this.isRunning = false;
        this.meshType = 'Cindermaw';
        this.name = 'Cindermaw';
        this.isBoss = true;
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
