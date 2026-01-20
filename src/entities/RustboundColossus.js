import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

export class RustboundColossus extends Actor {
    constructor(id) {
        super(id, 'RustboundColossus');
        this.xpValue = 8000;
        
        this.sightRange = 60; 
        this.attackRange = 5.0;
        this.roamRadius = 0;
        
        this.radius = 3.0; // Big
        this.isRunning = false;

        this.meshType = 'RustboundColossus';
        this.name = "Rustbound Colossus";
        
        this.stats = {
            hp: 80000,
            maxHp: 80000,
            level: 49
        };
    }
}
