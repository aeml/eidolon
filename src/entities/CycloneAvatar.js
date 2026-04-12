import { Actor } from './Actor.js';

/**
 * CycloneAvatar - Air Realm enemy (Level 90-95)
 * Special Ability: Eye of Storm - Safe zone mechanic
 */
export class CycloneAvatar extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5200, STAMINA: 5800, DEXTERITY: 1400, INTELLIGENCE: 2200, WISDOM: 2200 } });
        this.xpValue = 8000;
        
        // AI State
        this.sightRange = 60;
        this.attackRange = 5.5;
        this.roamRadius = 15;
        this.roamTimer = 0;
        this.roamInterval = 3;
        
        this.isRunning = false;

        this.meshType = 'CycloneAvatar';
        this.name = 'Cyclone Avatar';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
