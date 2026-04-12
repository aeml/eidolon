import { Actor } from './Actor.js';

/**
 * SandstormDjinn - Fire Realm enemy (Level 70-75)
 * Special Ability: Sandstorm - AoE slow (30% for 5s)
 */
export class SandstormDjinn extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 4000, STAMINA: 4500, DEXTERITY: 1000, INTELLIGENCE: 1200, WISDOM: 1200 } });
        this.xpValue = 2500;
        
        // AI State
        this.sightRange = 50;
        this.attackRange = 4.0;
        this.roamRadius = 12;
        this.roamTimer = 0;
        this.roamInterval = 3;
        
        this.isRunning = false;

        this.meshType = 'SandstormDjinn';
        this.name = 'Sandstorm Djinn';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
