import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';

export class RootboundWarden extends Actor {
    constructor(id) {
        super(id, 'RootboundWarden'); // Type name
        this.xpValue = 5000;
        
        this.sightRange = 60; 
        this.attackRange = 6.0;
        this.roamRadius = 0; // Bosses usually stay put or patrol small area
        this.roamTimer = 0;
        
        this.radius = 2.0; 
        this.isRunning = false;

        this.meshType = 'RootboundWarden';
        this.name = "Rootbound Warden";
        
        // Stats (Client side visual/prediction only, server is authoritative)
        this.stats = {
            hp: 50000,
            maxHp: 50000,
            level: 45
        };
    }
}
