import { Entity } from './Entity.js';

export class Forge extends Entity {
    constructor(id) {
        super(id);
        this.type = 'Forge';
        this.meshType = 'Forge';
        this.name = "Forge";
        this.radius = 2.0;
    }
}
