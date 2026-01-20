import { Actor } from './Actor.js';

export class AquaGolem extends Actor {
    constructor(id) {
        super(id, 'Enemy');
        this.meshType = 'AquaGolem';
        this.name = 'Aqua Golem';
        this.scaleAnimSpeed = true;
    }
}
