import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * ForgemasterPyrax - Molten Core Boss 3
 * Phase 1 (100%-70%): Tank and spank with add spawns
 * Phase 2 (70%-40%): Activates forge - destroy 4 anvils in 30s or boss immune
 * Phase 3 (40%-0%): Creates molten weapons targeting random players
 */
export class ForgemasterPyrax extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 4500, STAMINA: 4000000, DEXTERITY: 220, INTELLIGENCE: 2200, WISDOM: 2200 } });
        this.xpValue = 700000;
        
        this.sightRange = 80;
        this.attackRange = 7.0;
        this.roamRadius = 5;
        this.roamTimer = 0;
        this.roamInterval = 5;
        
        this.isRunning = false;
        this.meshType = 'ForgemasterPyrax';
        this.name = 'Forgemaster Pyrax';
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
