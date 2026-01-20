import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

export class HollowSentinel extends Actor {
    constructor(id) {
        super(id, 'HollowSentinel');
        this.xpValue = 10000;
        
        this.sightRange = 60; 
        this.attackRange = 4.0;
        this.roamRadius = 0;
        
        this.radius = 2.5; 
        this.isRunning = false;

        this.meshType = 'HollowSentinel';
        this.name = "Hollow Sentinel";
        
        this.stats = {
            hp: 100000,
            maxHp: 100000,
            level: 50
        };
    }
}
