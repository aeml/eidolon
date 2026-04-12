import { Actor } from './Actor.js';

/**
 * ThunderRoc - Air Realm enemy (Level 80-85)
 * Special Ability: Chain Lightning - Bounces to 3 targets
 */
export class ThunderRoc extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5000, STAMINA: 5000, DEXTERITY: 1200, INTELLIGENCE: 1800, WISDOM: 1800 } });
        this.xpValue = 4500;
        
        // AI State
        this.sightRange = 50;
        this.attackRange = 5.0;
        this.roamRadius = 15;
        this.roamTimer = 0;
        this.roamInterval = 3;
        
        this.isRunning = false;

        this.meshType = 'ThunderRoc';
        this.name = 'Thunder Roc';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
