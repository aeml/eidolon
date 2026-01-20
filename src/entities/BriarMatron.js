import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

export class BriarMatron extends Actor {
    constructor(id) {
        super(id, 'BriarMatron');
        this.xpValue = 6000;
        
        this.sightRange = 60; 
        this.attackRange = 15.0; // Ranged?
        this.roamRadius = 0;
        
        this.radius = 1.5; 
        this.isRunning = false;

        this.meshType = 'BriarMatron';
        this.name = "Briar Matron";
        
        this.stats = {
            hp: 45000,
            maxHp: 45000,
            level: 47
        };
    }
}
