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
        const fontSize = 24;
        context.font = `bold ${fontSize}px Arial`;
        const textWidth = context.measureText(this.name).width;
        
        canvas.width = textWidth + 20;
        canvas.height = fontSize + 10;
        
        // Background (optional)
        // context.fillStyle = "rgba(0, 0, 0, 0.5)";
        // context.fillRect(0, 0, canvas.width, canvas.height);

        context.font = `bold ${fontSize}px Arial`;
        context.fillStyle = "white";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.strokeStyle = 'black';
        context.lineWidth = 3;
        context.strokeText(this.name, canvas.width / 2, canvas.height / 2);
        context.fillText(this.name, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        
        sprite.name = "NameTag";
        sprite.position.set(0, 2.5, 0); // Adjust height based on entity size
        sprite.scale.set(2, 1, 1); // Adjust scale
        
        this.mesh.add(sprite);
    }
}