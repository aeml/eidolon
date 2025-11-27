import * as THREE from 'three';
import { MeshFactory } from '../utils/MeshFactory.js';

export class Entity {
    constructor(id) {
        this.id = id || crypto.randomUUID();
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
        this.isActive = true;
        this.mesh = null;
        this.meshType = null;
        this.isMeshLoading = false;
    }

    async ensureMesh() {
        if (this.mesh || this.isMeshLoading || !this.meshType) return;
        
        this.isMeshLoading = true;
        try {
            // console.log(`Entity ${this.id} loading mesh type ${this.meshType}...`);
            const mesh = await MeshFactory.createMeshForType(this.meshType);
            if (mesh) {
                this.setMesh(mesh);
            }
        } catch (e) {
            console.error(`Entity ${this.id} failed to load mesh ${this.meshType}`, e);
        } finally {
            this.isMeshLoading = false;
        }
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