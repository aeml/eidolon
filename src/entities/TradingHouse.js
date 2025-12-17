import { Entity } from './Entity.js';

export class TradingHouse extends Entity {
    constructor(id) {
        super(id);
        this.type = 'TradingHouse';
        this.meshType = 'TradingHouse';
        this.name = "Trading House";
        this.radius = 15.0; // Larger radius for the building
    }
}
