import * as THREE from 'three';

export class Entity {
    constructor(id) {
        this.id = id || crypto.randomUUID();
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
        this.isActive = true;
        this.mesh = null;
    }

    update(dt) {
        // Base update logic
    }

    render(interpolation) {
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            this.mesh.quaternion.copy(this.rotation);
        }
    }
    
    setMesh(mesh) {
        this.mesh = mesh;
        this.mesh.userData.entityId = this.id;
        
        if (this.onMeshReady) {
            this.onMeshReady(mesh);
            this.onMeshReady = null; // Clear callback
        }
    }
}