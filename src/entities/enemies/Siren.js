import { Actor } from '../base/Actor.js';
import { CONSTANTS } from '../../core/Constants.js';

export class Siren extends Actor {
    constructor(id) {
        super(id, 'Enemy');
        this.meshType = 'Siren';
        this.name = 'Siren';
        this.scaleAnimSpeed = true;
    }
}
