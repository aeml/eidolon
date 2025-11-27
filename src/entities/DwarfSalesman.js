import { Actor } from './Actor.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class DwarfSalesman extends Actor {
    constructor(id) {
        super(id, { 
            STATS: { 
                HP: 9999, 
                MAX_HP: 9999, 
                SPEED: 0 
            } 
        });
        this.type = 'DwarfSalesman';
        this.isInvulnerable = true;
        this.name = "Dwarf Merchant";
        this.meshType = 'DwarfSalesman';
    }

    update(dt) {
        // Override Actor update to prevent movement/physics
        if (this.mixer) {
            this.mixer.update(dt);
        }
        // No movement logic
    }

    takeDamage(amount) {
        // Invulnerable
        return;
    }
}
