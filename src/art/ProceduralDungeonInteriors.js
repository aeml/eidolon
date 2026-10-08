import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getRegionTheme } from './darkFantasyTheme.js';
import { getDungeonRoomIdentityTag } from '../utils/dungeonRoomMetadata.js';
import { createTaperedRoot } from './EarthLandmarkGeometry.js';
import { sampleVerdantMasonry } from './VerdantMasonry.js';
import { createCryptWallGeometry } from './CryptWallGeometry.js';
import { sampleElementalDungeonSurface } from './ElementalDungeonSurface.js';
import { createElementalDungeonWallGeometry } from './ElementalDungeonWallGeometry.js';
import { createDungeonVigilBase, createDungeonVigilShaft, createDungeonVigilCage,
    createDungeonBevelBlock, createDungeonFontBasin, createDungeonCofferLid } from './DungeonVigilGeometry.js';

const TEXTURE_SIZE = 64;
export const DUNGEON_FLOOR_TEXTURE_SPAN = 24;

const defineInterior = (dungeonType, label, artStyle, surfaceLanguage) => Object.freeze({
    dungeonType,
    label,
    artStyle,
    surfaceLanguage
});

export const DUNGEON_INTERIOR_DEFINITIONS = Object.freeze({
    verdant_bastion_catacombs: defineInterior(
        'verdant_bastion_catacombs',
        'The Thorncrypt',
        'root-bound funerary halls with witchlight seams, briar wards, and tarnished bronze reliquaries',
        'mossed burial blocks crossed by living roots'
    ),
    molten_core: defineInterior(
        'molten_core',
        'The Furnace Below',
        'obsidian forge vaults with molten fault lines, chained pylons, and crucible-red ritual floors',
        'black-glass plates split by incandescent magma'
    ),
    tempest_spire: defineInterior(
        'tempest_spire',
        'The Shattered Aerie',
        'storm-slate chambers with silver conductors, captive violet arcs, and wind-scoured sky sigils',
        'offset slate plates wired by lightning conductors'
    ),
    abyssal_well: defineInterior(
        'abyssal_well',
        'The Drowned Sanctum',
        'flooded basalt sanctums with black-water tide rings, moon pearls, and bioluminescent coral wards',
        'drowned basalt blocks beneath luminous tide marks'
    ),
    umbral_nexus: defineInterior(
        'umbral_nexus',
        'The Broken Memory',
        'fractured memory halls with void-cut masonry, violet seams, and eidolon constellations',
        'black memory glass divided by unstable spirit fractures'
    )
});

export const DUNGEON_INTERIOR_IDS = Object.freeze(Object.keys(DUNGEON_INTERIOR_DEFINITIONS));
export const DUNGEON_ROOM_IDENTITY_IDS = Object.freeze([
    'entry_gate',
    'treasure_cache',
    'restorative_shrine',
    'ambush_chamber',
    'boss_approach',
    'elite_guard',
    'boss_lair',
    'route_hall'
]);

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

function colorBytes(hex) {
    // DataTexture below is tagged sRGB. Color stores linear components, so
    // encode them before writing bytes instead of darkening the palette twice.
    const color = new THREE.Color(hex).convertLinearToSRGB();
    return [color.r * 255, color.g * 255, color.b * 255];
}

function mixBytes(a, b, amount) {
    return [
        clampByte(a[0] + ((b[0] - a[0]) * amount)),
        clampByte(a[1] + ((b[1] - a[1]) * amount)),
        clampByte(a[2] + ((b[2] - a[2]) * amount))
    ];
}

function surfaceSample(dungeonType, surface, x, y, palette) {
    if (dungeonType === 'verdant_bastion_catacombs') return sampleVerdantMasonry(x, y, surface === 'wall');
    return sampleElementalDungeonSurface(x, y, dungeonType, surface === 'wall', palette);
}

function createSurfaceTexture(dungeonType, surface, channel, sampleCache, quality) {
    const size = dungeonType === 'verdant_bastion_catacombs' || quality !== 'low' ? 256 : TEXTURE_SIZE;
    const step = TEXTURE_SIZE / size;
    const theme = getRegionTheme(dungeonType);
    const palette = Object.freeze({
        shadow: colorBytes(theme.palette.shadow),
        ground: colorBytes(theme.palette.ground),
        midtone: colorBytes(theme.palette.midtone),
        accent: colorBytes(theme.palette.accent)
    });
    // Reuse one sampled surface for all four maps, then release it with this
    // kit-construction call. No persistent pixel cache or per-frame generation.
    if (!sampleCache.has(surface)) sampleCache.set(surface, Array.from({ length: size * size }, (_, index) =>
        surfaceSample(dungeonType, surface, (index % size) * step, Math.floor(index / size) * step, palette)));
    const samples = sampleCache.get(surface);
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const sample = samples[y * size + x];
            const offset = ((y * size) + x) * 4;
            if (channel === 'normal') {
                // Wrapped central differences keep repeat boundaries valid.
                // Small tangent normals add relief without displacing floors.
                const relief = (dx, dy) => samples[((y + dy + size) % size) * size + (x + dx + size) % size].relief;
                // Preserve Verdant's established field. Other families use
                // canonical-domain slopes at both texture resolutions.
                const strength = dungeonType === 'verdant_bastion_catacombs' ? 1.5 : 1.5 / step;
                const nx = (relief(-1, 0) - relief(1, 0)) * strength;
                const ny = (relief(0, -1) - relief(0, 1)) * strength;
                const length = Math.hypot(nx, ny, 1);
                data[offset] = clampByte((nx / length * 0.5 + 0.5) * 255);
                data[offset + 1] = clampByte((ny / length * 0.5 + 0.5) * 255);
                data[offset + 2] = clampByte((1 / length * 0.5 + 0.5) * 255);
            } else if (channel === 'roughness') {
                const value = clampByte(sample.roughness * 255);
                data[offset] = data[offset + 1] = data[offset + 2] = value;
            } else if (channel === 'emissive') {
                const value = clampByte(sample.emissive * 255);
                data[offset] = value;
                data[offset + 1] = value;
                data[offset + 2] = value;
            } else {
                data[offset] = sample.color[0];
                data[offset + 1] = sample.color[1];
                data[offset + 2] = sample.color[2];
            }
            data[offset + 3] = 255;
        }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = `procedural-dungeon-${dungeonType}-${surface}${channel === 'color' ? '' : `-${channel}`}`;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = channel === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.needsUpdate = true;
    texture.userData.proceduralDungeonSurface = true;
    return texture;
}

function configureDungeonMaterial(material, isTransparent = false) {
    material.transparent = isTransparent;
    material.opacity = isTransparent ? 0.28 : 1;
    material.depthWrite = !isTransparent;
    material.flatShading = true;
    material.polygonOffset = true;
    material.polygonOffsetFactor = 1;
    material.polygonOffsetUnits = 1;
    material.shadowSide = THREE.FrontSide;
    return material;
}

function makeDetailMaterial(color, options = {}) {
    return configureDungeonMaterial(new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.85,
        metalness: options.metalness ?? 0,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0,
        side: options.side ?? THREE.FrontSide
    }));
}

function createMaterialSet(dungeonType) {
    const theme = getRegionTheme(dungeonType);
    return Object.freeze({
        shadow: makeDetailMaterial(theme.palette.shadow, { roughness: 0.98 }),
        stone: makeDetailMaterial(theme.palette.midtone, { roughness: 0.94 }),
        metal: makeDetailMaterial(mixBytes(
            colorBytes(theme.palette.shadow),
            colorBytes(theme.palette.midtone),
            0.62
        ).reduce((value, byte) => (value << 8) + byte, 0), { roughness: 0.42, metalness: 0.68 }),
        accent: makeDetailMaterial(theme.palette.accent, {
            roughness: 0.4,
            emissive: theme.palette.accent,
            emissiveIntensity: 1.15
        }),
        spirit: makeDetailMaterial(theme.palette.spirit, {
            roughness: 0.28,
            emissive: theme.palette.spirit,
            emissiveIntensity: 1.42,
            side: THREE.DoubleSide
        }),
        inlay: makeDetailMaterial(theme.palette.midtone, {
            roughness: .82, metalness: .25,
            emissive: theme.palette.accent, emissiveIntensity: .08
        })
    });
}

function createShapes() {
    return Object.freeze({
        box: new THREE.BoxGeometry(1, 1, 1),
        cylinder6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
        cylinder8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
        cone4: new THREE.ConeGeometry(0.5, 1, 4),
        cone6: new THREE.ConeGeometry(0.5, 1, 6),
        cofferLid: createDungeonCofferLid(),
        vigilInlay: new THREE.RingGeometry(0.486, 0.5, 48),
        graveRoot: createTaperedRoot([[-1, 0, 0], [-.6, .18, .12], [.2, .08, -.12], [1, 0, 0]], .07, 'low'),
        octahedron: new THREE.OctahedronGeometry(0.5, 0),
        vigilBase: createDungeonVigilBase(),
        vigilShaft: createDungeonVigilShaft(),
        vigilCage: createDungeonVigilCage(),
        bevelBlock: createDungeonBevelBlock(),
        fontBasin: createDungeonFontBasin()
    });
}

function addPart(root, name, shape, material, {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = true,
    receiveShadow = true
} = {}) {
    const mesh = new THREE.Mesh(shape, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.proceduralDungeonInteriorPart = true;
    root.add(mesh);
    return mesh;
}

function addPylon(root, shapes, materials, name, x, z, height = 4) {
    addPart(root, `${name}:base`, shapes.vigilBase, materials.stone, {
        position: [x, 0.24, z], scale: [2.4, 0.48, 2.4]
    });
    addPart(root, `${name}:shaft`, shapes.vigilShaft, materials.metal, {
        position: [x, height / 2, z], scale: [1.12, height, 1.12]
    });
    addPart(root, `${name}:cage`, shapes.vigilCage, materials.metal, {
        position: [x, height + .44, z]
    });
    addPart(root, `${name}:light`, shapes.octahedron, materials.accent, {
        position: [x, height + 0.55, z], scale: [1.1, 1.55, 1.1], castShadow: false
    });
}

function addFloorRing(root, shapes, material, name, radius, y = 0.14) {
    return addPart(root, name, shapes.vigilInlay, material, {
        position: [0, y, 0],
        rotation: [-Math.PI / 2, 0, 0],
        scale: [radius * 2, radius * 2, 1],
        castShadow: false,
        receiveShadow: false
    });
}

function makeRoomStateMaterial(color, opacity) {
    const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    material.userData.proceduralDungeonRoomState = true;
    return material;
}

function addRoomStateMesh(root, name, geometry, material, {
    position = [0, 0, 0],
    rotation = [0, 0, 0]
} = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.proceduralDungeonInteriorPart = true;
    mesh.userData.proceduralDungeonRoomState = true;
    root.add(mesh);
    return mesh;
}

export function createDungeonRoomStatePresentation(dungeonType, room, roomIndex, { worldSpace = false } = {}) {
    const theme = getRegionTheme(dungeonType);
    const identity = getDungeonRoomIdentityTag(room) || 'route_hall';
    const size = Math.max(40, Number(room.width) || 80);
    const radius = Math.max(8, Math.min(24, size * 0.2));
    const markerRadius = Math.min(4, radius * .25);
    const root = new THREE.Group();
    root.name = `DungeonRoomState:${dungeonType}:${roomIndex}`;
    root.position.set(
        worldSpace ? Number(room.x) || 0 : 0,
        0,
        worldSpace ? Number(room.z) || 0 : 0
    );
    root.userData.proceduralDungeonRoomState = true;
    root.userData.dungeonType = dungeonType;
    root.userData.roomIndex = roomIndex;
    root.userData.roomIdentity = identity;
    root.userData.radius = radius;

    const objectiveMaterial = makeRoomStateMaterial(theme.palette.accent, 0.5);
    const currentMaterial = makeRoomStateMaterial(theme.palette.spirit, 0.26);
    const clearedMaterial = makeRoomStateMaterial(0xa8ffd0, 0.46);
    const sealMaterial = makeRoomStateMaterial(theme.palette.accent, 0.82);
    const portalMaterial = makeRoomStateMaterial(theme.palette.spirit, 0.18);

    const objectiveHalo = addRoomStateMesh(
        root,
        'DungeonObjectiveHalo',
        // A compact sanctuary seal rather than a room-wide circle that reads
        // like an attack telegraph. HUD/minimap keep the full room objective.
        new THREE.RingGeometry(markerRadius * 0.9 - .09, markerRadius * 0.9, 48),
        objectiveMaterial,
        { position: [0, 0.24, 0], rotation: [-Math.PI / 2, 0, 0] }
    );
    const currentHalo = addRoomStateMesh(
        root,
        'DungeonCurrentRoomHalo',
        new THREE.RingGeometry(markerRadius * 0.55 - .07, markerRadius * 0.55, 32),
        currentMaterial,
        { position: [0, 0.23, 0], rotation: [-Math.PI / 2, 0, 0] }
    );
    const clearedSigil = addRoomStateMesh(
        root,
        'DungeonClearedSigil',
        new THREE.RingGeometry(markerRadius * 0.22, markerRadius * 0.31, 8),
        clearedMaterial,
        { position: [0, 0.25, 0], rotation: [-Math.PI / 2, 0, Math.PI / 8] }
    );

    const sealCrown = new THREE.Group();
    sealCrown.name = 'DungeonObjectiveCrown';
    sealCrown.position.y = 0.28;
    sealCrown.userData.proceduralDungeonRoomState = true;
    for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2;
        addRoomStateMesh(
            sealCrown,
            `DungeonObjectiveRune:${i}`,
            // A compact objective glyph, not a huge solid arrow competing
            // with boss cones. Room state and the objective HUD remain primary.
            new THREE.RingGeometry(.32, .46, 4),
            sealMaterial.clone(),
            {
                position: [Math.cos(angle) * markerRadius * 0.68, 0, Math.sin(angle) * markerRadius * 0.68],
                rotation: [Math.PI / 2, 0, -angle]
            }
        );
    }
    root.add(sealCrown);

    let rewardSeal = null;
    if (room?.hook === 'chest' || room?.hook === 'shrine' || room?.hook === 'elite_ambush') {
        rewardSeal = addRoomStateMesh(
            root,
            'DungeonRewardSeal',
            new THREE.OctahedronGeometry(0.72, 0),
            sealMaterial.clone(),
            { position: [0, 3.6, radius * 0.12] }
        );
    }

    let exitPortal = null;
    if (room?.type === 'start') {
        exitPortal = addRoomStateMesh(
            root,
            'DungeonExitPortal',
            new THREE.TorusGeometry(3.25, 0.24, 8, 36),
            portalMaterial,
            { position: [0, 3.7, -radius * 0.42] }
        );
    }

    objectiveHalo.visible = false;
    currentHalo.visible = false;
    clearedSigil.visible = false;
    sealCrown.visible = false;
    if (rewardSeal) rewardSeal.visible = true;
    if (exitPortal) exitPortal.visible = true;
    return root;
}

export function applyDungeonRoomStatePresentation(presentation, roomState = null, summary = null) {
    if (!presentation?.userData?.proceduralDungeonRoomState) return;
    const cleared = Boolean(roomState?.cleared);
    const roomIndex = presentation.userData.roomIndex;
    const objective = !cleared && summary?.objectiveRoomIndex === roomIndex;
    const current = summary?.currentRoomIndex === roomIndex;
    const exitReady = summary?.objectiveRoomIndex === -1;
    const objectiveHalo = presentation.getObjectByName('DungeonObjectiveHalo');
    const currentHalo = presentation.getObjectByName('DungeonCurrentRoomHalo');
    const clearedSigil = presentation.getObjectByName('DungeonClearedSigil');
    const sealCrown = presentation.getObjectByName('DungeonObjectiveCrown');
    const rewardSeal = presentation.getObjectByName('DungeonRewardSeal');
    const exitPortal = presentation.getObjectByName('DungeonExitPortal');

    if (objectiveHalo) objectiveHalo.visible = objective;
    if (currentHalo) currentHalo.visible = current && !objective;
    if (clearedSigil) clearedSigil.visible = cleared;
    if (sealCrown) sealCrown.visible = objective;
    if (rewardSeal) rewardSeal.visible = !cleared;
    if (exitPortal) {
        exitPortal.visible = true;
        exitPortal.material.opacity = exitReady ? 0.9 : 0.18;
        exitPortal.scale.setScalar(exitReady ? 1.08 : 0.94);
    }
    presentation.userData.cleared = cleared;
    presentation.userData.objective = objective;
    presentation.userData.current = current;
    presentation.userData.exitReady = exitReady;
}

export function animateDungeonRoomStatePresentation(presentation, elapsedSeconds = 0) {
    if (!presentation?.userData?.proceduralDungeonRoomState) return;
    const pulse = 0.5 + (0.5 * Math.sin((elapsedSeconds * 3.2) + presentation.userData.roomIndex));
    const objectiveHalo = presentation.getObjectByName('DungeonObjectiveHalo');
    const currentHalo = presentation.getObjectByName('DungeonCurrentRoomHalo');
    const clearedSigil = presentation.getObjectByName('DungeonClearedSigil');
    const sealCrown = presentation.getObjectByName('DungeonObjectiveCrown');
    const rewardSeal = presentation.getObjectByName('DungeonRewardSeal');
    const exitPortal = presentation.getObjectByName('DungeonExitPortal');

    if (objectiveHalo?.visible) objectiveHalo.material.opacity = 0.42 + (pulse * 0.16);
    if (currentHalo?.visible) currentHalo.material.opacity = 0.18 + (pulse * 0.12);
    if (clearedSigil?.visible) clearedSigil.material.opacity = 0.28 + (pulse * 0.2);
    if (sealCrown?.visible) sealCrown.rotation.y = elapsedSeconds * 0.34;
    if (rewardSeal?.visible) {
        rewardSeal.rotation.y = elapsedSeconds * 0.7;
        rewardSeal.position.y = 3.6 + (pulse * 0.28);
    }
    if (exitPortal?.visible) {
        exitPortal.rotation.z = elapsedSeconds * (presentation.userData.exitReady ? 0.2 : 0.07);
        exitPortal.material.opacity = presentation.userData.exitReady
            ? 0.72 + (pulse * 0.22)
            : 0.14 + (pulse * 0.08);
    }
}

function buildRegionalMotif(root, dungeonType, shapes, materials, radius) {
    if (dungeonType === 'verdant_bastion_catacombs') {
        for (const side of [-1, 1]) {
            const rootBeam = addPart(root, `verdant:grave-root:${side}`, shapes.graveRoot, materials.shadow, {
                position: [side * radius * 0.78, .2, radius * 0.58],
                scale: [radius * .36, 2, 3]
            });
            rootBeam.rotation.y = side * .6;
        }
    } else if (dungeonType === 'molten_core') {
        for (const side of [-1, 1]) {
            addPart(root, `molten:crucible-fang:${side}`, shapes.cone4, materials.accent, {
                position: [side * radius * 0.56, 0.72, radius * 0.56],
                scale: [1.4, 2.8, 1.4]
            });
        }
    } else if (dungeonType === 'tempest_spire') {
        for (const side of [-1, 1]) {
            addPart(root, `tempest:floating-slate:${side}`, shapes.box, materials.stone, {
                position: [side * radius * 0.62, 1.4 + (side + 1) * 0.35, radius * 0.52],
                rotation: [0.18, side * 0.32, side * 0.12],
                scale: [3.2, 0.55, 2.1]
            });
        }
    } else if (dungeonType === 'abyssal_well') {
        for (const side of [-1, 1]) {
            addPart(root, `abyssal:coral-antler:${side}`, shapes.cone6, materials.spirit, {
                position: [side * radius * 0.58, 1.5, radius * 0.55],
                rotation: [0, 0, side * 0.38],
                scale: [1.15, 3.5, 1.15],
                castShadow: false
            });
        }
    } else {
        for (const side of [-1, 1]) {
            const shard = addPart(root, `umbral:memory-shard:${side}`, shapes.octahedron, side > 0 ? materials.accent : materials.spirit, {
                position: [side * radius * 0.58, 1.8, radius * 0.54],
                scale: [1.4, 3.6, 1.4],
                castShadow: false
            });
            shard.rotation.z = side * 0.34;
        }
    }
}

function buildRoomDressing(dungeonType, room, roomIndex, shapes, materials) {
    const identity = getDungeonRoomIdentityTag(room) || 'route_hall';
    const size = Math.max(40, Number(room.width) || 80);
    const radius = Math.max(8, Math.min(24, size * 0.2));
    const root = new THREE.Group();
    root.name = `DungeonRoomDressing:${dungeonType}:${roomIndex}:${identity}`;
    root.position.set(Number(room.x) || 0, 0, Number(room.z) || 0);
    root.userData.proceduralDungeonInterior = true;
    root.userData.dungeonType = dungeonType;
    root.userData.roomIndex = roomIndex;
    root.userData.roomIdentity = identity;
    root.userData.visualOnly = true;
    root.userData.roomBounds = [Number(room.width) || size, Number(room.height) || size];

    const wardRadius = Math.min(6, radius * .32);
    addFloorRing(root, shapes, materials.shadow, `${identity}:outer-ward`, wardRadius);
    addFloorRing(root, shapes, materials.inlay, `${identity}:inner-ward`, wardRadius * 0.67, 0.16);
    buildRegionalMotif(root, dungeonType, shapes, materials, radius);

    switch (identity) {
    case 'entry_gate':
        addPylon(root, shapes, materials, 'entry:left-vigil', -radius * 0.62, -radius * 0.42, 5.8);
        addPylon(root, shapes, materials, 'entry:right-vigil', radius * 0.62, -radius * 0.42, 5.8);
        addPart(root, 'entry:oath-threshold', shapes.bevelBlock, materials.stone, {
            position: [0, 0.2, -radius * 0.42], scale: [radius * 0.85, 0.4, 1.1]
        });
        break;
    case 'treasure_cache':
        addPart(root, 'cache:reliquary-plinth', shapes.vigilBase, materials.stone, {
            position: [0, 0.45, radius * 0.2], scale: [4.8, 0.9, 4.8]
        });
        addPart(root, 'cache:sealed-coffer', shapes.bevelBlock, materials.stone, {
            position: [0, 1.45, radius * 0.2], scale: [4.8, 1.6, 3.1]
        });
        addPart(root, 'cache:coffer-lid', shapes.cofferLid, materials.metal, {
            position: [0, 2.2, radius * .2], scale: [4.8, .75, 3.1]
        });
        for (const side of [-1, 1]) {
            addPart(root, `cache:iron-strap:${side}`, shapes.bevelBlock, materials.metal, {
                position: [side * 1.52, 1.45, radius * .2 + 1.56], scale: [.24, 1.55, .12]
            });
        }
        addPart(root, 'cache:warded-lock', shapes.octahedron, materials.accent, {
            position: [0, 1.5, radius * 0.2 + 1.62], scale: [0.72, 0.9, 0.48], castShadow: false
        });
        break;
    case 'restorative_shrine':
        addPart(root, 'shrine:basin', shapes.fontBasin, materials.stone, {
            position: [0, .95, radius * 0.12], scale: [6.4, 1.5, 6.4]
        });
        addPart(root, 'shrine:spirit-font', shapes.octahedron, materials.spirit, {
            position: [0, 2.4, radius * 0.12], scale: [1.8, 3.2, 1.8], castShadow: false
        });
        break;
    case 'ambush_chamber':
        for (let i = 0; i < 6; i += 1) {
            const angle = (i / 6) * Math.PI * 2;
            addPart(root, `ambush:watch-spike:${i}`, shapes.cone4, i % 2 ? materials.shadow : materials.metal, {
                position: [Math.cos(angle) * radius, 1.6, Math.sin(angle) * radius],
                rotation: [0, 0, (i % 2 ? -1 : 1) * 0.18],
                scale: [1.4, 3.2 + (i % 3), 1.4]
            });
        }
        break;
    case 'boss_approach':
        for (let i = -1; i <= 1; i += 1) {
            addPart(root, `approach:warning-bar:${i}`, shapes.box, i === 0 ? materials.accent : materials.metal, {
                position: [i * 5.5, 0.18, 0],
                rotation: [0, (Math.PI / 4) * (i === 0 ? 1 : -1), 0],
                scale: [0.72, 0.3, radius * 1.2],
                castShadow: false
            });
        }
        break;
    case 'elite_guard':
        for (const [x, z] of [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
            addPylon(root, shapes, materials, `elite:sentinel:${x}:${z}`, x * 0.7, z * 0.7, 4.2);
        }
        break;
    case 'boss_lair':
        addPart(root, 'boss:buried-dais', shapes.cylinder8, materials.shadow, {
            position: [0, 0.16, 0], scale: [radius * 1.45, 0.32, radius * 1.45]
        });
        if (room.hook === 'crystal_vigil') {
            // The old broad, emissive boss disc overwhelms Maelin/the crystal
            // under bloom. This is decorative inlay, not a combat telegraph.
            addPart(root, 'boss:crystal-vigil-inlay', shapes.vigilInlay, materials.metal, {
                position: [0, 0.35, 0], rotation: [-Math.PI / 2, 0, 0],
                scale: [radius * 0.84, radius * 0.84, 1], castShadow: false, receiveShadow: false
            });
        } else {
            addFloorRing(root, shapes, materials.inlay, 'boss:soul-circuit', radius * 0.42, 0.35);
        }
        for (let i = 0; i < 6; i += 1) {
            const angle = (i / 6) * Math.PI * 2;
            addPylon(root, shapes, materials, `boss:vigil:${i}`, Math.cos(angle) * radius, Math.sin(angle) * radius, 5.2);
        }
        break;
    case 'route_hall':
    default:
        for (const side of [-1, 1]) {
            addPart(root, `route:waystone:${side}`, shapes.vigilShaft, materials.stone, {
                position: [side * radius * 0.72, 1.35, 0], scale: [1.8, 2.7, 1.8]
            });
        }
        break;
    }

    return root;
}

function batchDressing(source) {
    source.updateMatrixWorld(true);
    const buckets = new Map();
    let sourceMeshCount = 0;
    source.traverse((part) => {
        if (!part.isMesh || !part.userData.proceduralDungeonInteriorPart) return;
        sourceMeshCount += 1;
        const key = `${part.material.uuid}:${part.castShadow ? 1 : 0}:${part.receiveShadow ? 1 : 0}`;
        if (!buckets.has(key)) {
            buckets.set(key, {
                material: part.material,
                castShadow: part.castShadow,
                receiveShadow: part.receiveShadow,
                geometries: []
            });
        }
        const baked = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
        buckets.get(key).geometries.push(baked.applyMatrix4(part.matrixWorld));
    });

    const result = new THREE.Group();
    result.name = source.name;
    result.position.copy(source.position);
    result.userData = { ...source.userData, renderBatched: true, sourceMeshCount };
    // The source matrix already includes its world translation. Keep the batched
    // root at the origin so room coordinates are not applied twice.
    result.position.set(0, 0, 0);
    [...buckets.values()].forEach((bucket, index) => {
        const merged = mergeGeometries(bucket.geometries, false);
        bucket.geometries.forEach((geometry) => geometry.dispose());
        if (!merged) return;
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, bucket.material);
        mesh.name = `${source.name}:batch:${index}`;
        mesh.castShadow = bucket.castShadow;
        mesh.receiveShadow = bucket.receiveShadow;
        mesh.userData.proceduralDungeonInteriorPart = true;
        result.add(mesh);
    });
    result.userData.drawMeshCount = result.children.length;
    return result;
}

export function createProceduralDungeonInteriorKit(dungeonType, { quality = 'high' } = {}) {
    const definition = DUNGEON_INTERIOR_DEFINITIONS[dungeonType];
    if (!definition) throw new Error(`Unknown procedural dungeon interior: ${dungeonType}`);

    const theme = getRegionTheme(dungeonType);
    const surfaceQuality = quality === 'low' ? 'low' : 'high';
    const sampleCache = new Map();
    const baseTextures = Object.freeze({
        floor: createSurfaceTexture(dungeonType, 'floor', 'color', sampleCache, surfaceQuality),
        floorEmissive: createSurfaceTexture(dungeonType, 'floor', 'emissive', sampleCache, surfaceQuality),
        floorNormal: createSurfaceTexture(dungeonType, 'floor', 'normal', sampleCache, surfaceQuality),
        floorRoughness: createSurfaceTexture(dungeonType, 'floor', 'roughness', sampleCache, surfaceQuality),
        wall: createSurfaceTexture(dungeonType, 'wall', 'color', sampleCache, surfaceQuality),
        wallEmissive: createSurfaceTexture(dungeonType, 'wall', 'emissive', sampleCache, surfaceQuality),
        wallNormal: createSurfaceTexture(dungeonType, 'wall', 'normal', sampleCache, surfaceQuality),
        wallRoughness: createSurfaceTexture(dungeonType, 'wall', 'roughness', sampleCache, surfaceQuality)
    });
    sampleCache.clear();
    const materials = new Map();
    const geometries = new Map();
    const shapes = createShapes();
    const detailMaterials = createMaterialSet(dungeonType);

    const surfaceMaterial = (surface, width, height, transparent = false) => {
        // Keep masonry legible at gameplay zoom without adding geometry.
        // Walls retain their established scale; every map uses matching UVs.
        const repeatWorldSize = surface === 'floor' ? DUNGEON_FLOOR_TEXTURE_SPAN : 12;
        const repeatX = Math.max(1, Math.round(Math.abs(width) / repeatWorldSize));
        const repeatY = Math.max(1, Math.round(Math.abs(height) / repeatWorldSize));
        const key = `${surface}:${repeatX}:${repeatY}:${transparent ? 'ghost' : 'solid'}`;
        if (materials.has(key)) return materials.get(key);
        const map = baseTextures[surface].clone();
        const emissiveMap = baseTextures[`${surface}Emissive`].clone();
        const normalMap = baseTextures[`${surface}Normal`].clone();
        const roughnessMap = baseTextures[`${surface}Roughness`].clone();
        for (const texture of [map, emissiveMap, normalMap, roughnessMap]) {
            texture.repeat.set(repeatX, repeatY);
            texture.needsUpdate = true;
        }
        const material = configureDungeonMaterial(new THREE.MeshStandardMaterial({
            map,
            emissiveMap,
            normalMap,
            normalScale: new THREE.Vector2(surface === 'floor' ? 0.5 : 0.8, surface === 'floor' ? 0.5 : 0.8),
            roughnessMap,
            emissive: theme.palette.accent,
            emissiveIntensity: surface === 'floor' ? 0.2 : 0.16,
            roughness: surface === 'floor' ? 0.92 : 0.96,
            metalness: dungeonType === 'molten_core' || dungeonType === 'tempest_spire' ? 0.12 : 0.03
        }), transparent);
        material.userData.proceduralDungeonSurface = true;
        material.userData.dungeonType = dungeonType;
        material.userData.surface = surface;
        materials.set(key, material);
        return material;
    };

    const geometry = (kind, width, height = 0, depth = 0) => {
        const key = `${kind}:${width}:${height}:${depth}`;
        if (!geometries.has(key)) {
            const value = kind === 'floor' ? new THREE.PlaneGeometry(width, height)
                : kind === 'wall' && dungeonType === 'verdant_bastion_catacombs'
                    ? createCryptWallGeometry(width, height, depth)
                    : kind === 'wall' ? createElementalDungeonWallGeometry(dungeonType, width, height, depth, surfaceQuality)
                        : new THREE.BoxGeometry(width, height, depth);
            value.computeBoundingBox();
            value.computeBoundingSphere();
            geometries.set(key, value);
        }
        return geometries.get(key);
    };

    return Object.freeze({
        dungeonType,
        surfaceQuality,
        definition,
        floorGeometry: (width, depth) => geometry('floor', width, depth),
        // Keep foreground cutaways simple: overlapping translucent courses
        // would darken the hero through multiple blended layers.
        wallGeometry: (width, height, depth, cutaway = false) => geometry(cutaway ? 'wall-cutaway' : 'wall', width, height, depth),
        floorMaterial: (width, depth) => surfaceMaterial('floor', width, depth, false),
        wallMaterial: (width, height, transparent = false) => surfaceMaterial('wall', width, height, transparent),
        createRoomDressing(room, roomIndex, { optimized = true } = {}) {
            const source = buildRoomDressing(dungeonType, room, roomIndex, shapes, detailMaterials);
            const result = optimized ? batchDressing(source) : source;
            result.add(createDungeonRoomStatePresentation(dungeonType, room, roomIndex, { worldSpace: optimized }));
            return result;
        },
        metrics() {
            return Object.freeze({
                surfaceTextures: Object.keys(baseTextures).length,
                surfaceMaterials: materials.size,
                surfaceGeometries: geometries.size,
                detailGeometries: Object.keys(shapes).length,
                detailMaterials: Object.keys(detailMaterials).length
            });
        }
    });
}

export function createProceduralDungeonRoomPreview(dungeonType, room, roomIndex = 0) {
    const kit = createProceduralDungeonInteriorKit(dungeonType);
    return kit.createRoomDressing(room, roomIndex, { optimized: false });
}
