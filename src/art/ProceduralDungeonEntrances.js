import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getRegionTheme } from './darkFantasyTheme.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { createDungeonVeilMaterial } from './DungeonVeilMaterial.js';
import { createBastionForegateGeometry } from './BastionForegateGeometry.js';
import { createBastionFoundation, createBastionGatehouse, createBastionTowerParapet, createBastionRecess } from './BastionArchitectureGeometry.js';
import { createTaperedRoot } from './EarthLandmarkGeometry.js';
import { DUNGEON_ENTRANCE_DEFINITIONS, DUNGEON_ENTRANCE_IDS } from '../data/dungeonEntrances.js';

const GEOMETRIES = new Map();
const MATERIALS = new Map();
const OPTIMIZED_PARTS = new Map();
const UP = new THREE.Vector3(0, 1, 0);

export { DUNGEON_ENTRANCE_DEFINITIONS, DUNGEON_ENTRANCE_IDS } from '../data/dungeonEntrances.js';

function geometry(key, create) {
    if (!GEOMETRIES.has(key)) {
        const value = create();
        value.computeBoundingBox();
        value.computeBoundingSphere();
        GEOMETRIES.set(key, value);
    }
    return GEOMETRIES.get(key);
}

function material(key, color, options = {}) {
    if (!MATERIALS.has(key)) {
        MATERIALS.set(key, new THREE.MeshStandardMaterial({
            color,
            roughness: options.roughness ?? 0.9,
            metalness: options.metalness ?? 0,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            transparent: options.transparent ?? false,
            opacity: options.opacity ?? 1,
            depthWrite: options.depthWrite ?? true,
            colorWrite: options.colorWrite ?? true,
            side: options.side ?? THREE.FrontSide,
            flatShading: true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            shadowSide: THREE.FrontSide
        }));
        if (options.surface) applyWorldSurfaceDetail(MATERIALS.get(key), options.surface);
    }
    return MATERIALS.get(key);
}

const SHAPES = Object.freeze({
    box: geometry('dungeon-entrance-unit-box', () => new THREE.BoxGeometry(1, 1, 1)),
    cylinder6: geometry('dungeon-entrance-unit-cylinder-6', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6)),
    cylinder8: geometry('dungeon-entrance-unit-cylinder-8', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8)),
    tapered6: geometry('dungeon-entrance-unit-tapered-6', () => new THREE.CylinderGeometry(0.32, 0.5, 1, 6)),
    cone4: geometry('dungeon-entrance-unit-cone-4', () => new THREE.ConeGeometry(0.5, 1, 4)),
    cone6: geometry('dungeon-entrance-unit-cone-6', () => new THREE.ConeGeometry(0.5, 1, 6)),
    octahedron: geometry('dungeon-entrance-unit-octahedron', () => new THREE.OctahedronGeometry(0.5, 0)),
    dodecahedron: geometry('dungeon-entrance-unit-dodecahedron', () => new THREE.DodecahedronGeometry(0.5, 0)),
    torus: geometry('dungeon-entrance-unit-torus', () => new THREE.TorusGeometry(0.5, 0.065, 6, 24)),
    ring: geometry('dungeon-entrance-unit-ring', () => new THREE.RingGeometry(0.29, 0.5, 24)),
    disc: geometry('dungeon-entrance-unit-disc', () => new THREE.CircleGeometry(0.5, 24)),
    bastionForegate: geometry('dungeon-entrance-bastion-foregate', createBastionForegateGeometry),
    bastionFoundation: geometry('dungeon-entrance-bastion-foundation', createBastionFoundation),
    bastionHall: geometry('dungeon-entrance-bastion-hall', createBastionGatehouse),
    bastionParapet: geometry('dungeon-entrance-bastion-parapet', createBastionTowerParapet),
    bastionRecess: geometry('dungeon-entrance-bastion-recess', createBastionRecess)
});

function regionMaterials(region) {
    const theme = getRegionTheme(region);
    const prefix = `dungeon-entrance:${region}`;
    const definitions = {
        verdant_bastion_catacombs: {
            dark: 0x111611,
            stone: 0x454b3e,
            pale: 0x686759,
            metal: 0x665a38,
            accent: theme.palette.accent,
            spirit: theme.palette.spirit
        },
        molten_core: {
            dark: 0x120907,
            stone: 0x2d1916,
            pale: 0x603023,
            metal: 0x4a3932,
            accent: theme.palette.accent,
            spirit: theme.palette.spirit
        },
        tempest_spire: {
            dark: 0x111522,
            stone: 0x30394d,
            pale: 0x71809b,
            metal: 0x8996aa,
            accent: theme.palette.accent,
            spirit: theme.palette.spirit
        },
        abyssal_well: {
            dark: 0x07131b,
            stone: 0x173440,
            pale: 0x367084,
            metal: 0x416d72,
            accent: theme.palette.accent,
            spirit: theme.palette.spirit
        }
    }[region];

    const veilKey = `${prefix}:veil`;
    if (!MATERIALS.has(veilKey)) MATERIALS.set(veilKey, createDungeonVeilMaterial(definitions.accent));
    return Object.freeze({
        veil: MATERIALS.get(veilKey),
        ...(region === 'verdant_bastion_catacombs' ? {
            root: material(`${prefix}:root`, 0x363b2b, { roughness: .98, surface: 'bark' })
        } : {}),
        dark: material(`${prefix}:dark`, definitions.dark, { roughness: 0.98 }),
        stone: material(`${prefix}:stone`, definitions.stone, { roughness: 0.94,
            surface: region === 'verdant_bastion_catacombs' ? 'fortress' : region === 'molten_core' ? 'fieldstone' : region === 'tempest_spire' ? 'slate' : 'stone' }),
        pale: material(`${prefix}:pale`, definitions.pale, { roughness: 0.88, surface: 'fieldstone' }),
        metal: material(`${prefix}:metal`, definitions.metal, { roughness: 0.48, metalness: 0.62 }),
        accent: material(`${prefix}:accent`, definitions.accent, {
            roughness: 0.35,
            emissive: definitions.accent,
            emissiveIntensity: 1.05
        }),
        spirit: material(`${prefix}:spirit`, definitions.spirit, {
            roughness: 0.24,
            emissive: definitions.spirit,
            emissiveIntensity: 1.35,
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    });
}

const MATERIAL_SETS = Object.freeze(Object.fromEntries(
    DUNGEON_ENTRANCE_IDS.map((id) => [id, regionMaterials(id)])
));
const GAMEPLAY_BOUNDS_MATERIAL = material('dungeon-entrance:gameplay-bounds', 0x000000, {
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false
});

function addMesh(parent, name, geometryValue, materialValue, {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = true,
    receiveShadow = true,
    gameplayBounds = false,
    portal = false
} = {}) {
    const mesh = new THREE.Mesh(geometryValue, materialValue);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.proceduralDungeonEntrancePart = !gameplayBounds;
    mesh.userData.gameplayBounds = gameplayBounds;
    mesh.userData.portalSurface = portal;
    if (materialValue.userData.dungeonVeilTime) {
        // Keep the original uniform alive even when SceneryVisibility swaps
        // in a cutaway clone: its compile hook shares this same uniform.
        mesh.onBeforeRender = () => {
            materialValue.userData.dungeonVeilTime.value = performance.now() / 1000;
        };
    }
    parent.add(mesh);
    return mesh;
}

function box(parent, name, materialValue, scale, position, rotation = [0, 0, 0]) {
    return addMesh(parent, name, SHAPES.box, materialValue, { scale, position, rotation });
}

function beam(parent, name, materialValue, start, end, radius = 0.5, shape = SHAPES.cylinder6) {
    const startPoint = new THREE.Vector3(...start);
    const endPoint = new THREE.Vector3(...end);
    const direction = endPoint.clone().sub(startPoint);
    const length = direction.length();
    const mesh = addMesh(parent, name, shape, materialValue, {
        position: startPoint.add(endPoint).multiplyScalar(0.5).toArray(),
        scale: [radius * 2, length, radius * 2]
    });
    mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
    return mesh;
}

function portal(parent, prefix, materials, position, scale) {
    addMesh(parent, `${prefix}:threshold-void`, SHAPES.disc, materials.dark, {
        position,
        scale,
        castShadow: false,
        receiveShadow: false,
        portal: true
    });
    addMesh(parent, `${prefix}:eidolic-veil`, SHAPES.disc, materials.veil, {
        position: [position[0], position[1], position[2] + 0.09],
        scale: [scale[0] * 0.94, scale[1] * 0.94, scale[2]],
        castShadow: false,
        receiveShadow: false,
        portal: true
    });
    addMesh(parent, `${prefix}:ward-ring`, SHAPES.torus, materials.metal, {
        position: [position[0], position[1], position[2] + 0.16],
        scale: [scale[0] * 1.08, scale[1] * 1.08, Math.max(1.2, scale[2])],
        castShadow: false,
        receiveShadow: false,
        portal: true
    });
}

function spike(parent, name, materialValue, position, scale, rotation = [0, 0, 0]) {
    return addMesh(parent, name, SHAPES.cone4, materialValue, { position, scale, rotation });
}

function createVerdantBastion(root) {
    const m = MATERIAL_SETS.verdant_bastion_catacombs;
    addMesh(root, 'verdant:buried-fortress-plinth', SHAPES.bastionFoundation, m.stone);
    box(root, 'verdant:mossed-ramp', m.pale, [22, 2, 23], [0, 2.7, 22], [-0.06, 0, 0]);
    addMesh(root, 'verdant:gatehouse', SHAPES.bastionHall, m.stone);
    addMesh(root, 'verdant:recessed-hall-door', SHAPES.bastionRecess, m.dark, {
        position: [0, 3, 7.07], castShadow: false
    });
    for (let i = 0; i < 11; i++) {
        if (i === 3 || i === 8) continue;
        const height = 1.6 + (i * 7 % 5) * .5;
        box(root, `verdant:broken-wall-crown:${i}`, m.pale, [3.6, height, 2.8],
            [-19 + i * 3.8, 27 + height / 2, 5.5], [0, 0, (i % 3 - 1) * .018]);
    }
    const livingRoot = (name, points, radius) => addMesh(root, name,
        geometry(name, () => createTaperedRoot(points, radius, 'low')), m.root);
    for (const side of [-1, 1]) {
        addMesh(root, `verdant:tower:${side}`, SHAPES.cylinder8, m.stone, {
            position: [side * 25, 17, -7],
            scale: [17, 34, 17]
        });
        addMesh(root, `verdant:tower-crown:${side}`, SHAPES.bastionParapet, m.pale, {
            position: [side * 25, 34, -7], rotation: [0, side * .45, 0]
        });
        addMesh(root, `verdant:tower-belt:${side}`, SHAPES.cylinder8, m.pale, {
            position: [side * 25, 28, -7], scale: [17.6, 1.2, 17.6]
        });
        for (const x of [10, 17]) {
            box(root, `verdant:wall-pilaster:${side}:${x}`, m.pale, [1.4, 22, 1.7], [side * x, 14, 7.5]);
        }
        for (const offset of [-4, 0, 4]) {
            spike(root, `verdant:briar-merlon:${side}:${offset}`, m.metal,
                [side * 25 + offset, 37.8 + Math.abs(offset) * 0.35, 1],
                [2.4, 7 + Math.abs(offset), 2.4],
                [0, 0, side * offset * -0.025]);
        }
        livingRoot(`verdant:root-buttress-front:${side}`,
            [[side * 21, 18, 1], [side * 23, 7, 9], [side * 29, 3, 20], [side * 34, 1, 30]], 1.8);
        livingRoot(`verdant:root-buttress-rear:${side}`,
            [[side * 21, 12, -12], [side * 25, 5, -18], [side * 30, 2, -25], [side * 33, .8, -30]], 1.55);
        livingRoot(`verdant:antler-trunk:${side}`,
            [[side * 7, 23, -2], [side * 9, 37, -4], [side * 13, 49, -5], [side * 16, 57, -9]], 1.45);
        livingRoot(`verdant:antler-branch:${side}`,
            [[side * 11, 43, -4], [side * 16, 48, -6], [side * 22, 53, -10], [side * 28, 54, -15]], .9);
        livingRoot(`verdant:antler-tine:${side}`,
            [[side * 18, 49, -8], [side * 20, 57, -11], [side * 19, 59, -14]], .55);
    }
    // The physical entry circle stops players at the ramp's outer end. Place
    // the visible threshold there, not 25m behind that boundary in the wall.
    addMesh(root, 'verdant:carved-foregate', SHAPES.bastionForegate, m.pale);
    portal(root, 'verdant:witch-gate', m, [0, 12, 32.1], [12.5, 18, 2.2]);
    addMesh(root, 'verdant:funerary-sun', SHAPES.ring, m.metal, {
        position: [0, 34, 7.4],
        scale: [8.5, 8.5, 2]
    });
    spike(root, 'verdant:keystone-thorn', m.accent, [0, 34, 7.65], [3, 6, 2.2], [0, 0, Math.PI]);
    for (const side of [-1, 1]) {
        addMesh(root, `verdant:tower-window:${side}`, SHAPES.bastionRecess, m.dark, {
            position: [side * 25, 14.5, 1.6], scale: [.38, .45, 1], castShadow: false
        });
        box(root, `verdant:witchlight-slit:${side}`, m.accent, [.65, 4, .15], [side * 25, 20, 1.72]);
    }
}

function createMoltenCore(root) {
    const m = MATERIAL_SETS.molten_core;
    box(root, 'molten:obsidian-foundation', m.dark, [72, 3.5, 70], [0, 1.75, 0]);
    box(root, 'molten:kiln-vault', m.stone, [47, 29, 31], [0, 17.5, -6]);
    box(root, 'molten:kiln-brow', m.metal, [52, 5, 34], [0, 32, -6]);
    for (const side of [-1, 1]) {
        addMesh(root, `molten:crucible-pylon:${side}`, SHAPES.tapered6, m.stone, {
            position: [side * 27, 21, -7],
            scale: [18, 42, 18]
        });
        spike(root, `molten:horn:${side}`, m.dark,
            [side * 25, 51, -5], [13, 28, 13], [0, 0, side * -0.38]);
        beam(root, `molten:furnace-rib:${side}`, m.metal,
            [side * 12, 31, 9], [side * 26, 49, 0], 1.5, SHAPES.cylinder8);
        beam(root, `molten:great-chain-upper:${side}`, m.metal,
            [side * 25, 43, 5], [side * 10, 34, 11], 0.65, SHAPES.cylinder8);
        beam(root, `molten:great-chain-lower:${side}`, m.metal,
            [side * 10, 34, 11], [side * 15, 21, 14], 0.65, SHAPES.cylinder8);
        for (const z of [3, 12, 21, 30]) {
            box(root, `molten:lava-channel:${side}:${z}`, m.accent, [3.2, 0.35, 7], [side * 7.5, 3.7, z]);
        }
        spike(root, `molten:basalt-fang:${side}`, m.pale,
            [side * 18, 12, 12], [5, 17, 5], [Math.PI, 0, side * 0.1]);
    }
    portal(root, 'molten:furnace-mouth', m, [0, 15.5, 9.65], [13.5, 19.5, 2.4]);
    addMesh(root, 'molten:crucible-halo', SHAPES.torus, m.metal, {
        position: [0, 38.5, 11.3],
        scale: [12, 12, 2.5]
    });
    spike(root, 'molten:kiln-crown', m.spirit, [0, 45.5, 11.5], [5, 10, 3], [0, 0, Math.PI]);
    box(root, 'molten:threshold-rift', m.spirit, [11, 0.3, 25], [0, 3.8, 24]);
}

function createTempestSpire(root) {
    const m = MATERIAL_SETS.tempest_spire;
    box(root, 'tempest:storm-shelf', m.dark, [41, 3, 44], [0, 1.5, 0]);
    addMesh(root, 'tempest:central-needle', SHAPES.tapered6, m.stone, {
        position: [0, 35, -5],
        scale: [19, 64, 19]
    });
    for (const side of [-1, 1]) {
        addMesh(root, `tempest:split-spire:${side}`, SHAPES.tapered6, m.pale, {
            position: [side * 11, 27, -3],
            rotation: [0, 0, side * -0.12],
            scale: [8, 49, 8]
        });
        spike(root, `tempest:sky-prong:${side}`, m.metal,
            [side * 14, 59, -3], [6, 25, 6], [0, 0, side * -0.2]);
        for (const [index, [x, y, z, scale]] of [
            [side * 17, 12, 14, 5],
            [side * 18, 25, -17, 4],
            [side * 15, 43, 13, 3.5]
        ].entries()) {
            addMesh(root, `tempest:floating-slate:${side}:${index}`, SHAPES.octahedron, m.stone, {
                position: [x, y, z],
                rotation: [0.2 * index, side * 0.3, side * 0.18],
                scale: [scale, scale * 1.35, scale * 0.8]
            });
        }
        beam(root, `tempest:lightning-leg-a:${side}`, m.spirit,
            [0, 55, 3], [side * 9, 48, 8], 0.42, SHAPES.cylinder6);
        beam(root, `tempest:lightning-leg-b:${side}`, m.spirit,
            [side * 9, 48, 8], [side * 15, 40, 10], 0.42, SHAPES.cylinder6);
        beam(root, `tempest:conductor:${side}`, m.metal,
            [side * 7, 20, 8], [side * 16, 4, 19], 0.78, SHAPES.cylinder8);
    }
    portal(root, 'tempest:storm-eye', m, [0, 14, 6.2], [10.5, 16.5, 2]);
    addMesh(root, 'tempest:captive-storm-halo', SHAPES.torus, m.accent, {
        position: [0, 39, 5],
        rotation: [0.18, 0, 0],
        scale: [13, 8, 2]
    });
    spike(root, 'tempest:spire-needle', m.spirit, [0, 69.5, -5], [4, 14, 4]);
    box(root, 'tempest:split-threshold', m.pale, [17, 2.2, 18], [0, 2.8, 15], [-0.07, 0, 0]);
}

function createAbyssalWell(root) {
    const m = MATERIAL_SETS.abyssal_well;
    box(root, 'abyssal:drowned-shelf', m.dark, [72, 3, 48], [0, 1.5, 0]);
    addMesh(root, 'abyssal:black-water-eye', SHAPES.disc, m.spirit, {
        position: [0, 3.1, -4],
        rotation: [-Math.PI / 2, 0, 0],
        scale: [29, 19, 1],
        castShadow: false,
        receiveShadow: false,
        portal: true
    });
    addMesh(root, 'abyssal:well-rim', SHAPES.torus, m.stone, {
        position: [0, 3.4, -4],
        rotation: [Math.PI / 2, 0, 0],
        scale: [32, 22, 6]
    });
    box(root, 'abyssal:reliquary-brow', m.stone, [39, 7, 12], [0, 20, 0]);
    for (const side of [-1, 1]) {
        addMesh(root, `abyssal:tide-pillar:${side}`, SHAPES.tapered6, m.stone, {
            position: [side * 21, 13, -1],
            scale: [13, 26, 13]
        });
        spike(root, `abyssal:shell-crown:${side}`, m.pale,
            [side * 21, 29, -1], [14, 10, 14]);
        beam(root, `abyssal:anchor-tentacle-front:${side}`, m.metal,
            [side * 18, 7, 8], [side * 34, 2, 18], 1.6, SHAPES.tapered6);
        beam(root, `abyssal:anchor-tentacle-rear:${side}`, m.metal,
            [side * 18, 6, -10], [side * 34, 2, -19], 1.45, SHAPES.tapered6);
        for (const [index, xOffset] of [-5, 0, 5].entries()) {
            spike(root, `abyssal:coral-antler:${side}:${index}`, index % 2 ? m.accent : m.pale,
                [side * 24 + xOffset, 11 + index * 2, 9],
                [2.2, 9 + index * 2, 2.2],
                [0, 0, side * (0.18 + index * 0.07)]);
        }
        addMesh(root, `abyssal:moon-pearl:${side}`, SHAPES.dodecahedron, m.spirit, {
            position: [side * 18, 25, 6],
            scale: [3.4, 3.4, 3.4],
            castShadow: false,
            receiveShadow: false
        });
    }
    portal(root, 'abyssal:reliquary-gate', m, [0, 13, 6.1], [12.5, 15.5, 2.2]);
    addMesh(root, 'abyssal:drowned-moon', SHAPES.ring, m.metal, {
        position: [0, 27, 6.2],
        scale: [9, 9, 2]
    });
    spike(root, 'abyssal:keel-keystone', m.accent, [0, 31, 6.4], [3.5, 7, 2], [0, 0, Math.PI]);
}

const BUILDERS = Object.freeze({
    verdant_bastion_catacombs: createVerdantBastion,
    molten_core: createMoltenCore,
    tempest_spire: createTempestSpire,
    abyssal_well: createAbyssalWell
});

function configureRoot(root, definition) {
    root.name = 'DungeonEntrance';
    root.userData.dungeonType = definition.dungeonType;
    root.userData.entranceLabel = definition.label;
    root.userData.artStyle = definition.artStyle;
    root.userData.proceduralDungeonEntrance = true;
    root.userData.gameplayBounds = [...definition.bounds];
    root.userData.interactionRadius = definition.interactionRadius;
    return root;
}

function addGameplayBounds(root, definition) {
    const [width, height, depth] = definition.bounds;
    const bounds = addMesh(root, `${definition.dungeonType}:gameplay-bounds`, SHAPES.box, GAMEPLAY_BOUNDS_MATERIAL, {
        position: [0, height / 2, 0],
        scale: [width, height, depth],
        castShadow: false,
        receiveShadow: false,
        gameplayBounds: true
    });
    bounds.material.visible = false;
    return bounds;
}

function buildArchitecture(root, dungeonType) {
    const architecture = new THREE.Group();
    architecture.name = `${dungeonType}:architecture`;
    // The legacy 61m envelope is a gameplay contract, not a requirement for
    // the visible gate. Its tall crowns engulfed the west approach camera.
    // Scale in parent space so tilted buttresses retain their XZ footprint.
    if (dungeonType === 'verdant_bastion_catacombs') architecture.scale.y = .5;
    root.add(architecture);
    BUILDERS[dungeonType](architecture);
}

function getOptimizedParts(dungeonType) {
    if (OPTIMIZED_PARTS.has(dungeonType)) return OPTIMIZED_PARTS.get(dungeonType);
    const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
    const build = BUILDERS[dungeonType];
    if (!definition || !build) throw new Error(`Unknown procedural dungeon entrance: ${dungeonType}`);

    const source = configureRoot(new THREE.Group(), definition);
    buildArchitecture(source, dungeonType);
    source.updateMatrixWorld(true);
    const buckets = new Map();
    let sourceMeshCount = 0;
    source.traverse((part) => {
        if (!part.isMesh || !part.userData.proceduralDungeonEntrancePart) return;
        sourceMeshCount += 1;
        const key = `${part.material.uuid}:${part.castShadow ? 1 : 0}:${part.receiveShadow ? 1 : 0}`;
        if (!buckets.has(key)) {
            buckets.set(key, {
                material: part.material,
                castShadow: part.castShadow,
                receiveShadow: part.receiveShadow,
                portalSurface: false,
                geometries: []
            });
        }
        const bucket = buckets.get(key);
        bucket.portalSurface ||= Boolean(part.userData.portalSurface);
        const baked = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
        bucket.geometries.push(baked.applyMatrix4(part.matrixWorld));
    });

    const parts = [...buckets.values()].map((bucket, index) => {
        const merged = mergeGeometries(bucket.geometries, false);
        bucket.geometries.forEach((entry) => entry.dispose());
        if (!merged) throw new Error(`Unable to batch procedural dungeon entrance: ${dungeonType}`);
        merged.name = `dungeon-entrance-${dungeonType}-batch-${index}`;
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        return Object.freeze({ ...bucket, geometries: undefined, geometry: merged });
    });
    const result = Object.freeze({ parts: Object.freeze(parts), sourceMeshCount });
    OPTIMIZED_PARTS.set(dungeonType, result);
    return result;
}

export function createProceduralDungeonEntrance(dungeonType, { optimized = true } = {}) {
    const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
    const build = BUILDERS[dungeonType];
    if (!definition || !build) throw new Error(`Unknown procedural dungeon entrance: ${dungeonType}`);

    const root = configureRoot(new THREE.Group(), definition);
    if (optimized) {
        const optimizedParts = getOptimizedParts(dungeonType);
        optimizedParts.parts.forEach((descriptor, index) => {
            addMesh(root, `${dungeonType}:material-batch:${index}`, descriptor.geometry, descriptor.material, {
                castShadow: descriptor.castShadow,
                receiveShadow: descriptor.receiveShadow,
                portal: descriptor.portalSurface
            });
        });
        root.userData.renderBatched = true;
        root.userData.sourceMeshCount = optimizedParts.sourceMeshCount;
        root.userData.drawMeshCount = optimizedParts.parts.length;
    } else {
        buildArchitecture(root, dungeonType);
    }
    addGameplayBounds(root, definition);
    return root;
}

export function getProceduralDungeonEntranceCacheMetrics() {
    return Object.freeze({
        geometries: GEOMETRIES.size,
        materials: MATERIALS.size,
        entrances: DUNGEON_ENTRANCE_IDS.length
    });
}
