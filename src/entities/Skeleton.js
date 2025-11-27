import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Skeleton extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.SKELETON);
        this.xpValue = 50; // XP reward for killing
        this.initMesh();
    }

    async initMesh() {
        try {
            const mesh = await MeshFactory.createMeshForType('Skeleton');
            if (mesh) {
                this.setMesh(mesh);
            }
        } catch (e) {
            console.error("Skeleton: initMesh failed", e);
        }
    }
}
