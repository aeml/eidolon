import { Actor } from './Actor.js';

/**
 * MagmaGolem - Fire Realm enemy (Level 75-80)
 * Special Ability: Lava Pool - Ground DoT zone (3s duration)
 */
export class MagmaGolem extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 5000, STAMINA: 6000, DEXTERITY: 400, INTELLIGENCE: 500, WISDOM: 500 } });
        this.xpValue = 3500;
        
        // AI State
        this.sightRange = 45;
        this.attackRange = 3.5;
        this.roamRadius = 10;
        this.roamTimer = 0;
        this.roamInterval = 4;
        
        this.isRunning = false;

        this.meshType = 'MagmaGolem';
        this.name = 'Magma Golem';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
