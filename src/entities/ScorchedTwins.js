import * as THREE from 'three';
import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

/**
 * ScorchedTwins - Molten Core Boss 2 (Duo Fight)
 * Core Mechanic: Both must die within 10 seconds or the dead one revives at 50% HP
 * Ember (Caster): Fireball Barrage, Flame Shield
 * Cinder (Melee): Cleave, Searing Brand
 */
export class ScorchedTwins extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 3500, STAMINA: 4000000, DEXTERITY: 250, INTELLIGENCE: 2500, WISDOM: 2500 } });
        this.xpValue = 600000;
        
        this.sightRange = 80;
        this.attackRange = 6.0;
        this.roamRadius = 5;
        this.roamTimer = 0;
        this.roamInterval = 5;
        
        this.isRunning = false;
        this.meshType = 'ScorchedTwins';
        this.name = 'Scorched Twins';
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
