import { Actor } from '../base/Actor.js';

export class MountainTroll extends Actor {
    constructor(id) {
        super(id, 'Enemy');
        this.meshType = 'MountainTroll';
        this.name = 'Mountain Troll';
        this.scaleAnimSpeed = true;
    }
}
