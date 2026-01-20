import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * Windshear - Tempest Spire Boss 1
 * Abilities: Gale Force (massive knockback), Wind Tunnel (line attack), Vacuum (pulls to center)
 * HP: 2.8M (Normal) / 5.6M (Heroic) / 11.2M (Mythic)
 */
export class Windshear extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 3500, STAMINA: 2800000, DEXTERITY: 300, INTELLIGENCE: 2200, WISDOM: 2000 } });
        this.xpValue = 450000;
        
        this.sightRange = 80;
        this.attackRange = 8.0;
        this.roamRadius = 5;
        this.roamTimer = 0;
        this.roamInterval = 5;
        
        this.isRunning = false;
        this.meshType = 'Windshear';
        this.name = 'Windshear';
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
