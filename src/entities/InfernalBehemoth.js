import { Actor } from './Actor.js';

/**
 * InfernalBehemoth - Fire Realm enemy (Level 85-90)
 * Special Ability: Ground Slam - AoE stun (2s)
 */
export class InfernalBehemoth extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 6000, STAMINA: 7000, DEXTERITY: 600, INTELLIGENCE: 1000, WISDOM: 1000 } });
        this.xpValue = 6000;
        
        // AI State
        this.sightRange = 50;
        this.attackRange = 5.0;
        this.roamRadius = 10;
        this.roamTimer = 0;
        this.roamInterval = 5;
        
        this.isRunning = false;

        this.meshType = 'InfernalBehemoth';
        this.name = 'Infernal Behemoth';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
