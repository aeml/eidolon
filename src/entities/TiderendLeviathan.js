import { Actor } from './Actor.js';

/**
 * Tiderend Leviathan - Abyssal Well Boss 1
 */
export class TiderendLeviathan extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 3600, STAMINA: 2600000, DEXTERITY: 240, INTELLIGENCE: 2200, WISDOM: 2200 } });
        this.xpValue = 450000;

        this.sightRange = 80;
        this.attackRange = 8.0;
        this.roamRadius = 5;
        this.roamTimer = 0;
        this.roamInterval = 5;

        this.isRunning = false;
        this.meshType = 'TiderendLeviathan';
        this.name = 'Tiderend Leviathan';
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
