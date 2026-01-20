import { Actor } from './Actor.js';

export class FrostGuardian extends Actor {
    constructor(id) {
        super(id, 'Enemy');
        this.meshType = 'FrostGuardian';
        this.name = 'Frost Guardian';
        this.scaleAnimSpeed = true;
    }
}
