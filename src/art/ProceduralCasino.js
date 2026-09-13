import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createProceduralDungeonNPC } from './ProceduralTownActors.js';

export function createCasinoInterior(scene, collision) {
    const root = new THREE.Group(); root.name = 'lanternhold-casino-interior';
    const m = materials();
    box(root, 'obsidian-gaming-floor', m.dark, [68, .3, 76], [0, -.15, 166]);
    // Broad circulation lanes separate the tables; inlays never collide.
    for (let x = -30; x <= 30; x += 6) for (let z = 134; z <= 200; z += 6) {
        box(root, 'polished-marble-tile', ((x / 6 + (z - 134) / 6) % 2) ? m.stone : m.wood, [5.88, .015, 5.88], [x, .012, z]);
    }
    box(root, 'arrival-carpet', m.velvet, [9, .025, 51], [0, .035, 177]);
    for (const x of [-4.6, 4.6]) box(root, 'carpet-gilt-border', m.gold, [.1, .025, 51], [x, .05, 177]);
    for (const z of [156, 180, 198]) {
        cylinder(root, 'fourfold-medallion-border', m.gold, 2.7, .025, [0, .07, z]);
        cylinder(root, 'fourfold-medallion', m.dark, 2.5, .026, [0, .085, z]);
        for (let i = 0; i < 4; i++) {
            const ray = box(root, 'fourfold-inlay', m.gold, [.16, .025, 3.9], [0, .103, z]); ray.rotation.y = i * Math.PI / 4;
        }
    }
    const colliders = [];
    const solid = (name, material, size, position) => {
        box(root, name, material, size, position);
        const bounds = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...position), new THREE.Vector3(...size));
        collision.addCollider(bounds); colliders.push(bounds);
    };
    // Low foreground walls keep the gameplay view open. The balcony and far
    // colonnade provide a genuine second storey without a roof hiding players.
    for (const x of [-34, 34]) solid('perimeter-balustrade', m.stone, [.7, 1.1, 76], [x, .55, 166]);
    solid('rear-wall', m.stone, [68, 12, .7], [0, 6, 128]);
    solid('front-balustrade', m.stone, [68, 1.1, .7], [0, .55, 204]);
    for (const x of [-31, 31]) for (const z of [136, 158, 180, 200]) {
        solid('fluted-column-base', m.dark, [2.1, .65, 2.1], [x, .325, z]);
        cylinder(root, 'fluted-column', m.stone, .58, 10, [x, 5, z], 12);
        cylinder(root, 'column-capital', m.gold, .9, .35, [x, 9.8, z], 12);
        box(root, 'amber-sconce-frame', m.gold, [.85, 1.3, .65], [x, 4, z + .7]);
        box(root, 'amber-sconce', m.light, [.55, 1, .7], [x, 4, z + .73]);
    }
    const balcony = new THREE.Group(); balcony.name = 'casino-vip-balcony';
    box(balcony, 'vip-rear-floor', m.dark, [66, .4, 15], [0, 7.8, 136]);
    for (const x of [-29, 29]) box(balcony, 'vip-gallery-floor', m.dark, [8, .4, 60], [x, 7.8, 173]);
    box(balcony, 'vip-velvet-runner', m.velvet, [58, .03, 10], [0, 8.02, 135]);
    for (const x of [-23, -14, 14, 23]) {
        box(balcony, 'vip-sofa', m.velvet, [5, .7, 1.7], [x, 8.5, 132]);
        box(balcony, 'vip-sofa-back', m.wood, [5.2, 1.5, .3], [x, 8.8, 131.2]);
        cylinder(balcony, 'vip-marble-table', m.gold, 1, .7, [x, 8.35, 136]);
    }
    for (const x of [-19, 19]) box(balcony, 'balcony-golden-rail', m.gold, [25, .15, .15], [x, 9.2, 143.6]);
    for (let x = -32; x <= 32; x += 2) if (Math.abs(x) > 6) cylinder(balcony, 'balcony-baluster', m.gold, .065, 1.2, [x, 8.6, 143.6], 8);
    for (let step = 0; step < 32; step++) box(root, 'grand-stair-tread', step % 2 ? m.stone : m.dark,
        [10, (step + 1) / 4, .45], [0, (step + 1) / 8, 147.6 - step * .45]);
    solid('vip-stair-barrier', m.gold, [12, 1.1, .3], [0, .55, 148]);
    for (const x of [-5.7, 5.7]) cylinder(root, 'velvet-rope-post', m.gold, .2, 1.5, [x, .75, 148.6]);
    box(root, 'velvet-rope', m.velvet, [11.4, .13, .13], [0, 1.3, 148.6]);
    for (const x of [-25, 25]) for (const z of [151, 172, 192]) {
        solid('lounge-bench', m.velvet, [2, .55, 5], [x, .5, z]);
        box(root, 'lounge-back', m.wood, [.25, 1.2, 5.2], [x + Math.sign(x), .8, z]);
    }
    root.userData.drawMeshCount = batchMeshes(root) + batchMeshes(balcony);
    root.add(balcony);
    // Reuse the established humanoid rig, with a real body and readable uniform.
    const guard = createProceduralDungeonNPC(); guard.name = 'casino-vip-guard'; guard.position.set(0, 0, 150);
    root.add(guard);
    collision.addCircularCollider(0, 150, .65);
    const exit = box(root, 'casino-interior-exit', m.gold, [6, 4, .4], [0, 2, 203.3]);
    root.userData.casinoGuard = guard; root.userData.casinoExit = exit;
    scene.add(root); collision.casinoInterior = true;
    return root;
}

const colors = { stone: 0x394453, dark: 0x17212d, gold: 0xb99a58, wood: 0x30231f, felt: 0x155453, velvet: 0x623647, light: 0xffcf78 };

function materials() {
    return Object.fromEntries(Object.entries(colors).map(([key, color]) => [key, new THREE.MeshStandardMaterial({ color,
        roughness: key === 'gold' ? 0.35 : 0.78, metalness: key === 'gold' ? 0.7 : 0,
        emissive: key === 'light' ? color : 0, emissiveIntensity: key === 'light' ? 0.65 : 0 })]));
}

function box(parent, name, material, size, position) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name; mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
}

function cylinder(parent, name, material, radius, height, position, sides = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material);
    mesh.name = name; mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
}

function batchMeshes(root) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(), groups = new Map(), originals = [];
    root.traverse(mesh => {
        if (!mesh.isMesh || mesh.userData.casinoPickOnly) return;
        const geometries = groups.get(mesh.material) || [];
        // Boxes/cylinders are indexed, but slot gems are non-indexed polyhedra.
        // A shared material batch must use one consistent attribute layout.
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        geometries.push(geometry.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
        groups.set(mesh.material, geometries); originals.push(mesh);
    });
    for (const mesh of originals) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    for (const [material, geometries] of groups) {
        const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
        mesh.name = 'casino-material-batch'; mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
        geometries.forEach(geometry => geometry.dispose());
    }
    return groups.size;
}

export function createCasinoShell(x = 0, z = 170) {
    const root = new THREE.Group(); root.name = 'lanternhold-casino-shell'; root.position.set(x, 0, z);
    const m = materials();
    const cutaway = new THREE.Group(); cutaway.name = 'casino-cutaway'; root.add(cutaway);
    const upstairs = new THREE.Group(); upstairs.name = 'casino-vip-lounge'; root.add(upstairs);
    box(root, 'casino-floor', m.dark, [26, 0.2, 16], [0, -0.1, 0]);
    for (let ix = -6; ix <= 6; ix++) for (let iz = -3; iz <= 3; iz++) {
        box(root, 'casino-floor-inlay', (ix + iz) % 2 ? m.stone : m.wood, [1.88, 0.015, 1.88], [ix * 2, 0.008, iz * 2]);
    }
    cylinder(root, 'fourfold-floor-medallion', m.gold, 1.3, 0.025, [0, 0.026, 3]);
    cylinder(root, 'fourfold-floor-center', m.dark, 1.14, 0.03, [0, 0.042, 3]);
    for (let i = 0; i < 4; i++) {
        const sigil = box(root, 'elemental-inlay', m.gold, [0.24, 0.035, 1.55], [0, 0.064, 3]);
        sigil.rotation.y = i * Math.PI / 4;
    }
    // Front opening is five units wide. These are wall segments, never a full
    // building bounding box: entering the room must remain physically possible.
    const walls = [
        { size: [0.5, 10.8, 16.5], position: [-13, 5.4, 0] },
        { size: [0.5, 10.8, 16.5], position: [13, 5.4, 0] },
        { size: [26.5, 10.8, 0.5], position: [0, 5.4, -8] },
        { size: [10.5, 10.8, 0.5], position: [-7.75, 5.4, 8] },
        { size: [10.5, 10.8, 0.5], position: [7.75, 5.4, 8] }
    ];
    root.userData.casinoWalls = walls;
    for (const [i, wall] of walls.entries()) {
        box(cutaway, `casino-wall-${i}`, m.stone, wall.size, wall.position);
        box(root, `casino-wall-base-${i}`, m.dark, [wall.size[0], 0.65, wall.size[2]], [wall.position[0], 0.325, wall.position[2]]);
    }
    for (const px of [-9.2, -6, -2.75, 2.75, 6, 9.2]) {
        box(cutaway, 'casino-pilaster', m.dark, [0.42, 6, 0.65], [px, 3, 8.15]);
        box(cutaway, 'casino-capital', m.gold, [0.65, 0.24, 0.8], [px, 5.65, 8.15]);
    }
    box(cutaway, 'casino-entrance-lintel', m.gold, [5.5, 0.3, 0.8], [0, 5.6, 8.2]);
    for (const px of [-3.25, 3.25]) {
        box(cutaway, 'casino-lantern-cage', m.dark, [0.65, 1.25, 0.55], [px, 3.4, 8.6]);
        box(cutaway, 'casino-lantern', m.light, [0.38, 0.8, 0.6], [px, 3.4, 8.64]);
    }
    // Actual second floor leaves a stairwell along the east side. Navigation
    // follows the same six-unit rise and north/south landings, not a teleport.
    box(upstairs, 'vip-floor', m.dark, [21.5, .2, 15.5], [-2.25, 5.9, 0]);
    box(upstairs, 'vip-north-landing', m.dark, [4.5, .2, 2], [10.75, 5.9, -7]);
    box(upstairs, 'vip-velvet-carpet', m.velvet, [16, .025, 11], [-2.25, 6.02, 0]);
    for (const px of [-10.4, 5.9]) box(upstairs, 'vip-carpet-border', m.gold, [.12, .03, 11.3], [px, 6.04, 0]);
    for (const pz of [-5.6, 5.6]) box(upstairs, 'vip-carpet-border', m.gold, [16.4, .03, .12], [-2.25, 6.04, pz]);
    for (const pz of [-4, 0, 4]) {
        box(upstairs, 'vip-lounge-sofa', m.velvet, [1.5, .65, 2.5], [-10.7, 6.45, pz]);
        box(upstairs, 'vip-lounge-back', m.wood, [.3, 1.3, 2.6], [-11.4, 6.8, pz]);
        cylinder(upstairs, 'vip-side-table', m.gold, .55, .75, [-8.6, 6.375, pz]);
        cylinder(upstairs, 'vip-candle', m.light, .09, .4, [-8.6, 6.95, pz]);
    }
    for (let step = 0; step < 24; step++) {
        const rise = (step + 1) * .25;
        box(root, 'casino-stair-tread', step % 2 ? m.stone : m.dark, [2.6, rise, .5], [10.5, rise / 2, 5.75 - step * .5]);
        box(root, 'casino-stair-nosing', m.gold, [2.6, .03, .07], [10.5, rise + .01, 5.98 - step * .5]);
    }
    box(upstairs, 'vip-stairwell-rail', m.gold, [.12, .12, 12.5], [8.7, 7.05, .25]);
    for (let pz = -5.5; pz <= 6; pz += 1.5) box(upstairs, 'vip-stairwell-baluster', m.gold, [.1, 1.05, .1], [8.7, 6.525, pz]);
    for (const px of [-7, -3.5, 0, 3.5, 7]) {
        box(cutaway, 'casino-upper-window-frame', m.gold, [1.7, 2.75, 0.2], [px, 8.15, 7.8]);
        box(cutaway, 'casino-upper-window', m.felt, [1.4, 2.4, 0.23], [px, 8.15, 7.82]);
    }
    for (const y of [5.9, 10.7]) box(cutaway, 'casino-gold-cornice', m.gold, [26.6, 0.3, 16.6], [0, y, 0]);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(18.8, 3.5, 4), m.dark);
    roof.name = 'casino-roof'; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.63; roof.position.y = 12.55;
    roof.castShadow = true; cutaway.add(roof);
    root.userData.casinoCutaway = cutaway;
    root.userData.casinoUpstairs = upstairs;
    // Batch the opaque exterior separately so its interior cutaway remains cheap.
    cutaway.removeFromParent(); upstairs.removeFromParent();
    root.userData.structureId = 'casino';
    root.userData.drawMeshCount = batchMeshes(root) + batchMeshes(cutaway) + batchMeshes(upstairs);
    root.add(cutaway, upstairs);
    const stairMarkers = [];
    for (const [floor, y, markerZ] of [['public', .08, 6.4], ['vip', 6.08, -6.5]]) {
        const marker = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), new THREE.MeshBasicMaterial({ color: 0xe8c980,
            transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }));
        marker.name = `casino-stairs-${floor}`; marker.rotation.x = -Math.PI / 2;
        marker.position.set(10.5, y, markerZ); marker.userData.casinoStairFloor = floor;
        root.add(marker); stairMarkers.push(marker);
    }
    root.userData.casinoStairMarkers = stairMarkers;
    const door = box(root, 'casino-town-door', m.wood, [4.8, 4.8, .3], [0, 2.4, 8.35]);
    box(door, 'casino-door-handle', m.gold, [.15, .7, .2], [.7, 0, .3]);
    root.userData.casinoDoor = door;
    return root;
}

export function updateCasinoCutaway(shell, position) {
    if (!shell?.userData.casinoCutaway) return;
    const inside = position && Math.abs(position.x - shell.position.x) < 14 && Math.abs(position.z - shell.position.z) < 9;
    shell.userData.casinoCutaway.visible = !inside;
    shell.userData.casinoUpstairs.visible = !inside || position.y >= 3;
    for (const marker of shell.userData.casinoStairMarkers || []) marker.visible = inside && (marker.userData.casinoStairFloor === 'vip' ? position.y >= 3 : position.y < 3);
}

export function createCasinoFurniture(tables) {
    const root = new THREE.Group(); root.name = 'casino-furniture';
    const m = materials(); const seats = [];
    for (const table of tables) {
        const unit = new THREE.Group(); unit.name = table.id; root.add(unit);
        if (table.game === 'slots') {
            box(unit, 'slot-plinth', m.wood, [1.4, 1, 0.85], [table.x, 0.5, table.z]);
            box(unit, 'slot-cabinet', m.gold, [1.55, 1.9, 0.95], [table.x, 1.95, table.z]);
            box(unit, 'slot-face', m.dark, [1.3, 1.35, 0.1], [table.x, 2.1, table.z + 0.52]);
            for (let reel = -1; reel <= 1; reel++) {
                box(unit, 'slot-reel-window', m.light, [0.3, 0.55, 0.12], [table.x + reel * 0.38, 2.15, table.z + 0.59]);
                const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), m.felt);
                gem.position.set(table.x + reel * 0.38, 2.15, table.z + 0.67); unit.add(gem);
            }
        } else {
            cylinder(unit, 'table-base', m.wood, 0.65, 1.05, [table.x, 0.525, table.z]);
            cylinder(unit, 'table-rail', m.gold, 1.75, 0.2, [table.x, 1.2, table.z]);
            cylinder(unit, 'table-felt', m.felt, 1.59, 0.05, [table.x, 1.325, table.z]);
            cylinder(unit, 'table-sigil', m.gold, 0.34, 0.015, [table.x, 1.36, table.z], 4);
        }
        table.seats.forEach((seat, index) => {
            const chair = new THREE.Group(); chair.position.set(seat.x, 0, seat.z); chair.rotation.y = seat.rotation;
            chair.name = `${table.id}-seat-${index}`; chair.userData.casinoSeat = { tableId: table.id, seat: index };
            box(chair, 'chair-cushion', m.velvet, [0.9, 0.2, 0.8], [0, 0.94, 0]);
            box(chair, 'chair-back', m.wood, [0.96, 1.15, 0.14], [0, 1.45, -0.43]);
            box(chair, 'chair-back-inset', m.velvet, [0.76, 0.8, 0.16], [0, 1.5, -0.42]);
            for (const px of [-0.36, 0.36]) for (const pz of [-0.31, 0.31]) box(chair, 'chair-leg', m.gold, [0.08, 0.9, 0.08], [px, 0.45, pz]);
            unit.add(chair); seats.push(chair);
        });
    }
    root.userData.seats = seats;
    batchMeshes(root);
    // Picking proxies retain individual seats after visible geometry is batched.
    const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
    for (const chair of seats) {
        const proxy = box(chair, 'seat-pick-proxy', pickMaterial, [1.05, 2, 1.05], [0, 1, 0]);
        proxy.userData.casinoPickOnly = true; proxy.castShadow = false;
    }
    return root;
}

export function disposeCasinoObject(root) {
    const geometries = new Set(), materials = new Set();
    root?.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); root?.removeFromParent();
}
