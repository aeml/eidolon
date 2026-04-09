import * as THREE from 'three';
import { Entity } from './Entity.js';
import { GEM_QUALITIES } from '../core/ItemSystem.js';

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
        this.maxLifetime = 60000; // 60 seconds in ms

        this.bobOffset = Math.random() * Math.PI * 2;
        this.textDelay = Math.random() * 0.5; // Stagger text generation
        
        const gemQuality = item.gemQuality ? (GEM_QUALITIES[item.gemQuality] || GEM_QUALITIES[String(item.gemQuality).toUpperCase()]) : null;
        this.itemColor = gemQuality?.color || item.rarity.color;
        this.itemName = item.name;
        this.textGenerated = false;
        this.visualState = 'default';
        this.baseScale = 1.0;

        this.createMesh();
    }

    createMesh() {
        if (this.mesh) return;

        const color = this.itemColor;
        
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
        this.baseScale = 1.0;
        this.mesh.scale.setScalar(this.baseScale);
        
        // Add Hitbox for easier clicking
        const hitMesh = new THREE.Mesh(HITBOX_GEOMETRY, HITBOX_MATERIAL);
        hitMesh.position.y = 0.0; // Centered on orb
        this.mesh.add(hitMesh);
        this.applyPickupVisualState();
    }

    async ensureMesh() {
        if (!this.mesh) {
            this.createMesh();
        }
    }

    setPickupVisualState(state = 'default') {
        const nextState = state || 'default';
        if (this.visualState === nextState) return;
        this.visualState = nextState;
        this.applyPickupVisualState();
    }

    applyPickupVisualState() {
        if (!this.mesh || !this.mesh.material) return;

        let scaleMultiplier = 1.0;
        let opacity = 0.9;

        if (this.visualState === 'in_range') {
            scaleMultiplier = 1.15;
            opacity = 1.0;
        } else if (this.visualState === 'targeted') {
            scaleMultiplier = 1.3;
            opacity = 1.0;
        }

        this.mesh.scale.setScalar(this.baseScale * scaleMultiplier);
        this.mesh.material.opacity = opacity;
        this.mesh.material.transparent = opacity < 1.0;
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
            
            // Simple Cache Limit
            if (TEXTURE_CACHE.size > 100) {
                // Clear cache if too big to prevent leaks
                // In a real app, we might use LRU, but clearing is safe as textures will be recreated if needed
                TEXTURE_CACHE.forEach(t => t.dispose());
                TEXTURE_CACHE.clear();
            }
            
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

        if (!this.mesh) return;

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

    dispose() {
        if (this.mesh) {
            this.mesh.children.forEach(child => {
                // Text Sprite
                if (child.isSprite && child.material) {
                    // Do NOT dispose map as it is cached in TEXTURE_CACHE
                    child.material.dispose();
                }
            });

            if (this.mesh.parent?.remove) {
                this.mesh.parent.remove(this.mesh);
            }

            this.mesh = null;
        }
    }
}
