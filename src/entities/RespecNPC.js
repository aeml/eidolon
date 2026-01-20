import { Actor } from './Actor.js';

export class RespecNPC extends Actor {
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
        this.type = 'RespecNPC';
        this.meshType = 'RespecNPC';
        this.name = "Talent Master";
        this.radius = 1.0;
        this.state = 'IDLE';
    }
}
