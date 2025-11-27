import * as THREE from 'three';
import { Entity } from './Entity.js';

export class LootDrop extends Entity {
    constructor(item, x, z) {
        super();
        this.item = item;
        this.position.set(x, 0.5, z); // Float slightly above ground
        this.radius = 0.5;
        
        // Create visual representation
        // Color based on rarity
        const color = item.rarity.color;
        
        // Use Sphere for "Orb" look
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.2,
            metalness: 0.8
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.userData.entityId = this.id;
        this.mesh.userData.type = 'LOOT';
        
        // Add a light
        const light = new THREE.PointLight(color, 0.5, 3);
        light.position.set(0, 0, 0);
        this.mesh.add(light);

        // Add Text Label
        const label = this.createTextSprite(item.name, color);
        label.position.set(0, 0.6, 0); // Above the orb
        this.mesh.add(label);
        
        // Add Hitbox for easier clicking
        const hitGeometry = new THREE.SphereGeometry(0.7, 8, 8); // Larger radius (0.7 vs 0.2)
        const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
        this.mesh.add(hitMesh);
        
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    createTextSprite(message, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // High resolution for crisp text
        const fontSize = 32;
        context.font = `Bold ${fontSize}px Arial`;
        
        // Measure text width
        const metrics = context.measureText(message);
        const textWidth = metrics.width;
        
        // Resize canvas to fit text
        canvas.width = textWidth + 20; // Padding
        canvas.height = fontSize + 20;
        
        // Re-apply font after resize
        context.font = `Bold ${fontSize}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Draw text outline (black) for readability
        context.strokeStyle = 'black';
        context.lineWidth = 6;
        context.strokeText(message, canvas.width / 2, canvas.height / 2);
        
        // Draw text fill
        context.fillStyle = color;
        context.fillText(message, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        
        // Scale sprite to match text aspect ratio
        // Base scale factor
        const scale = 0.015; 
        sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
        
        return sprite;
    }

    update(dt) {
        // Bobbing animation
        const time = Date.now() * 0.003 + this.bobOffset;
        this.mesh.position.y = 0.5 + Math.sin(time) * 0.15;
        this.mesh.rotation.y += dt;
        this.mesh.rotation.x += dt * 0.5;
        
        this.position.copy(this.mesh.position);
    }
}
