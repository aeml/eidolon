import { Actor } from './Actor.js';

export class DungeonNPC extends Actor {
    constructor(id) {
        super(id, {
            STATS: {
                STRENGTH: 10,
                INTELLIGENCE: 10,
                DEXTERITY: 10,
                WISDOM: 10,
                STAMINA: 100
            }
        });
        this.type = 'DungeonNPC';
        this.meshType = 'DungeonNPC';
        this.name = 'Dungeon Guide';
        this.radius = 1.0;
        this.state = 'IDLE';
    }
}
