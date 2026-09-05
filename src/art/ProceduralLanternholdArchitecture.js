import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getRegionTheme } from './darkFantasyTheme.js';

const GEOMETRIES = new Map();
const MATERIALS = new Map();
const OPTIMIZED_STRUCTURE_PARTS = new Map();

const definition = (id, label, artStyle, role, bounds) => Object.freeze({
    id,
    label,
    artStyle,
    role,
    bounds: Object.freeze([...bounds])
});

/**
 * Retain the retired authored-object bounds for picking and asset compatibility.
 * Walking uses the separate current-wall footprints below where provided;
 * roof overhangs and historical padding must not obstruct the town approaches.
 */
export const LANTERNHOLD_STRUCTURE_DEFINITIONS = Object.freeze({
    oathhall: definition(
        'oathhall',
        'The Oathhall',
        'Lanternhold many-gabled oathhall and bell vigil',
        'town landmark and northern navigation anchor',
        [22.873, 22.149, 22.514]
    ),
    trading_post: definition(
        'trading_post',
        'Votive Market',
        'Lanternhold open votive market beneath a black-oak canopy',
        'eastern vendor landmark',
        [11.485, 7.465, 10.19]
    ),
    blacksmith: definition(
        'blacksmith',
        'Ashen Smithy',
        'Lanternhold charcoal smithy with a horned furnace stack',
        'western forge landmark',
        [14.881, 13.683, 14.976]
    ),
    camp: definition(
        'camp',
        'Pilgrim Vigil',
        'Lanternhold pilgrim tent, oathfire, and grave-road standard',
        'outer-town camp dressing',
        [7.363, 5.031, 7.371]
    ),
    trading_house: definition(
        'trading_house',
        'The Gilded Compact',
        'Lanternhold auction hall with chained scales and amber ledgers',
        'auction-house interactable',
        [14.888, 12, 12.577]
    ),
    forge: definition(
        'forge',
        'Oathfire Forge',
        'Lanternhold ritual forge with a crowned hood and white-hot heart',
        'equipment forge interactable',
        [6.781, 6.679, 7.614]
    ),
    stash: definition(
        'stash',
        'Wayfarer Reliquary',
        'Lanternhold ironbound reliquary chest with a warded lock',
        'player stash interactable',
        [3.807, 2.888, 2.796]
    )
});

export const LANTERNHOLD_STRUCTURE_IDS = Object.freeze(
    Object.keys(LANTERNHOLD_STRUCTURE_DEFINITIONS)
);

// Walk-blocking walls/coffers, independent of roof overhangs, name tags and
// retired-asset picking bounds. The low foundation steps remain approachable.
const WALK_FOOTPRINTS = Object.freeze({
    oathhall: [18.9, 16.3], trading_house: [12.35, 10.01], stash: [3.55, 2.55]
});

export function getLanternholdWalkCollider(mesh) {
    const footprint = WALK_FOOTPRINTS[mesh?.userData?.structureId];
    if (!footprint) return null;
    mesh.updateMatrixWorld(true);
    return {
        box: new THREE.Box3(new THREE.Vector3(-footprint[0] / 2, -2, -footprint[1] / 2), new THREE.Vector3(footprint[0] / 2, 30, footprint[1] / 2)),
        matrix: mesh.matrixWorld.clone(), inverse: mesh.matrixWorld.clone().invert()
    };
}

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
            roughness: options.roughness ?? 0.88,
            metalness: options.metalness ?? 0,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            flatShading: true,
            side: options.side ?? THREE.FrontSide,
            transparent: options.transparent ?? false,
            opacity: options.opacity ?? 1,
            depthWrite: options.depthWrite ?? true,
            colorWrite: options.colorWrite ?? true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            shadowSide: THREE.FrontSide
        }));
    }
    return MATERIALS.get(key);
}

const SHAPES = Object.freeze({
    box: geometry('lanternhold-unit-box', () => new THREE.BoxGeometry(1, 1, 1)),
    cylinder: geometry('lanternhold-unit-cylinder', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8)),
    tapered: geometry('lanternhold-unit-tapered', () => new THREE.CylinderGeometry(0.38, 0.5, 1, 8)),
    cone4: geometry('lanternhold-unit-cone-4', () => new THREE.ConeGeometry(0.5, 1, 4)),
    cone6: geometry('lanternhold-unit-cone-6', () => new THREE.ConeGeometry(0.5, 1, 6)),
    cone8: geometry('lanternhold-unit-cone-8', () => new THREE.ConeGeometry(0.5, 1, 8)),
    octahedron: geometry('lanternhold-unit-octahedron', () => new THREE.OctahedronGeometry(0.5, 0)),
    dodecahedron: geometry('lanternhold-unit-dodecahedron', () => new THREE.DodecahedronGeometry(0.5, 0)),
    torus: geometry('lanternhold-unit-torus', () => new THREE.TorusGeometry(0.5, 0.065, 5, 12)),
    ring: geometry('lanternhold-unit-ring', () => new THREE.RingGeometry(0.38, 0.5, 12))
});

function createMaterials() {
    const palette = getRegionTheme('town').palette;
    return Object.freeze({
        foundation: material('lanternhold-foundation', 0x292824, { roughness: 0.98 }),
        stone: material('lanternhold-stone', 0x555148, { roughness: 0.94 }),
        paleStone: material('lanternhold-pale-stone', 0x777062, { roughness: 0.92 }),
        timber: material('lanternhold-black-oak', 0x241a17, { roughness: 0.96 }),
        roof: material('lanternhold-roof-slate', 0x20232a, { metalness: 0.12, roughness: 0.84 }),
        iron: material('lanternhold-old-iron', 0x34383a, { metalness: 0.7, roughness: 0.42 }),
        brass: material('lanternhold-oath-brass', 0x9d6a32, { metalness: 0.66, roughness: 0.4 }),
        leather: material('lanternhold-road-leather', 0x4c3025, { roughness: 0.92 }),
        cloth: material('lanternhold-blood-cloth', 0x5b2927, { roughness: 0.98, side: THREE.DoubleSide }),
        ashCloth: material('lanternhold-ash-cloth', 0x3b3735, { roughness: 0.98, side: THREE.DoubleSide }),
        amber: material('lanternhold-amber-window', palette.accent, {
            emissive: palette.accent,
            emissiveIntensity: 0.95,
            roughness: 0.38
        }),
        spirit: material('lanternhold-ward-light', palette.spirit, {
            emissive: palette.spirit,
            emissiveIntensity: 1.15,
            roughness: 0.3
        }),
        ember: material('lanternhold-oathfire', 0xff7a2f, {
            emissive: 0xff5a20,
            emissiveIntensity: 1.45,
            roughness: 0.3
        }),
        parchment: material('lanternhold-parchment', 0xb8a374, { roughness: 0.96 }),
        bounds: material('lanternhold-gameplay-bounds', 0x000000, {
            colorWrite: false,
            depthWrite: false,
            transparent: true,
            opacity: 0
        })
    });
}

const MATERIAL_SET = createMaterials();

function addMesh(parent, name, geometryValue, materialValue, {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = true,
    receiveShadow = true,
    gameplayBounds = false
} = {}) {
    const mesh = new THREE.Mesh(geometryValue, materialValue);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.proceduralTownPart = !gameplayBounds;
    mesh.userData.gameplayBounds = gameplayBounds;
    parent.add(mesh);
    return mesh;
}

function box(parent, name, materialValue, scale, position, rotation = [0, 0, 0]) {
    return addMesh(parent, name, SHAPES.box, materialValue, { scale, position, rotation });
}

function addGameplayBounds(root, config) {
    const [width, height, depth] = config.bounds;
    const bounds = addMesh(root, `${config.id}:gameplay-bounds`, SHAPES.box, MATERIAL_SET.bounds, {
        position: [0, height / 2, 0],
        scale: [width, height, depth],
        castShadow: false,
        receiveShadow: false,
        gameplayBounds: true
    });
    // Keep the mesh raycastable just like the invisible hit meshes it replaces;
    // material visibility suppresses drawing without excluding interaction.
    bounds.material.visible = false;
    return bounds;
}

function addFoundation(root, prefix, width, depth, { steps = true } = {}) {
    box(root, `${prefix}:buried-footing`, MATERIAL_SET.foundation, [width, 0.5, depth], [0, 0.25, 0]);
    box(root, `${prefix}:cut-stone-plinth`, MATERIAL_SET.stone, [width - 0.8, 0.55, depth - 0.8], [0, 0.72, 0]);
    if (steps) {
        box(root, `${prefix}:threshold-low`, MATERIAL_SET.paleStone, [3.8, 0.25, 1.5], [0, 0.13, depth / 2 - 0.82]);
        box(root, `${prefix}:threshold-high`, MATERIAL_SET.stone, [3.1, 0.3, 1], [0, 0.4, depth / 2 - 0.6]);
    }
}

function addGabledRoof(root, prefix, width, depth, eaveY, rise, materialValue = MATERIAL_SET.roof) {
    const halfDepth = depth / 2;
    const slopeLength = Math.hypot(halfDepth, rise);
    const angle = Math.atan2(rise, halfDepth);
    box(
        root,
        `${prefix}:roof-south`,
        materialValue,
        [width, 0.48, slopeLength],
        [0, eaveY + rise / 2, halfDepth / 2],
        [angle, 0, 0]
    );
    box(
        root,
        `${prefix}:roof-north`,
        materialValue,
        [width, 0.48, slopeLength],
        [0, eaveY + rise / 2, -halfDepth / 2],
        [-angle, 0, 0]
    );
    box(root, `${prefix}:roof-ridge`, MATERIAL_SET.iron, [width + 0.2, 0.28, 0.35], [0, eaveY + rise, 0]);
}

function addButtress(root, prefix, x, z, height, rotationY = 0) {
    addMesh(root, `${prefix}:buttress`, SHAPES.tapered, MATERIAL_SET.stone, {
        position: [x, height / 2, z],
        rotation: [0, rotationY, 0],
        scale: [1.25, height, 1.25]
    });
    addMesh(root, `${prefix}:buttress-cap`, SHAPES.cone4, MATERIAL_SET.paleStone, {
        position: [x, height + 0.55, z],
        rotation: [0, Math.PI / 4 + rotationY, 0],
        scale: [1.45, 1.1, 1.45]
    });
}

function addWindow(root, prefix, x, y, z, width = 1.1, height = 1.8, rotationY = 0) {
    box(root, `${prefix}:amber-pane`, MATERIAL_SET.amber, [width, height, 0.13], [x, y, z], [0, rotationY, 0]);
    box(root, `${prefix}:iron-mullion-v`, MATERIAL_SET.iron, [0.11, height + 0.22, 0.18], [x, y, z + 0.01], [0, rotationY, 0]);
    box(root, `${prefix}:iron-mullion-h`, MATERIAL_SET.iron, [width + 0.18, 0.11, 0.18], [x, y, z + 0.01], [0, rotationY, 0]);
}

function addLantern(root, prefix, x, y, z, scale = 1) {
    box(root, `${prefix}:lantern-bracket`, MATERIAL_SET.iron, [0.12 * scale, 0.85 * scale, 0.12 * scale], [x, y + 0.35 * scale, z]);
    addMesh(root, `${prefix}:lantern-cage`, SHAPES.tapered, MATERIAL_SET.brass, {
        position: [x, y, z],
        scale: [0.55 * scale, 0.76 * scale, 0.55 * scale]
    });
    addMesh(root, `${prefix}:lantern-flame`, SHAPES.octahedron, MATERIAL_SET.amber, {
        position: [x, y, z],
        scale: [0.38 * scale, 0.62 * scale, 0.38 * scale],
        castShadow: false,
        receiveShadow: false
    });
}

function addDoor(root, prefix, y, z, width = 2.5, height = 3.8) {
    box(root, `${prefix}:black-oak-door`, MATERIAL_SET.timber, [width, height, 0.28], [0, y, z]);
    box(root, `${prefix}:door-spine`, MATERIAL_SET.iron, [0.16, height + 0.25, 0.34], [0, y, z + 0.04]);
    box(root, `${prefix}:door-brace`, MATERIAL_SET.iron, [width + 0.18, 0.17, 0.34], [0, y, z + 0.04]);
    addMesh(root, `${prefix}:oath-lock`, SHAPES.octahedron, MATERIAL_SET.brass, {
        position: [0.48, y, z + 0.22],
        scale: [0.34, 0.45, 0.18]
    });
}

function addTimberFrame(root, prefix, width, wallHeight, depth, yBase = 1) {
    const y = yBase + wallHeight / 2;
    const halfWidth = width / 2 - 0.35;
    const front = depth / 2 + 0.08;
    for (const x of [-halfWidth, 0, halfWidth]) {
        box(root, `${prefix}:front-post:${x}`, MATERIAL_SET.timber, [0.42, wallHeight, 0.45], [x, y, front]);
        box(root, `${prefix}:rear-post:${x}`, MATERIAL_SET.timber, [0.42, wallHeight, 0.45], [x, y, -front]);
    }
    box(root, `${prefix}:front-beam-high`, MATERIAL_SET.timber, [width, 0.42, 0.45], [0, yBase + wallHeight - 0.25, front]);
    box(root, `${prefix}:front-beam-low`, MATERIAL_SET.timber, [width, 0.34, 0.45], [0, yBase + 0.65, front]);
    box(root, `${prefix}:rear-beam-high`, MATERIAL_SET.timber, [width, 0.42, 0.45], [0, yBase + wallHeight - 0.25, -front]);
}

function createOathhall(root) {
    addFoundation(root, 'oathhall', 21.8, 20.6);
    box(root, 'oathhall:lower-masonry', MATERIAL_SET.stone, [18.2, 6.1, 15.6], [0, 3.75, 0]);
    box(root, 'oathhall:upper-timber-hall', MATERIAL_SET.paleStone, [15.3, 4.8, 13.2], [0, 9.15, 0]);
    addTimberFrame(root, 'oathhall', 15.3, 4.8, 13.2, 6.75);
    addGabledRoof(root, 'oathhall', 19.2, 17.8, 11.7, 4.4);
    addDoor(root, 'oathhall', 2.65, 7.95, 3.2, 4.6);

    for (const x of [-6.3, -3.4, 3.4, 6.3]) {
        addWindow(root, `oathhall:lower-window:${x}`, x, 4.2, 7.92, 1.25, 2.05);
    }
    for (const x of [-5.1, -2.6, 2.6, 5.1]) {
        addWindow(root, `oathhall:upper-window:${x}`, x, 9.2, 6.7, 1.05, 1.72);
    }
    for (const [index, [x, z]] of [[-8.5, 6.8], [8.5, 6.8], [-8.5, -6.8], [8.5, -6.8]].entries()) {
        addButtress(root, `oathhall:${index}`, x, z, 7.3);
    }

    box(root, 'oathhall:bell-tower', MATERIAL_SET.stone, [5.2, 6.2, 5.2], [0, 15.7, 0]);
    addMesh(root, 'oathhall:broken-sun-belfry', SHAPES.torus, MATERIAL_SET.brass, {
        position: [0, 16.4, 2.66],
        rotation: [0, 0, 0],
        scale: [3.2, 3.2, 1]
    });
    addMesh(root, 'oathhall:oath-bell', SHAPES.cone8, MATERIAL_SET.iron, {
        position: [0, 16.15, 2.82],
        scale: [1.7, 2.5, 1.2]
    });
    addMesh(root, 'oathhall:belfry-spire', SHAPES.cone8, MATERIAL_SET.roof, {
        position: [0, 20.0, 0],
        scale: [5.0, 4.0, 5.0]
    });
    addLantern(root, 'oathhall:west-vigil', -2.45, 4.0, 8.25, 0.95);
    addLantern(root, 'oathhall:east-vigil', 2.45, 4.0, 8.25, 0.95);
}

function createTradingPost(root) {
    addFoundation(root, 'market', 10.8, 9.5, { steps: false });
    for (const [index, x] of [-4.35, 4.35].entries()) {
        for (const z of [-3.25, 3.25]) {
            box(root, `market:canopy-post:${index}:${z}`, MATERIAL_SET.timber, [0.46, 5.2, 0.46], [x, 3.15, z]);
        }
    }
    addGabledRoof(root, 'market', 10.65, 7.65, 5.55, 1.45, MATERIAL_SET.cloth);
    box(root, 'market:merchant-counter', MATERIAL_SET.timber, [8.4, 1.35, 1.3], [0, 1.4, 2.9]);
    box(root, 'market:counter-brass-edge', MATERIAL_SET.brass, [8.55, 0.16, 1.42], [0, 2.1, 2.9]);
    for (const x of [-3.25, -1.1, 1.1, 3.25]) {
        addMesh(root, `market:hanging-token:${x}`, SHAPES.octahedron, MATERIAL_SET.amber, {
            position: [x, 4.55, 3.45],
            scale: [0.34, 0.52, 0.22],
            castShadow: false
        });
        box(root, `market:ledger:${x}`, MATERIAL_SET.parchment, [1.2, 0.12, 0.8], [x, 2.25, 2.72], [-0.18, 0, 0]);
    }
    box(root, 'market:rear-supply-chest', MATERIAL_SET.leather, [2.1, 1.25, 1.35], [-2.75, 1.3, -2.4]);
    box(root, 'market:sealed-crate', MATERIAL_SET.stone, [1.45, 1.6, 1.45], [2.7, 1.5, -2.45]);
    addLantern(root, 'market:votive', 0, 4.2, -3.45, 0.85);
}

function createBlacksmith(root) {
    addFoundation(root, 'smithy', 14.25, 14.2);
    box(root, 'smithy:stone-workshop', MATERIAL_SET.stone, [11.8, 6.3, 10.2], [0, 3.85, 0]);
    addTimberFrame(root, 'smithy', 11.8, 6.3, 10.2, 0.7);
    addGabledRoof(root, 'smithy', 13.1, 11.8, 6.55, 3.25);
    addDoor(root, 'smithy', 2.65, 5.28, 2.85, 4.25);
    addWindow(root, 'smithy:west-window', -4.05, 3.95, 5.25, 1.3, 1.8);
    addWindow(root, 'smithy:east-window', 4.05, 3.95, 5.25, 1.3, 1.8);

    box(root, 'smithy:chimney-stack', MATERIAL_SET.foundation, [2.55, 7.2, 2.55], [-3.55, 9.45, -1.7]);
    addMesh(root, 'smithy:horned-stack-cap', SHAPES.cone4, MATERIAL_SET.iron, {
        position: [-3.55, 13.0, -1.7],
        rotation: [0, Math.PI / 4, 0],
        scale: [3.0, 1.15, 3.0]
    });
    for (const x of [-4.45, -2.65]) {
        addMesh(root, `smithy:ember-vent:${x}`, SHAPES.ring, MATERIAL_SET.ember, {
            position: [x, 8.9, -0.38],
            rotation: [0, 0, 0],
            scale: [1.0, 1.0, 1.0],
            castShadow: false,
            receiveShadow: false
        });
    }
    box(root, 'smithy:side-workbench', MATERIAL_SET.timber, [3.8, 1.25, 1.4], [4.65, 1.55, 4.35]);
    addMesh(root, 'smithy:sign-anvil', SHAPES.tapered, MATERIAL_SET.iron, {
        position: [4.65, 3.1, 5.0],
        rotation: [0, 0, Math.PI / 2],
        scale: [0.72, 1.6, 0.72]
    });
    addLantern(root, 'smithy:oathfire-lantern', 2.0, 4.2, 5.42, 0.9);
}

function createCamp(root) {
    addMesh(root, 'camp:grave-road-tent', SHAPES.cone4, MATERIAL_SET.ashCloth, {
        position: [-0.55, 2.25, -0.45],
        rotation: [0, Math.PI / 4, 0],
        scale: [4.2, 4.5, 4.2]
    });
    box(root, 'camp:tent-ridge', MATERIAL_SET.timber, [0.18, 4.4, 0.18], [-0.55, 2.2, -0.45]);
    box(root, 'camp:open-tent-flap', MATERIAL_SET.cloth, [1.15, 2.45, 0.12], [-0.55, 1.42, 1.3], [0.05, 0, -0.28]);
    addMesh(root, 'camp:oathfire-ring', SHAPES.torus, MATERIAL_SET.stone, {
        position: [2.35, 0.25, 1.9],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1.25, 1.25, 1.25]
    });
    for (const [index, [x, z, scale]] of [[2.05, 1.82, 0.9], [2.52, 1.72, 0.72], [2.34, 2.18, 0.78]].entries()) {
        addMesh(root, `camp:oathfire:${index}`, SHAPES.octahedron, MATERIAL_SET.ember, {
            position: [x, 0.67, z],
            scale: [scale * 0.42, scale, scale * 0.42],
            castShadow: false,
            receiveShadow: false
        });
    }
    box(root, 'camp:bedroll', MATERIAL_SET.leather, [2.4, 0.22, 0.85], [-2.15, 0.24, 1.95], [0, -0.25, 0]);
    box(root, 'camp:road-standard', MATERIAL_SET.timber, [0.16, 4.5, 0.16], [2.65, 2.25, -2.35]);
    box(root, 'camp:split-oath-banner', MATERIAL_SET.cloth, [1.2, 1.75, 0.08], [2.02, 3.62, -2.35], [0, 0, -0.12]);
    addLantern(root, 'camp:way-lantern', -2.75, 1.6, -2.4, 0.7);
}

function createTradingHouse(root) {
    addFoundation(root, 'compact', 14.25, 11.95);
    box(root, 'compact:ledger-hall', MATERIAL_SET.paleStone, [12.35, 6.0, 9.4], [0, 3.75, 0]);
    addTimberFrame(root, 'compact', 12.35, 6.0, 9.4, 0.75);
    addGabledRoof(root, 'compact', 13.5, 10.7, 6.55, 3.25);
    addDoor(root, 'compact', 2.7, 4.82, 2.8, 4.25);
    for (const x of [-4.55, -2.25, 2.25, 4.55]) {
        addWindow(root, `compact:ledger-window:${x}`, x, 4.0, 4.8, 1.05, 1.85);
    }
    box(root, 'compact:gilded-sign-bracket', MATERIAL_SET.iron, [7.0, 0.3, 0.35], [0, 7.0, 5.0]);
    box(root, 'compact:gilded-ledger-sign', MATERIAL_SET.timber, [5.5, 1.4, 0.25], [0, 7.05, 5.12]);
    addMesh(root, 'compact:chained-scale-ring', SHAPES.torus, MATERIAL_SET.brass, {
        position: [0, 7.05, 5.32],
        scale: [1.3, 1.3, 0.8]
    });
    for (const side of [-1, 1]) {
        box(root, `compact:scale-chain:${side}`, MATERIAL_SET.brass, [0.08, 1.1, 0.08], [side * 0.72, 6.6, 5.35], [0, 0, side * 0.25]);
        addMesh(root, `compact:scale-pan:${side}`, SHAPES.cone8, MATERIAL_SET.brass, {
            position: [side * 0.9, 6.0, 5.35],
            rotation: [Math.PI, 0, 0],
            scale: [1.3, 0.35, 1.3]
        });
    }
    addLantern(root, 'compact:west-lantern', -2.15, 4.15, 5.05, 0.86);
    addLantern(root, 'compact:east-lantern', 2.15, 4.15, 5.05, 0.86);
}

function createForge(root) {
    addFoundation(root, 'forge', 6.3, 7.0, { steps: false });
    box(root, 'forge:basalt-hearth', MATERIAL_SET.foundation, [5.35, 2.5, 5.1], [0, 1.6, -0.55]);
    box(root, 'forge:white-hot-mouth', MATERIAL_SET.ember, [3.15, 1.35, 0.18], [0, 1.65, 2.04]);
    for (const x of [-1.85, 1.85]) {
        addButtress(root, `forge:hearth:${x}`, x, 1.65, 3.7);
    }
    addMesh(root, 'forge:crowned-hood', SHAPES.cone4, MATERIAL_SET.iron, {
        position: [0, 4.4, -0.55],
        rotation: [0, Math.PI / 4, 0],
        scale: [4.4, 3.1, 4.4]
    });
    box(root, 'forge:smoke-throat', MATERIAL_SET.foundation, [1.65, 2.5, 1.65], [0, 5.38, -0.55]);
    addMesh(root, 'forge:anvil-base', SHAPES.tapered, MATERIAL_SET.stone, {
        position: [0, 0.95, 2.55],
        scale: [1.8, 1.5, 1.8]
    });
    box(root, 'forge:anvil-face', MATERIAL_SET.iron, [3.25, 0.45, 1.15], [0, 1.82, 2.55]);
    box(root, 'forge:anvil-horn', MATERIAL_SET.iron, [1.45, 0.32, 0.62], [1.95, 1.9, 2.55], [0, 0, -0.18]);
    addMesh(root, 'forge:ward-ring', SHAPES.torus, MATERIAL_SET.amber, {
        position: [0, 0.86, 2.58],
        rotation: [Math.PI / 2, 0, 0],
        scale: [2.15, 2.15, 2.15],
        castShadow: false,
        receiveShadow: false
    });
}

function createStash(root) {
    box(root, 'stash:buried-reliquary-plinth', MATERIAL_SET.foundation, [3.55, 0.38, 2.55], [0, 0.19, 0]);
    box(root, 'stash:black-oak-coffer', MATERIAL_SET.timber, [3.25, 1.45, 2.2], [0, 1.08, 0]);
    box(root, 'stash:faceted-lid', MATERIAL_SET.leather, [3.4, 0.72, 2.35], [0, 2.05, -0.02], [-0.08, 0, 0]);
    for (const x of [-1.2, 0, 1.2]) {
        box(root, `stash:iron-band:${x}`, MATERIAL_SET.iron, [0.22, 2.25, 2.42], [x, 1.45, 0]);
    }
    box(root, 'stash:warded-seam', MATERIAL_SET.spirit, [2.75, 0.1, 0.12], [0, 1.68, 1.2], [0, 0, 0]);
    addMesh(root, 'stash:oath-lock', SHAPES.octahedron, MATERIAL_SET.brass, {
        position: [0, 1.43, 1.23],
        scale: [0.6, 0.78, 0.28]
    });
    addMesh(root, 'stash:lock-rune', SHAPES.ring, MATERIAL_SET.spirit, {
        position: [0, 1.48, 1.36],
        scale: [0.72, 0.72, 0.72],
        castShadow: false,
        receiveShadow: false
    });
    for (const side of [-1, 1]) {
        addMesh(root, `stash:carry-ring:${side}`, SHAPES.torus, MATERIAL_SET.iron, {
            position: [side * 1.72, 1.16, 0],
            rotation: [0, Math.PI / 2, 0],
            scale: [0.72, 0.72, 0.72]
        });
    }
}

const STRUCTURE_BUILDERS = Object.freeze({
    oathhall: createOathhall,
    trading_post: createTradingPost,
    blacksmith: createBlacksmith,
    camp: createCamp,
    trading_house: createTradingHouse,
    forge: createForge,
    stash: createStash
});

function configureStructureRoot(root, config) {
    root.name = `Lanternhold:${config.label}`;
    root.userData.proceduralTownStructure = true;
    root.userData.structureId = config.id;
    root.userData.artStyle = config.artStyle;
    root.userData.role = config.role;
    root.userData.gameplayBounds = [...config.bounds];
    return root;
}

function getOptimizedStructureParts(structureId) {
    if (OPTIMIZED_STRUCTURE_PARTS.has(structureId)) {
        return OPTIMIZED_STRUCTURE_PARTS.get(structureId);
    }

    const config = LANTERNHOLD_STRUCTURE_DEFINITIONS[structureId];
    const build = STRUCTURE_BUILDERS[structureId];
    if (!config || !build) {
        throw new Error(`Unknown Lanternhold structure: ${structureId}`);
    }

    const source = configureStructureRoot(new THREE.Group(), config);
    build(source);
    source.updateMatrixWorld(true);
    const buckets = new Map();
    let sourceMeshCount = 0;

    source.traverse((part) => {
        if (!part.isMesh || !part.userData.proceduralTownPart) return;
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
        const bakedGeometry = part.geometry.index
            ? part.geometry.toNonIndexed()
            : part.geometry.clone();
        buckets.get(key).geometries.push(bakedGeometry.applyMatrix4(part.matrixWorld));
    });

    const parts = [...buckets.values()].map((bucket, index) => {
        const merged = mergeGeometries(bucket.geometries, false);
        bucket.geometries.forEach((entry) => entry.dispose());
        if (!merged) {
            throw new Error(`Unable to batch Lanternhold structure: ${structureId}`);
        }
        merged.name = `lanternhold-${structureId}-batch-${index}`;
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        return Object.freeze({
            geometry: merged,
            material: bucket.material,
            castShadow: bucket.castShadow,
            receiveShadow: bucket.receiveShadow
        });
    });
    const result = Object.freeze({
        parts: Object.freeze(parts),
        sourceMeshCount
    });
    OPTIMIZED_STRUCTURE_PARTS.set(structureId, result);
    return result;
}

export function createProceduralLanternholdStructure(structureId, { optimized = false } = {}) {
    const config = LANTERNHOLD_STRUCTURE_DEFINITIONS[structureId];
    const build = STRUCTURE_BUILDERS[structureId];
    if (!config || !build) {
        throw new Error(`Unknown Lanternhold structure: ${structureId}`);
    }

    const root = configureStructureRoot(new THREE.Group(), config);
    if (optimized) {
        const optimizedParts = getOptimizedStructureParts(structureId);
        optimizedParts.parts.forEach((descriptor, index) => {
            addMesh(
                root,
                `${structureId}:material-batch:${index}`,
                descriptor.geometry,
                descriptor.material,
                {
                    castShadow: descriptor.castShadow,
                    receiveShadow: descriptor.receiveShadow
                }
            );
        });
        root.userData.renderBatched = true;
        root.userData.sourceMeshCount = optimizedParts.sourceMeshCount;
        root.userData.drawMeshCount = optimizedParts.parts.length;
    } else {
        build(root);
    }
    addGameplayBounds(root, config);
    return root;
}

export function createProceduralLanternholdCampField(placements, { targetY = -0.65 } = {}) {
    const normalizedPlacements = Array.isArray(placements) ? placements : [];
    const optimized = getOptimizedStructureParts('camp');
    const field = new THREE.Group();
    field.name = 'Lanternhold:Pilgrim Vigil Field';
    field.userData.proceduralTownCampField = true;
    field.userData.instanceCount = normalizedPlacements.length;
    field.userData.sourceMeshCount = optimized.sourceMeshCount * normalizedPlacements.length;
    field.userData.drawMeshCount = optimized.parts.length;

    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const matrix = new THREE.Matrix4();
    optimized.parts.forEach((descriptor, partIndex) => {
        const instances = new THREE.InstancedMesh(
            descriptor.geometry,
            descriptor.material,
            normalizedPlacements.length
        );
        instances.name = `camp:material-instance-batch:${partIndex}`;
        instances.castShadow = descriptor.castShadow;
        instances.receiveShadow = descriptor.receiveShadow;
        instances.userData.proceduralTownPart = true;
        normalizedPlacements.forEach((placement, placementIndex) => {
            position.set(placement.x, targetY, placement.z);
            rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, placement.rotation);
            matrix.compose(position, rotation, scale);
            instances.setMatrixAt(placementIndex, matrix);
        });
        instances.instanceMatrix.needsUpdate = true;
        instances.computeBoundingBox();
        instances.computeBoundingSphere();
        field.add(instances);
    });
    return field;
}

function deterministicRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Replaces reload-dependent Math.random placement with a stable town plan.
 * Count, exclusion radius, spacing, and collision size remain unchanged.
 */
export function createLanternholdCampPlacements(cx, cz, {
    count = 15,
    exclusionRadius = 50,
    townRadius = 85,
    minCampDistance = 20
} = {}) {
    const seed = (0xE1D010 ^ Math.round(cx * 97) ^ Math.round(cz * 193)) >>> 0;
    const random = deterministicRandom(seed);
    const placements = [];
    const maxAttempts = count * 180;

    for (let attempts = 0; attempts < maxAttempts && placements.length < count; attempts += 1) {
        const x = cx + (random() * 2 - 1) * townRadius;
        const z = cz + (random() * 2 - 1) * townRadius;
        const distanceFromCenter = Math.hypot(x - cx, z - cz);
        if (distanceFromCenter < exclusionRadius || distanceFromCenter > townRadius * Math.SQRT2) continue;
        if (placements.some((placed) => Math.hypot(x - placed.x, z - placed.z) < minCampDistance)) continue;
        placements.push(Object.freeze({
            x,
            z,
            rotation: random() * Math.PI * 2
        }));
    }

    if (placements.length !== count) {
        throw new Error(`Unable to place ${count} Lanternhold camps; placed ${placements.length}`);
    }
    return Object.freeze(placements);
}

export function getProceduralLanternholdCacheMetrics() {
    return Object.freeze({
        geometries: GEOMETRIES.size,
        materials: MATERIALS.size,
        structures: LANTERNHOLD_STRUCTURE_IDS.length
    });
}
