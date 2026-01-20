import { Actor } from './Actor.js';

export class QuestNPC extends Actor {
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
        this.type = 'QuestNPC';
        this.meshType = 'QuestNPC';
        this.name = "Quest Giver";
        this.radius = 1.0;
        this.state = 'IDLE';
    }
}
