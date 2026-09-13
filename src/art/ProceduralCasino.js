import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
        geometries.push(mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
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
    box(root, 'casino-floor', m.dark, [19, 0.2, 16], [0, -0.1, 0]);
    for (let ix = -4; ix <= 4; ix++) for (let iz = -3; iz <= 3; iz++) {
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
        { size: [0.5, 5.8, 16.5], position: [-9.5, 2.9, 0] },
        { size: [0.5, 5.8, 16.5], position: [9.5, 2.9, 0] },
        { size: [19.5, 5.8, 0.5], position: [0, 2.9, -8] },
        { size: [7, 5.8, 0.5], position: [-6, 2.9, 8] },
        { size: [7, 5.8, 0.5], position: [6, 2.9, 8] }
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
    // Exterior upper storey retains the two-floor silhouette. Its walkable VIP
    // interior and connecting stair remain part of the next venue/content stage.
    box(cutaway, 'casino-upper-storey', m.dark, [18.4, 4.8, 15.4], [0, 8.2, 0]);
    for (const px of [-7, -3.5, 0, 3.5, 7]) {
        box(cutaway, 'casino-upper-window-frame', m.gold, [1.7, 2.75, 0.2], [px, 8.15, 7.8]);
        box(cutaway, 'casino-upper-window', m.felt, [1.4, 2.4, 0.23], [px, 8.15, 7.82]);
    }
    for (const y of [5.9, 10.7]) box(cutaway, 'casino-gold-cornice', m.gold, [19.6, 0.3, 16.6], [0, y, 0]);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(13.9, 3.5, 4), m.dark);
    roof.name = 'casino-roof'; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.87; roof.position.y = 12.55;
    roof.castShadow = true; cutaway.add(roof);
    root.userData.casinoCutaway = cutaway;
    // Batch the opaque exterior separately so its interior cutaway remains cheap.
    cutaway.removeFromParent();
    root.userData.structureId = 'casino';
    root.userData.drawMeshCount = batchMeshes(root) + batchMeshes(cutaway);
    root.add(cutaway);
    return root;
}

export function updateCasinoCutaway(shell, position) {
    if (!shell?.userData.casinoCutaway) return;
    const inside = position && Math.abs(position.x - shell.position.x) < 10 && Math.abs(position.z - shell.position.z) < 9;
    shell.userData.casinoCutaway.visible = !inside;
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
