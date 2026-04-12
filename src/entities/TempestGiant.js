import { Actor } from './Actor.js';

/**
 * TempestGiant - Air Realm enemy (Level 85-90)
 * Special Ability: Tornado - Pulls players in (8 unit radius)
 */
export class TempestGiant extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5800, STAMINA: 6500, DEXTERITY: 700, INTELLIGENCE: 1200, WISDOM: 1200 } });
        this.xpValue = 6000;
        
        // AI State
        this.sightRange = 50;
        this.attackRange = 5.5;
        this.roamRadius = 10;
        this.roamTimer = 0;
        this.roamInterval = 4;
        
        this.isRunning = false;

        this.meshType = 'TempestGiant';
        this.name = 'Tempest Giant';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
