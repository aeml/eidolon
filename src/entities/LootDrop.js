import * as THREE from 'three';
import { Entity } from './Entity.js';
import { GEM_QUALITIES } from '../core/ItemSystem.js';
import {
    createProceduralLootVisual,
    setProceduralLootVisualState
} from '../art/ProceduralLoot.js';

const HITBOX_GEOMETRY = new THREE.BoxGeometry(3.0, 3.0, 3.0);
const HITBOX_MATERIAL = new THREE.MeshBasicMaterial({
    visible: true,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false
});
const TEXTURE_CACHE = new Map();
const MAX_IDLE_TEXT_TEXTURES = 100;
let textureClock = 0;

const RARITY_COLORS = Object.freeze({
    Common: '#ffffff',
    Uncommon: '#1eff00',
    Rare: '#0070dd',
    Legendary: '#ff8000',
    Eidolic: '#a020f0'
});

function itemRarityName(item) {
    return typeof item?.rarity === 'string' ? item.rarity : item?.rarity?.name;
}

function itemLabelColor(item) {
    const gemQuality = item?.gemQuality
        ? (GEM_QUALITIES[item.gemQuality] || GEM_QUALITIES[String(item.gemQuality).toUpperCase()])
        : null;
    return gemQuality?.color || item?.rarity?.color || RARITY_COLORS[itemRarityName(item)] || '#ffffff';
}

function evictIdleTextTextures() {
    while (TEXTURE_CACHE.size > MAX_IDLE_TEXT_TEXTURES) {
        let candidateKey = null;
        let candidate = null;
        for (const [key, entry] of TEXTURE_CACHE) {
            if (entry.refs > 0) continue;
            if (!candidate || entry.lastUsed < candidate.lastUsed) {
                candidateKey = key;
                candidate = entry;
            }
        }
        if (!candidate) return;
        candidate.texture.dispose();
        TEXTURE_CACHE.delete(candidateKey);
    }
}

function acquireTextTexture(message, color) {
    const cacheKey = `${message}|${color}`;
    let entry = TEXTURE_CACHE.get(cacheKey);
    if (!entry) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = 32;
        context.font = `Bold ${fontSize}px Arial`;
        const textWidth = typeof context.measureText === 'function'
            ? context.measureText(message).width
            : message.length * fontSize * 0.62;
        canvas.width = Math.ceil(textWidth + 20);
        canvas.height = fontSize + 20;
        context.font = `Bold ${fontSize}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeStyle = 'black';
        context.lineWidth = 6;
        context.strokeText?.(message, canvas.width / 2, canvas.height / 2);
        context.fillStyle = color;
        context.fillText?.(message, canvas.width / 2, canvas.height / 2);
        entry = {
            texture: new THREE.CanvasTexture(canvas),
            width: canvas.width,
            height: canvas.height,
            refs: 0,
            lastUsed: ++textureClock
        };
        TEXTURE_CACHE.set(cacheKey, entry);
    }
    entry.refs++;
    entry.lastUsed = ++textureClock;
    evictIdleTextTextures();
    return { cacheKey, ...entry };
}

function releaseTextTexture(cacheKey) {
    const entry = TEXTURE_CACHE.get(cacheKey);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    entry.lastUsed = ++textureClock;
    evictIdleTextTextures();
}

export class LootDrop extends Entity {
    constructor(item, x, z, id = null, { quality = 'high' } = {}) {
        super(id);
        this.item = item;
        this.position.set(x, 0, z);
        this.radius = 0.5;
        this.creationTime = Date.now();
        this.maxLifetime = 60000;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.textDelay = Math.random() * 0.5;
        this.itemColor = itemLabelColor(item);
        this.itemName = item?.name || 'Unknown Relic';
        this.textGenerated = false;
        this.visualState = 'default';
        this.graphicsQuality = quality === 'low' ? 'low' : 'high';
        this.visualRoot = null;
        this.label = null;
        this.createMesh();
    }

    createMesh() {
        if (this.mesh) return;
        this.mesh = new THREE.Group();
        this.mesh.name = `LootDrop_${this.id}`;
        this.mesh.position.copy(this.position);
        this.mesh.userData.entityId = this.id;
        this.mesh.userData.type = 'LOOT';
        this.visualRoot = createProceduralLootVisual(this.item, { quality: this.graphicsQuality });
        if (this.visualRoot) this.mesh.add(this.visualRoot);
        const hitMesh = new THREE.Mesh(HITBOX_GEOMETRY, HITBOX_MATERIAL);
        hitMesh.name = 'LootHitbox';
        hitMesh.userData.entityId = this.id;
        hitMesh.userData.type = 'LOOT';
        this.mesh.add(hitMesh);
        this.applyPickupVisualState();
    }

    async ensureMesh() {
        if (!this.mesh) this.createMesh();
    }

    setPickupVisualState(state = 'default') {
        const nextState = state || 'default';
        if (this.visualState === nextState) return;
        this.visualState = nextState;
        this.applyPickupVisualState();
    }

    applyPickupVisualState() {
        if (this.visualRoot) setProceduralLootVisualState(this.visualRoot, this.visualState);
    }

    createTextSprite(message, color) {
        const entry = acquireTextTexture(message, color);
        const material = new THREE.SpriteMaterial({ map: entry.texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.name = 'LootLabel';
        sprite.userData.textTextureCacheKey = entry.cacheKey;
        const scale = 0.015;
        sprite.scale.set(entry.width * scale, entry.height * scale, 1);
        return sprite;
    }

    update(dt) {
        if (Date.now() - this.creationTime >= this.maxLifetime) {
            this.isActive = false;
            return;
        }
        if (!this.mesh) return;
        if (!this.textGenerated && (Date.now() - this.creationTime) > (this.textDelay * 1000)) {
            this.label = this.createTextSprite(this.itemName, this.itemColor);
            this.label.position.set(0, 1.38, 0);
            this.mesh.add(this.label);
            this.textGenerated = true;
        }
        const time = Date.now() * 0.003 + this.bobOffset;
        if (this.visualRoot) {
            const content = this.visualRoot.getObjectByName('LootContent');
            if (content) {
                content.position.y = content.userData.restY + Math.sin(time) * 0.1;
                content.rotation.y += dt * 0.72;
            }
            const halo = this.visualState === 'targeted'
                ? this.visualRoot.getObjectByName('LootReliquary_Targeted')
                : this.visualRoot.getObjectByName('LootReliquary_InRange');
            if (halo?.visible) halo.rotation.z += dt * 0.9;
        }
    }

    dispose() {
        if (!this.mesh) return;
        this.mesh.traverse((child) => {
            if (!child.isSprite || !child.material) return;
            releaseTextTexture(child.userData.textTextureCacheKey);
            child.material.dispose();
        });
        if (this.mesh.parent?.remove) this.mesh.parent.remove(this.mesh);
        this.mesh = null;
        this.visualRoot = null;
        this.label = null;
    }
}

export function getLootDropCacheMetrics() {
    let referenced = 0;
    let references = 0;
    for (const entry of TEXTURE_CACHE.values()) {
        if (entry.refs > 0) referenced++;
        references += entry.refs;
    }
    return Object.freeze({
        textTextures: TEXTURE_CACHE.size,
        referencedTextTextures: referenced,
        textTextureReferences: references,
        maxIdleTextTextures: MAX_IDLE_TEXT_TEXTURES
    });
}
