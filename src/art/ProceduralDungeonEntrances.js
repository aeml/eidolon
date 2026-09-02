import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getRegionTheme } from './darkFantasyTheme.js';

const GEOMETRIES = new Map();
const MATERIALS = new Map();
const OPTIMIZED_PARTS = new Map();
const UP = new THREE.Vector3(0, 1, 0);

const defineEntrance = ({ dungeonType, label, artStyle, bounds, position }) => Object.freeze({
    dungeonType,
    label,
    artStyle,
    bounds: Object.freeze([...bounds]),
    position: Object.freeze([...position]),
    interactionRadius: Math.min(bounds[0], bounds[2]) * 0.45
});

/**
 * These dimensions are the production-scaled Box3 contracts of the four GLBs
 * retired by this module. An invisible bounds mesh preserves their exact
 * collision radius, interaction reach, grounding, and click target while the
 * visible architecture is free to carry a clearer regional silhouette.
 */
export const DUNGEON_ENTRANCE_DEFINITIONS = Object.freeze({
    verdant_bastion_catacombs: defineEntrance({
        dungeonType: 'verdant_bastion_catacombs',
        label: 'The Verdant Bastion',
        artStyle: 'Thorncrypt root-bound fortress gate with witchlight heart and briar crown',
        bounds: [76.13120079040527, 61.46895885467529, 72.87123918533325],
        position: [800, 0, 200]
    }),
    molten_core: defineEntrance({
        dungeonType: 'molten_core',
        label: 'The Molten Core',
        artStyle: 'Furnace Below obsidian kiln gate with chained horns and molten throat',
        bounds: [76.23759984970093, 71.23167991638184, 75.87180137634277],
        position: [-2400, 0, 200]
    }),
    tempest_spire: defineEntrance({
        dungeonType: 'tempest_spire',
        label: 'The Tempest Spire',
        artStyle: 'Shattered Aerie storm needle with floating slate and captive lightning',
        bounds: [44.4045615196228, 76.54812097549438, 48.13672065734863],
        position: [2400, 0, 200]
    }),
    abyssal_well: defineEntrance({
        dungeonType: 'abyssal_well',
        label: 'The Abyssal Well',
        artStyle: 'Drowned Sanctum tide altar with black-water eye and coral reliquary arch',
        bounds: [76.47827863693237, 37.49948024749756, 52.10767984390259],
        position: [0, 0, -1400]
    })
});

export const DUNGEON_ENTRANCE_IDS = Object.freeze(Object.keys(DUNGEON_ENTRANCE_DEFINITIONS));

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
    disc: geometry('dungeon-entrance-unit-disc', () => new THREE.CircleGeometry(0.5, 24))
});

function regionMaterials(region) {
    const theme = getRegionTheme(region);
    const prefix = `dungeon-entrance:${region}`;
    const definitions = {
        verdant_bastion_catacombs: {
            dark: 0x111611,
            stone: 0x344034,
            pale: 0x62705a,
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

    return Object.freeze({
        dark: material(`${prefix}:dark`, definitions.dark, { roughness: 0.98 }),
        stone: material(`${prefix}:stone`, definitions.stone, { roughness: 0.94 }),
        pale: material(`${prefix}:pale`, definitions.pale, { roughness: 0.88 }),
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
    addMesh(parent, `${prefix}:eidolic-veil`, SHAPES.disc, materials.spirit, {
        position: [position[0], position[1], position[2] + 0.09],
        scale: [scale[0] * 0.82, scale[1] * 0.82, scale[2]],
        castShadow: false,
        receiveShadow: false,
        portal: true
    });
    addMesh(parent, `${prefix}:ward-ring`, SHAPES.torus, materials.accent, {
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
    box(root, 'verdant:buried-fortress-plinth', m.dark, [68, 3, 54], [0, 1.5, -2]);
    box(root, 'verdant:mossed-ramp', m.stone, [24, 2, 23], [0, 2.7, 22], [-0.06, 0, 0]);
    box(root, 'verdant:gatehouse', m.stone, [42, 24, 24], [0, 15, -5]);
    box(root, 'verdant:gatehouse-crown', m.pale, [47, 3, 28], [0, 27, -5]);
    for (const side of [-1, 1]) {
        addMesh(root, `verdant:tower:${side}`, SHAPES.tapered6, m.stone, {
            position: [side * 25, 17, -7],
            scale: [17, 34, 17]
        });
        addMesh(root, `verdant:tower-crown:${side}`, SHAPES.cone6, m.dark, {
            position: [side * 25, 38, -7],
            scale: [19, 13, 19]
        });
        for (const offset of [-4, 0, 4]) {
            spike(root, `verdant:briar-merlon:${side}:${offset}`, m.metal,
                [side * 25 + offset, 37.8 + Math.abs(offset) * 0.35, 1],
                [2.4, 7 + Math.abs(offset), 2.4],
                [0, 0, side * offset * -0.025]);
        }
        beam(root, `verdant:root-buttress-front:${side}`, m.dark,
            [side * 18, 4.7, 12], [side * 34, 3.2, 30], 1.8, SHAPES.tapered6);
        beam(root, `verdant:root-buttress-rear:${side}`, m.dark,
            [side * 20, 5.7, -16], [side * 33, 2.9, -30], 1.55, SHAPES.tapered6);
        beam(root, `verdant:antler-trunk:${side}`, m.dark,
            [side * 7, 27, -3], [side * 13, 51, -5], 1.2, SHAPES.tapered6);
        beam(root, `verdant:antler-branch:${side}`, m.dark,
            [side * 11, 42, -4], [side * 23, 55, -7], 0.8, SHAPES.tapered6);
        beam(root, `verdant:antler-tine:${side}`, m.dark,
            [side * 17, 49, -6], [side * 19, 59, -6], 0.55, SHAPES.tapered6);
    }
    portal(root, 'verdant:witch-gate', m, [0, 14, 7.18], [12.5, 18, 2.2]);
    addMesh(root, 'verdant:funerary-sun', SHAPES.ring, m.metal, {
        position: [0, 34, 7.4],
        scale: [8.5, 8.5, 2]
    });
    spike(root, 'verdant:keystone-thorn', m.accent, [0, 34, 7.65], [3, 6, 2.2], [0, 0, Math.PI]);
    for (const side of [-1, 1]) {
        box(root, `verdant:witchlight-slit:${side}`, m.accent, [2.3, 10, 0.35], [side * 25, 22, 1.55]);
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

function getOptimizedParts(dungeonType) {
    if (OPTIMIZED_PARTS.has(dungeonType)) return OPTIMIZED_PARTS.get(dungeonType);
    const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
    const build = BUILDERS[dungeonType];
    if (!definition || !build) throw new Error(`Unknown procedural dungeon entrance: ${dungeonType}`);

    const source = configureRoot(new THREE.Group(), definition);
    build(source);
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
        build(root);
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
