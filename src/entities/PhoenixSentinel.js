import { Actor } from './Actor.js';

/**
 * PhoenixSentinel - Fire Realm enemy (Level 90-95)
 * Special Ability: Rebirth - Heals 50% HP once per fight
 */
export class PhoenixSentinel extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5500, STAMINA: 5500, DEXTERITY: 1200, INTELLIGENCE: 2500, WISDOM: 2500 } });
        this.xpValue = 8000;
        
        // AI State
        this.sightRange = 60;
        this.attackRange = 5.0;
        this.roamRadius = 15;
        this.roamTimer = 0;
        this.roamInterval = 3;
        
        this.isRunning = false;

        this.meshType = 'PhoenixSentinel';
        this.name = 'Phoenix Sentinel';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
