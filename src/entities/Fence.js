import { Entity } from './Entity.js';
import * as THREE from 'three';

export class Fence extends Entity {
    constructor(id, x, z, rotation, { environmentOwned = false } = {}) {
        super(id);
        this.position.set(x, 0, z);
        this.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
        this.environmentOwned = environmentOwned;
        this.meshType = environmentOwned ? null : 'Fence';
        this.ensureMesh();
    }
}
