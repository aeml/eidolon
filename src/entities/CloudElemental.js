import { Actor } from './Actor.js';

/**
 * CloudElemental - Air Realm enemy (Level 75-80)
 * Special Ability: Mist Form - 50% miss chance for 3s
 */
export class CloudElemental extends Actor {
    constructor(id) {
        super(id, { STATS: { STRENGTH: 4200, STAMINA: 5500, DEXTERITY: 800, INTELLIGENCE: 1500, WISDOM: 1500 } });
        this.xpValue = 3500;
        
        // AI State
        this.sightRange = 45;
        this.attackRange = 4.0;
        this.roamRadius = 12;
        this.roamTimer = 0;
        this.roamInterval = 3.5;
        
        this.isRunning = false;

        this.meshType = 'CloudElemental';
        this.name = 'Cloud Elemental';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
