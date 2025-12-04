import { Entity } from './Entity.js';

export class Stash extends Entity {
    constructor(id) {
        super(id);
        this.type = 'Stash';
        this.meshType = 'Stash';
        this.name = "Stash";
        this.radius = 1.0;
    }
}
