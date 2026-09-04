import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getRegionTheme } from './darkFantasyTheme.js';
import { getDungeonRoomIdentityTag } from '../utils/dungeonRoomMetadata.js';

const TEXTURE_SIZE = 64;

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
    const color = new THREE.Color(hex);
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
    const { shadow, ground, midtone, accent } = palette;
    const wall = surface === 'wall';
    let color = mixBytes(shadow, wall ? midtone : ground, wall ? 0.48 : 0.72);
    let emissive = 0;

    if (dungeonType === 'verdant_bastion_catacombs') {
        const blockX = (x + (Math.floor(y / 8) % 2) * 4) % 16;
        const mortar = blockX < 1 || y % 8 < 1;
        const root = Math.abs(x - (30 + Math.sin(y * 0.22) * 13)) < (wall ? 1.8 : 1.25);
        const moss = ((x * 7 + y * 11) % 29) < (wall ? 4 : 7);
        if (mortar) color = mixBytes(color, shadow, 0.58);
        if (moss) color = mixBytes(color, accent, 0.2);
        if (root) {
            color = mixBytes(color, accent, wall ? 0.34 : 0.27);
            emissive = wall ? 0.2 : 0.12;
        }
    } else if (dungeonType === 'molten_core') {
        const plateX = (x + (Math.floor(y / 14) % 2) * 6) % 20;
        const plate = plateX < 1 || y % 14 < 1;
        const faultA = Math.abs(x - (30 + Math.sin(y * 0.17) * 11)) < 1.1;
        const faultB = y > 18 && y < 38 && Math.abs(x - (35 + ((y - 28) * 0.72))) < 0.9;
        if (plate) color = mixBytes(color, shadow, 0.72);
        if (faultA || faultB) {
            const brokenFault = ((x * 11 + y * 7) % 23) < 14;
            color = mixBytes(color, accent, brokenFault ? 0.48 : 0.18);
            emissive = brokenFault ? (wall ? 0.34 : 0.46) : 0.06;
        } else if (((x * 13 + y * 17) % 47) < 4) {
            color = mixBytes(color, midtone, 0.28);
        }
    } else if (dungeonType === 'tempest_spire') {
        const offset = (Math.floor(y / 12) % 2) * 5;
        const slate = (x + offset) % 20 < 1 || y % 12 < 1;
        const conductor = Math.abs(((x - y + 128) % 37) - 18) < 0.9;
        const node = ((x - 6) % 24 < 2) && ((y - 6) % 24 < 2);
        if (slate) color = mixBytes(color, shadow, 0.62);
        if (conductor || node) {
            color = mixBytes(color, node ? accent : midtone, node ? 0.62 : 0.38);
            emissive = node ? 0.54 : 0.16;
        }
    } else if (dungeonType === 'abyssal_well') {
        const blockX = (x + (Math.floor(y / 9) % 2) * 6) % 18;
        const joint = blockX < 1 || y % 9 < 1;
        const tide = Math.abs(y - (32 + Math.sin(x * 0.24) * (wall ? 10 : 7))) < 1.25;
        const pearl = ((x * 5 + y * 13) % 53) < 2;
        if (joint) color = mixBytes(color, shadow, 0.7);
        if (tide || pearl) {
            color = mixBytes(color, accent, tide ? 0.42 : 0.3);
            emissive = tide ? 0.28 : 0.2;
        }
    } else {
        const fracture = Math.abs(x - (31 + Math.sin(y * 0.31) * 15)) < 1.2;
        const constellation = ((x * 17 + y * 23) % 61) < 2;
        const memoryTile = (x + (Math.floor(y / 10) % 2) * 5) % 19 < 1 || y % 10 < 1;
        if (memoryTile) color = mixBytes(color, shadow, 0.72);
        if (fracture || constellation) {
            color = mixBytes(color, fracture ? accent : midtone, fracture ? 0.56 : 0.38);
            emissive = fracture ? 0.42 : 0.24;
        }
    }

    return { color, emissive };
}

function createSurfaceTexture(dungeonType, surface, emissiveOnly = false) {
    const theme = getRegionTheme(dungeonType);
    const palette = Object.freeze({
        shadow: colorBytes(theme.palette.shadow),
        ground: colorBytes(theme.palette.ground),
        midtone: colorBytes(theme.palette.midtone),
        accent: colorBytes(theme.palette.accent)
    });
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
    for (let y = 0; y < TEXTURE_SIZE; y += 1) {
        for (let x = 0; x < TEXTURE_SIZE; x += 1) {
            const sample = surfaceSample(dungeonType, surface, x, y, palette);
            const offset = ((y * TEXTURE_SIZE) + x) * 4;
            if (emissiveOnly) {
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

    const texture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
    texture.name = `procedural-dungeon-${dungeonType}-${surface}${emissiveOnly ? '-emissive' : ''}`;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = true;
    if (!emissiveOnly) texture.colorSpace = THREE.SRGBColorSpace;
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
        torus: new THREE.TorusGeometry(0.5, 0.075, 6, 24),
        ring: new THREE.RingGeometry(0.34, 0.5, 24),
        octahedron: new THREE.OctahedronGeometry(0.5, 0)
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
    addPart(root, `${name}:base`, shapes.cylinder8, materials.shadow, {
        position: [x, 0.24, z], scale: [2.4, 0.48, 2.4]
    });
    addPart(root, `${name}:shaft`, shapes.cylinder6, materials.metal, {
        position: [x, height / 2, z], scale: [0.72, height, 0.72]
    });
    addPart(root, `${name}:light`, shapes.octahedron, materials.accent, {
        position: [x, height + 0.55, z], scale: [1.1, 1.55, 1.1], castShadow: false
    });
}

function addFloorRing(root, shapes, material, name, radius, y = 0.14) {
    return addPart(root, name, shapes.ring, material, {
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

    const objectiveMaterial = makeRoomStateMaterial(theme.palette.accent, 0.74);
    const currentMaterial = makeRoomStateMaterial(theme.palette.spirit, 0.38);
    const clearedMaterial = makeRoomStateMaterial(0xa8ffd0, 0.46);
    const sealMaterial = makeRoomStateMaterial(theme.palette.accent, 0.82);
    const portalMaterial = makeRoomStateMaterial(theme.palette.spirit, 0.18);

    const objectiveHalo = addRoomStateMesh(
        root,
        'DungeonObjectiveHalo',
        new THREE.RingGeometry(radius * 0.78, radius * 0.9, 48),
        objectiveMaterial,
        { position: [0, 0.24, 0], rotation: [-Math.PI / 2, 0, 0] }
    );
    const currentHalo = addRoomStateMesh(
        root,
        'DungeonCurrentRoomHalo',
        new THREE.RingGeometry(radius * 0.48, radius * 0.55, 32),
        currentMaterial,
        { position: [0, 0.23, 0], rotation: [-Math.PI / 2, 0, 0] }
    );
    const clearedSigil = addRoomStateMesh(
        root,
        'DungeonClearedSigil',
        new THREE.RingGeometry(radius * 0.22, radius * 0.31, 8),
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
            new THREE.ConeGeometry(radius * 0.08, radius * 0.34, 3),
            sealMaterial.clone(),
            {
                position: [Math.cos(angle) * radius * 0.68, 0, Math.sin(angle) * radius * 0.68],
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

    if (objectiveHalo?.visible) objectiveHalo.material.opacity = 0.58 + (pulse * 0.28);
    if (currentHalo?.visible) currentHalo.material.opacity = 0.25 + (pulse * 0.22);
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
            const rootBeam = addPart(root, `verdant:grave-root:${side}`, shapes.cylinder6, materials.shadow, {
                position: [side * radius * 0.56, 1.2, radius * 0.58],
                scale: [0.7, radius * 0.72, 0.7]
            });
            rootBeam.rotation.z = side * 0.95;
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

    addFloorRing(root, shapes, materials.shadow, `${identity}:outer-ward`, radius);
    addFloorRing(root, shapes, materials.accent, `${identity}:inner-ward`, radius * 0.67, 0.16);
    buildRegionalMotif(root, dungeonType, shapes, materials, radius);

    switch (identity) {
    case 'entry_gate':
        addPylon(root, shapes, materials, 'entry:left-vigil', -radius * 0.62, -radius * 0.42, 5.8);
        addPylon(root, shapes, materials, 'entry:right-vigil', radius * 0.62, -radius * 0.42, 5.8);
        addPart(root, 'entry:oath-threshold', shapes.box, materials.metal, {
            position: [0, 0.2, -radius * 0.42], scale: [radius * 0.85, 0.4, 1.1]
        });
        break;
    case 'treasure_cache':
        addPart(root, 'cache:reliquary-plinth', shapes.cylinder8, materials.metal, {
            position: [0, 0.45, radius * 0.2], scale: [4.8, 0.9, 4.8]
        });
        addPart(root, 'cache:sealed-coffer', shapes.box, materials.shadow, {
            position: [0, 1.45, radius * 0.2], scale: [4.8, 1.6, 3.1]
        });
        addPart(root, 'cache:warded-lock', shapes.octahedron, materials.accent, {
            position: [0, 1.5, radius * 0.2 + 1.62], scale: [0.72, 0.9, 0.48], castShadow: false
        });
        break;
    case 'restorative_shrine':
        addPart(root, 'shrine:basin', shapes.torus, materials.stone, {
            position: [0, 0.85, radius * 0.12], rotation: [-Math.PI / 2, 0, 0], scale: [5.8, 5.8, 3.2]
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
        addFloorRing(root, shapes, materials.spirit, 'boss:soul-circuit', radius * 0.42, 0.35);
        for (let i = 0; i < 6; i += 1) {
            const angle = (i / 6) * Math.PI * 2;
            addPylon(root, shapes, materials, `boss:vigil:${i}`, Math.cos(angle) * radius, Math.sin(angle) * radius, 5.2);
        }
        break;
    case 'route_hall':
    default:
        for (const side of [-1, 1]) {
            addPart(root, `route:waystone:${side}`, shapes.cylinder6, materials.stone, {
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

export function createProceduralDungeonInteriorKit(dungeonType) {
    const definition = DUNGEON_INTERIOR_DEFINITIONS[dungeonType];
    if (!definition) throw new Error(`Unknown procedural dungeon interior: ${dungeonType}`);

    const theme = getRegionTheme(dungeonType);
    const baseTextures = Object.freeze({
        floor: createSurfaceTexture(dungeonType, 'floor'),
        floorEmissive: createSurfaceTexture(dungeonType, 'floor', true),
        wall: createSurfaceTexture(dungeonType, 'wall'),
        wallEmissive: createSurfaceTexture(dungeonType, 'wall', true)
    });
    const materials = new Map();
    const geometries = new Map();
    const shapes = createShapes();
    const detailMaterials = createMaterialSet(dungeonType);

    const surfaceMaterial = (surface, width, height, transparent = false) => {
        const repeatX = Math.max(1, Math.round(Math.abs(width) / 12));
        const repeatY = Math.max(1, Math.round(Math.abs(height) / 12));
        const key = `${surface}:${repeatX}:${repeatY}:${transparent ? 'ghost' : 'solid'}`;
        if (materials.has(key)) return materials.get(key);
        const map = baseTextures[surface].clone();
        const emissiveMap = baseTextures[`${surface}Emissive`].clone();
        map.repeat.set(repeatX, repeatY);
        emissiveMap.repeat.set(repeatX, repeatY);
        map.needsUpdate = true;
        emissiveMap.needsUpdate = true;
        const material = configureDungeonMaterial(new THREE.MeshStandardMaterial({
            map,
            emissiveMap,
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
            const value = kind === 'floor'
                ? new THREE.PlaneGeometry(width, height)
                : new THREE.BoxGeometry(width, height, depth);
            value.computeBoundingBox();
            value.computeBoundingSphere();
            geometries.set(key, value);
        }
        return geometries.get(key);
    };

    return Object.freeze({
        dungeonType,
        definition,
        floorGeometry: (width, depth) => geometry('floor', width, depth),
        wallGeometry: (width, height, depth) => geometry('wall', width, height, depth),
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
