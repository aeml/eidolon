import * as THREE from 'three';
import { GEM_QUALITIES, GEM_TYPES } from '../core/ItemSystem.js';
import {
    EQUIPMENT_VISUAL_DESCRIPTORS,
    createProceduralEquipmentVisual,
    resolveEquipmentVisualDescriptor
} from './ProceduralEquipment.js';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

const RARITY_COLORS = Object.freeze({
    Common: 0xb9b7ad,
    Uncommon: 0x4fc766,
    Rare: 0x4b8ce8,
    Legendary: 0xf09a38,
    Eidolic: 0xb16be8
});

const GEM_PALETTES = Object.freeze({
    Ruby: [0x8f1725, 0xff5464],
    Sapphire: [0x183d99, 0x65a3ff],
    Emerald: [0x176c42, 0x57e39c],
    Topaz: [0xa36815, 0xffd45b],
    Diamond: [0x9cadb5, 0xf3ffff],
    Onyx: [0x17131d, 0x8666aa],
    Opal: [0x507aa0, 0xb9e7ff]
});

const EQUIPMENT_NAMES = Object.freeze(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS));
const GEM_QUALITY_NAMES = Object.freeze(['Chipped', 'Flawed', 'Normal', 'Flawless', 'Perfect', 'Radiant']);
const GEM_TYPE_NAMES = Object.freeze(['Ruby', 'Sapphire', 'Emerald', 'Topaz', 'Diamond', 'Onyx', 'Opal']);
export const PROCEDURAL_LOOT_IDENTITIES = Object.freeze({
    equipment: EQUIPMENT_NAMES,
    gems: Object.freeze(GEM_QUALITY_NAMES.flatMap((quality) =>
        GEM_TYPE_NAMES.map((type) => `${quality} ${type}`)
    )),
    currency: Object.freeze(['Eidolon Heart', 'Eidolon Shard'])
});

function geometry(key, create) {
    if (!GEOMETRIES.has(key)) GEOMETRIES.set(key, create());
    return GEOMETRIES.get(key);
}

function material(key, color, options = {}) {
    const cacheKey = [key, color, options.emissive || 0, options.emissiveIntensity || 0,
        options.opacity ?? 1, options.side ?? THREE.FrontSide, options.metalness ?? 0.24,
        options.roughness ?? 0.46, options.depthWrite ?? true, options.flatShading ?? true].join(':');
    if (!MATERIALS.has(cacheKey)) {
        MATERIALS.set(cacheKey, new THREE.MeshStandardMaterial({
            color,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            metalness: options.metalness ?? 0.24,
            roughness: options.roughness ?? 0.46,
            transparent: (options.opacity ?? 1) < 1,
            opacity: options.opacity ?? 1,
            depthWrite: options.depthWrite ?? true,
            side: options.side ?? THREE.FrontSide,
            flatShading: options.flatShading ?? true
        }));
    }
    return MATERIALS.get(cacheKey);
}

function addMesh(parent, name, geometryValue, materialValue, {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1]
} = {}) {
    const mesh = new THREE.Mesh(geometryValue, materialValue);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

function rarityName(item) {
    if (typeof item?.rarity === 'string') return item.rarity;
    return item?.rarity?.name || 'Common';
}

function resolveGem(item) {
    const words = String(item?.name || '').trim().split(/\s+/);
    const typeInfo = GEM_TYPES[item?.gemType]
        || GEM_TYPES[String(item?.gemType || words.at(-1) || '').toUpperCase()];
    const qualityInfo = GEM_QUALITIES[item?.gemQuality]
        || GEM_QUALITIES[String(item?.gemQuality || words[0] || '').toUpperCase()];
    if (!typeInfo || !qualityInfo) return null;
    const rank = GEM_QUALITY_NAMES.indexOf(qualityInfo.name) + 1;
    if (rank <= 0) return null;
    return Object.freeze({ type: typeInfo.name, quality: qualityInfo.name, rank });
}

function currencyName(item) {
    const name = String(item?.name || '');
    if (name === 'Heart') return 'Eidolon Heart';
    if (name === 'Shard') return 'Eidolon Shard';
    return PROCEDURAL_LOOT_IDENTITIES.currency.includes(name) ? name : null;
}

export function resolveProceduralLootIdentity(item) {
    const equipment = resolveEquipmentVisualDescriptor(item);
    if (equipment) {
        return Object.freeze({
            kind: 'equipment',
            key: equipment.baseName,
            family: equipment.family,
            motif: equipment.variant,
            rarity: rarityName(item)
        });
    }
    const gem = resolveGem(item);
    if (gem) {
        return Object.freeze({
            kind: 'gem',
            key: `${gem.quality} ${gem.type}`,
            family: gem.type,
            motif: gem.quality,
            quality: gem.quality,
            qualityRank: gem.rank,
            rarity: rarityName(item)
        });
    }
    const currency = currencyName(item);
    if (currency) {
        return Object.freeze({
            kind: 'currency',
            key: currency,
            family: currency === 'Eidolon Heart' ? 'enduring-soul' : 'broken-purpose',
            motif: currency === 'Eidolon Heart' ? 'heart-reliquary' : 'shard-prism',
            rarity: rarityName(item)
        });
    }
    return null;
}

function fitContent(content, targetHeight = 0.92) {
    content.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(content);
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z, 0.001);
    const scale = targetHeight / largest;
    content.scale.multiplyScalar(scale);
    content.position.set(-center.x * scale, 0.12 - bounds.min.y * scale, -center.z * scale);
    content.userData.restY = content.position.y;
}

function buildGem(content, identity, qualityMode) {
    const palette = GEM_PALETTES[identity.family] || GEM_PALETTES.Diamond;
    const core = material(`loot-gem-${identity.family}-core`, palette[0], {
        emissive: palette[0], emissiveIntensity: 0.34, metalness: 0.18, roughness: 0.2
    });
    const light = material(`loot-gem-${identity.family}-light`, palette[1], {
        emissive: palette[1], emissiveIntensity: 0.72, metalness: 0.22, roughness: 0.14
    });
    addMesh(content, 'LootGem_Core', geometry('loot-gem-core', () => new THREE.OctahedronGeometry(0.42, 1)), core, {
        scale: [0.72, 1.28, 0.72], rotation: [0, Math.PI / 4, 0]
    });
    addMesh(content, 'LootGem_Heart', geometry('loot-gem-heart', () => new THREE.OctahedronGeometry(0.19, 0)), light, {
        scale: [0.65, 1.42, 0.65], rotation: [0, 0, Math.PI / 4]
    });
    const crownCount = qualityMode === 'low' ? Math.min(3, identity.qualityRank) : identity.qualityRank;
    for (let index = 0; index < crownCount; index++) {
        const angle = index / crownCount * Math.PI * 2;
        addMesh(content, `LootGem_Crown${index + 1}`, geometry('loot-gem-crown', () =>
            new THREE.TetrahedronGeometry(0.105, 0)
        ), index % 2 ? core : light, {
            position: [Math.cos(angle) * 0.38, -0.29 + identity.qualityRank * 0.025, Math.sin(angle) * 0.38],
            rotation: [0, -angle, Math.PI]
        });
    }
}

function heartGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.48);
    shape.bezierCurveTo(-0.12, -0.3, -0.52, -0.03, -0.52, 0.3);
    shape.bezierCurveTo(-0.52, 0.66, -0.08, 0.74, 0, 0.43);
    shape.bezierCurveTo(0.08, 0.74, 0.52, 0.66, 0.52, 0.3);
    shape.bezierCurveTo(0.52, -0.03, 0.12, -0.3, 0, -0.48);
    return new THREE.ExtrudeGeometry(shape, {
        depth: 0.2,
        bevelEnabled: true,
        bevelSegments: 1,
        bevelSize: 0.04,
        bevelThickness: 0.04,
        curveSegments: 4
    }).center();
}

function buildCurrency(content, identity, qualityMode) {
    if (identity.key === 'Eidolon Heart') {
        const iron = material('loot-heart-iron', 0x3b2630, { metalness: 0.72, roughness: 0.35 });
        const soul = material('loot-heart-soul', 0xa94367, {
            emissive: 0xd34c78, emissiveIntensity: 0.72, metalness: 0.18, roughness: 0.22
        });
        addMesh(content, 'LootHeart_Soul', geometry('loot-heart-shape', heartGeometry), soul, {
            rotation: [0.08, 0, -0.03], scale: [0.78, 0.78, 0.78]
        });
        addMesh(content, 'LootHeart_Cage', geometry('loot-heart-cage', () => new THREE.TorusGeometry(0.53, 0.04, 5, 10)), iron, {
            rotation: [Math.PI / 2, 0, 0], scale: [0.82, 1.18, 1]
        });
        addMesh(content, 'LootHeart_Crown', geometry('loot-heart-crown', () => new THREE.ConeGeometry(0.18, 0.38, 5)), iron, {
            position: [0, 0.57, 0], rotation: [0, 0, Math.PI]
        });
        return;
    }
    const shard = material('loot-shard-core', 0x446278, {
        emissive: 0x63b3d2, emissiveIntensity: 0.58, metalness: 0.34, roughness: 0.18
    });
    const edge = material('loot-shard-edge', 0xb6e9ee, {
        emissive: 0x74dbe4, emissiveIntensity: 0.78, metalness: 0.45, roughness: 0.16
    });
    addMesh(content, 'LootShard_Prism', geometry('loot-shard-prism', () => new THREE.TetrahedronGeometry(0.5, 0)), shard, {
        scale: [0.62, 1.26, 0.58], rotation: [0.18, -0.35, -0.18]
    });
    const fragmentCount = qualityMode === 'low' ? 2 : 4;
    for (let index = 0; index < fragmentCount; index++) {
        const angle = index / fragmentCount * Math.PI * 2 + 0.3;
        addMesh(content, `LootShard_Fragment${index + 1}`, geometry('loot-shard-fragment', () =>
            new THREE.TetrahedronGeometry(0.13, 0)
        ), edge, {
            position: [Math.cos(angle) * 0.48, -0.18 + (index % 2) * 0.2, Math.sin(angle) * 0.48],
            rotation: [angle, -angle * 0.7, angle * 0.4]
        });
    }
}

function addReliquary(root, identity) {
    const rarityColor = RARITY_COLORS[identity.rarity] || RARITY_COLORS.Common;
    const iron = material('loot-reliquary-iron', 0x211d22, { metalness: 0.78, roughness: 0.4 });
    const glow = material(`loot-reliquary-${identity.rarity}`, rarityColor, {
        emissive: rarityColor, emissiveIntensity: 0.58, metalness: 0.4, roughness: 0.28,
        opacity: 0.76, depthWrite: false, side: THREE.DoubleSide
    });
    addMesh(root, 'LootReliquary_Base', geometry('loot-reliquary-base', () =>
        new THREE.CylinderGeometry(0.5, 0.61, 0.11, 8)
    ), iron, { position: [0, 0.045, 0] });
    addMesh(root, 'LootReliquary_Rune', geometry('loot-reliquary-rune', () =>
        new THREE.TorusGeometry(0.42, 0.025, 4, 12)
    ), glow, { position: [0, 0.105, 0], rotation: [Math.PI / 2, 0, 0] });
    const inRange = addMesh(root, 'LootReliquary_InRange', geometry('loot-reliquary-range', () =>
        new THREE.TorusGeometry(0.56, 0.035, 4, 16)
    ), material('loot-in-range', 0xe9d49a, {
        emissive: 0xd9b75d, emissiveIntensity: 0.75, opacity: 0.68,
        depthWrite: false, side: THREE.DoubleSide
    }), { position: [0, 0.115, 0], rotation: [Math.PI / 2, 0, 0] });
    inRange.visible = false;
    const targeted = addMesh(root, 'LootReliquary_Targeted', geometry('loot-reliquary-targeted', () =>
        new THREE.TorusGeometry(0.66, 0.045, 4, 4)
    ), material('loot-targeted', 0xffefb1, {
        emissive: 0xffc84b, emissiveIntensity: 0.95, opacity: 0.88,
        depthWrite: false, side: THREE.DoubleSide
    }), { position: [0, 0.13, 0], rotation: [Math.PI / 2, 0, Math.PI / 4] });
    targeted.visible = false;
}

/** Returns an independently poseable exact ground form for every generated item. */
export function createProceduralLootVisual(item, { quality = 'high' } = {}) {
    const identity = resolveProceduralLootIdentity(item);
    if (!identity) return null;
    const qualityMode = quality === 'low' ? 'low' : 'high';
    const root = new THREE.Group();
    root.name = `ProceduralLoot_${identity.key.replaceAll(' ', '_')}`;
    root.userData.proceduralLoot = true;
    root.userData.identity = identity.key;
    root.userData.kind = identity.kind;
    root.userData.family = identity.family;
    root.userData.motif = identity.motif;
    root.userData.artStyle = 'code-generated dark-fantasy fallen reliquary';
    root.userData.quality = qualityMode;
    root.userData.rarity = identity.rarity;
    addReliquary(root, identity);

    const content = new THREE.Group();
    content.name = 'LootContent';
    if (identity.kind === 'equipment') {
        const equipment = createProceduralEquipmentVisual(item, {
            slot: resolveEquipmentVisualDescriptor(item).slot,
            side: -1,
            fitScale: 1,
            name: `LootEquipment_${identity.key.replaceAll(' ', '_')}`
        });
        if (!equipment) return null;
        content.add(equipment);
        if (['blade', 'focusWeapon'].includes(identity.family)) content.rotation.z = -0.44;
        else if (['ring', 'neckwear', 'trinket'].includes(identity.family)) content.rotation.x = -0.32;
    } else if (identity.kind === 'gem') {
        buildGem(content, identity, qualityMode);
    } else {
        buildCurrency(content, identity, qualityMode);
    }
    fitContent(content, identity.kind === 'equipment' ? 0.96 : 0.88);
    root.add(content);
    let parts = 0;
    let visibleParts = 0;
    root.traverse((child) => {
        if (!child.isMesh) return;
        parts++;
        if (child.visible) visibleParts++;
    });
    root.userData.parts = parts;
    root.userData.visibleParts = visibleParts;
    return root;
}

export function setProceduralLootVisualState(root, state = 'default') {
    if (!root?.userData?.proceduralLoot) return false;
    const normalized = ['default', 'in_range', 'targeted'].includes(state) ? state : 'default';
    root.userData.pickupState = normalized;
    root.getObjectByName('LootReliquary_InRange').visible = normalized === 'in_range';
    root.getObjectByName('LootReliquary_Targeted').visible = normalized === 'targeted';
    const scale = normalized === 'targeted' ? 1.14 : normalized === 'in_range' ? 1.07 : 1;
    root.scale.setScalar(scale);
    return true;
}

export function getProceduralLootCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
