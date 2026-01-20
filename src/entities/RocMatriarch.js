import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * RocMatriarch - Tempest Spire Boss 3 (Flying Boss)
 * Ground Phase: Talon Swipe, Egg Protection (destroy eggs or adds spawn)
 * Air Phase: Dive Bomb (dodge markers), Feather Barrage (spread damage)
 * HP: 3.8M (Normal) / 7.6M (Heroic) / 15.2M (Mythic)
 */
export class RocMatriarch extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 4200, STAMINA: 3800000, DEXTERITY: 500, INTELLIGENCE: 2000, WISDOM: 2000 } });
        this.xpValue = 600000;
        
        this.sightRange = 100;
        this.attackRange = 12.0;
        this.roamRadius = 8;
        this.roamTimer = 0;
        this.roamInterval = 4;
        
        this.isRunning = false;
        this.meshType = 'RocMatriarch';
        this.name = 'Roc Matriarch';
        this.isBoss = true;
        this.isFlying = true;
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
