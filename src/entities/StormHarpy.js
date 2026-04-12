import { Actor } from './Actor.js';

/**
 * StormHarpy - Air Realm enemy (Level 70-75)
 * Special Ability: Gust - Knockback (10 units)
 */
export class StormHarpy extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 3800, STAMINA: 4200, DEXTERITY: 1500, INTELLIGENCE: 1000, WISDOM: 1000 } });
        this.xpValue = 2500;
        
        // AI State
        this.sightRange = 55;
        this.attackRange = 3.5;
        this.roamRadius = 15;
        this.roamTimer = 0;
        this.roamInterval = 2.5;
        
        this.isRunning = false;

        this.meshType = 'StormHarpy';
        this.name = 'Storm Harpy';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
