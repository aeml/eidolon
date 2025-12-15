import { Actor } from './Actor.js';

export class MountainTroll extends Actor {
    constructor(id) {
        super(id, 'Enemy');
        this.meshType = 'MountainTroll';
        this.name = 'Mountain Troll';
        this.scaleAnimSpeed = true;
    }
}
