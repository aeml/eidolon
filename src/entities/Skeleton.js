import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

export class Skeleton extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.SKELETON || { STATS: { STRENGTH: 3, STAMINA: 3, DEXTERITY: 3, INTELLIGENCE: 1, WISDOM: 1 } });
        this.xpValue = 50; // XP reward for killing
        
        // AI State
        this.sightRange = 45; // Increased from 15 to 45 (3x)
        this.attackRange = 3.0;
        this.roamRadius = 10;
        this.roamTimer = 0;
        this.roamInterval = 3; // Seconds between roams
        
        this.isRunning = false; // Enemies always walk

        this.meshType = 'Skeleton';
        this.name = 'Skeleton';
    }

    update(dt, collisionManager, player, chunkManager) {
        super.update(dt, collisionManager, player, chunkManager);
        this.updateBasicEnemyAI(dt, player);
    }

    roam() {
        this.roamRandomly();
    }
}
