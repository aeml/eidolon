import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Cleric extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.CLERIC);
        this.initMesh();
    }

    async initMesh() {
        const mesh = await MeshFactory.createMeshForType('Cleric');
        this.setMesh(mesh);
    }
}