import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Wizard extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.WIZARD);
        this.initMesh();
    }

    async initMesh() {
        const mesh = await MeshFactory.createMeshForType('Wizard');
        this.setMesh(mesh);
    }
}