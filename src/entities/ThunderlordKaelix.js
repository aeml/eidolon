import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * ThunderlordKaelix - Tempest Spire Boss 4
 * Abilities: Lightning Rod (player becomes conduit), Thunder Clap (AoE stun)
 * At 30% HP: Storm Giant Form (grows larger, increased damage)
 * HP: 4.8M (Normal) / 9.6M (Heroic) / 19.2M (Mythic)
 */
export class ThunderlordKaelix extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5000, STAMINA: 4800000, DEXTERITY: 300, INTELLIGENCE: 3000, WISDOM: 2500 } });
        this.xpValue = 700000;
        
        this.sightRange = 80;
        this.attackRange = 10.0;
        this.roamRadius = 5;
        this.roamTimer = 0;
        this.roamInterval = 5;
        
        this.isRunning = false;
        this.meshType = 'ThunderlordKaelix';
        this.name = 'Thunderlord Kaelix';
        this.isBoss = true;
        this.isEnraged = false;
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        if (this.state === 'DEAD') return;

        // Check for Storm Giant Form at 30% HP
        const healthPercent = this.stats.currentHealth / this.stats.health;
        if (healthPercent <= 0.3 && !this.isEnraged) {
            this.isEnraged = true;
            // Visual/stat changes for enrage would be handled here
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
