import * as THREE from 'three';
import { Entity } from './Entity.js';

// Optimization: Shared Geometries and Materials
const SHARED_GEOMETRY = new THREE.SphereGeometry(0.2, 8, 8); // Reduced detail
const HITBOX_GEOMETRY = new THREE.BoxGeometry(3.0, 3.0, 3.0); // Larger box to cover orb and text
const HITBOX_MATERIAL = new THREE.MeshBasicMaterial({ 
    visible: true, 
    transparent: true, 
    opacity: 0, 
    side: THREE.DoubleSide,
    depthWrite: false
});
const MATERIAL_CACHE = new Map(); // Color -> Material
const TEXTURE_CACHE = new Map(); // "Name|Color" -> Texture

export class LootDrop extends Entity {
    constructor(item, x, z, id = null) {
        super(id);
        this.item = item;
        this.position.set(x, 0.5, z); // Float slightly above ground
        this.radius = 0.5;
        
        this.creationTime = Date.now();
        this.maxLifetime = 30000; // 30 seconds in ms

        // Create visual representation
        // Color based on rarity
        const color = item.rarity.color;
        
        // Get or Create Material
        let material = MATERIAL_CACHE.get(color);
        if (!material) {
            // Use MeshBasicMaterial for performance (self-illuminated look)
            material = new THREE.MeshBasicMaterial({ 
                color: color
            });
            MATERIAL_CACHE.set(color, material);
        }
        
        this.mesh = new THREE.Mesh(SHARED_GEOMETRY, material);
        this.mesh.position.copy(this.position);
        this.mesh.userData.entityId = this.id;
        this.mesh.userData.type = 'LOOT';
        
        // Removed PointLight for performance
        
        // Add Hitbox for easier clicking
        const hitMesh = new THREE.Mesh(HITBOX_GEOMETRY, HITBOX_MATERIAL);
        hitMesh.position.y = 0.0; // Centered on orb
        this.mesh.add(hitMesh);
        
        this.bobOffset = Math.random() * Math.PI * 2;

        // Delayed Text Generation
        this.textGenerated = false;
        this.itemColor = color;
        this.itemName = item.name;
        this.textDelay = Math.random() * 0.5; // Stagger text generation
    }

    createTextSprite(message, color) {
        const cacheKey = `${message}|${color}`;
        
        let texture = TEXTURE_CACHE.get(cacheKey);
        let width, height;

        if (!texture) {
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
            
            texture = new THREE.CanvasTexture(canvas);
            TEXTURE_CACHE.set(cacheKey, texture);
            
            width = canvas.width;
            height = canvas.height;
        } else {
            width = texture.image.width;
            height = texture.image.height;
        }
        
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        
        // Scale sprite to match text aspect ratio
        // Base scale factor
        const scale = 0.015; 
        sprite.scale.set(width * scale, height * scale, 1);
        
        return sprite;
    }

    update(dt) {
        // Lifetime check
        if (Date.now() - this.creationTime >= this.maxLifetime) {
            this.isActive = false;
            return;
        }

        // Lazy Load Text
        if (!this.textGenerated && (Date.now() - this.creationTime) > (this.textDelay * 1000)) {
            const label = this.createTextSprite(this.itemName, this.itemColor);
            label.position.set(0, 0.6, 0); // Above the orb
            this.mesh.add(label);
            this.textGenerated = true;
        }

        // Bobbing animation
        const time = Date.now() * 0.003 + this.bobOffset;
        this.mesh.position.y = 0.5 + Math.sin(time) * 0.15;
        this.mesh.rotation.y += dt;
        this.mesh.rotation.x += dt * 0.5;
        
        this.position.copy(this.mesh.position);
    }
}
