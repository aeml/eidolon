import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Rogue extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.ROGUE);
        this.initMesh();
    }

    async initMesh() {
        const mesh = await MeshFactory.createMeshForType('Rogue');
        this.setMesh(mesh);
    }
}