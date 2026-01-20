import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * Zephyrion, the Eternal Gale - Tempest Spire Final Boss (Boss 5)
 * Phase 1 (100%-60%): Wind walls rotate around arena, Eye of Storm safe zones
 * Phase 2 (60%-30%): Platform phase (jumping puzzle), Lightning strikes
 * Phase 3 (30%-0%): Full tornado phase, DPS in narrow safe windows
 * Enrage: Tornado expands until arena is consumed
 * HP: 7.5M (Normal) / 15M (Heroic) / 30M (Mythic)
 */
export class Zephyrion extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5500, STAMINA: 7500000, DEXTERITY: 400, INTELLIGENCE: 4000, WISDOM: 3500 } });
        this.xpValue = 1000000;
        
        this.sightRange = 100;
        this.attackRange = 12.0;
        this.roamRadius = 5;
        this.roamTimer = 0;
        this.roamInterval = 5;
        
        this.isRunning = false;
        this.meshType = 'Zephyrion';
        this.name = 'Zephyrion, the Eternal Gale';
        this.isBoss = true;
        this.phase = 1;
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        if (this.state === 'DEAD') return;

        // Phase transitions based on health
        const healthPercent = this.stats.currentHealth / this.stats.health;
        if (healthPercent <= 0.3 && this.phase < 3) {
            this.phase = 3;
        } else if (healthPercent <= 0.6 && this.phase < 2) {
            this.phase = 2;
        }

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
