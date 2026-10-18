import { Entity } from './Entity.js';
import * as THREE from 'three';

export class Fence extends Entity {
    constructor(id, x, z, rotation, { environmentOwned = false } = {}) {
        super(id);
        this.position.set(x, 0, z);
        this.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
        this.environmentOwned = environmentOwned;
        this.fenceYaw = rotation;
        this.meshType = environmentOwned ? null : 'Fence';
        this.ensureMesh();
    }

    adoptEnvironmentPerimeter() {
        if (this.environmentOwned) return;
        // Keep the network actor/spatial identity while retiring a legacy mesh
        // or an in-flight loader that arrived before the environment was ready.
        super.dispose();
        this.environmentOwned = true;
        this.meshType = null;
    }
}
