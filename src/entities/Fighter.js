import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Fighter extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.FIGHTER);
        this.initMesh();
    }

    async initMesh() {
        console.log("Fighter: initMesh started");
        try {
            const mesh = await MeshFactory.createMeshForType('Fighter');
            console.log("Fighter: mesh created", mesh);
            this.setMesh(mesh);
            console.log("Fighter: setMesh called");
        } catch (e) {
            console.error("Fighter: initMesh failed", e);
        }
    }
}