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
        
        if (this.modifyMesh) {
            this.modifyMesh(mesh);
        }

        if (this.name) {
            this.updateNameTag();
        }

        if (this.onMeshReady) {
            this.onMeshReady(mesh);
            this.onMeshReady = null; // Clear callback
        }
    }

    setName(name) {
        this.name = name;
        if (this.mesh) {
            this.updateNameTag();
        }
    }

    updateNameTag() {
        if (!this.mesh || !this.name) return;

        // Remove existing name tag
        const existingTag = this.mesh.getObjectByName("NameTag");
        if (existingTag) {
            this.mesh.remove(existingTag);
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = 32; // Higher resolution for texture
        context.font = `bold ${fontSize}px Arial`;
        const textWidth = context.measureText(this.name).width;
        
        canvas.width = textWidth + 20;
        canvas.height = fontSize + 20;
        
        context.font = `bold ${fontSize}px Arial`;
        context.fillStyle = "white";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.strokeStyle = 'black';
        context.lineWidth = 4;
        context.strokeText(this.name, canvas.width / 2, canvas.height / 2);
        context.fillText(this.name, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        
        sprite.name = "NameTag";
        sprite.position.set(0, 2.5, 0); 
        
        // Scale based on aspect ratio to prevent distortion
        // User wanted "smaller", so we reduce the world-space height
        const scaleHeight = 0.4; 
        const scaleWidth = (canvas.width / canvas.height) * scaleHeight;
        
        sprite.scale.set(scaleWidth, scaleHeight, 1); 
        
        this.mesh.add(sprite);
    }
}