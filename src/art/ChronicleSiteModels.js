import * as THREE from 'three';

const PALETTES = {
    earth: { stone: 0x696b50, wood: 0x54402e, glow: 0x95d994 },
    water: { stone: 0x657c89, wood: 0x475661, glow: 0x85dbe8 },
    fire: { stone: 0x594a48, wood: 0x392e2a, glow: 0xf6af65 },
    air: { stone: 0x858a9d, wood: 0x645c78, glow: 0xc2baff }
};

// Each model owns its resources. Chunk unload must not dispose another site's
// materials, and reload must not leave invisible wall colliders behind.
export function createChronicleSiteModel(site, realm) {
    if (site.kind !== 'inspect') throw new Error('Combat discoveries use normal enemy models');
    const colors = PALETTES[realm];
    if (!colors) throw new Error(`Unknown Chronicle realm: ${realm}`);
    const root = new THREE.Group();
    root.name = site.model;
    const geometries = new Set();
    const materials = new Set();
    const walls = [];
    const material = (color, extra = {}) => {
        const value = new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra });
        materials.add(value);
        return value;
    };
    const stone = material(colors.stone);
    const wood = material(colors.wood);
    const brass = material(0xb59a62, { metalness: 0.55, roughness: 0.4 });
    const glow = material(colors.glow, { emissive: colors.glow, emissiveIntensity: 0.65 });
    const paper = material(0xe6d8b4);
    const mesh = (geometry, surface, x = 0, y = 0, z = 0) => {
        geometries.add(geometry);
        const object = new THREE.Mesh(geometry, surface);
        object.position.set(x, y, z);
        object.castShadow = true;
        object.receiveShadow = true;
        root.add(object);
        return object;
    };
    const box = (w, h, d, surface, x = 0, y = h / 2, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), surface, x, y, z);
    const cylinder = (top, bottom, height, surface, x = 0, y = height / 2, z = 0) => mesh(new THREE.CylinderGeometry(top, bottom, height, 12), surface, x, y, z);
    const ring = (radius, surface, y, tilt = Math.PI / 2) => {
        const value = mesh(new THREE.TorusGeometry(radius, 0.06, 5, 32), surface, 0, y);
        value.rotation.x = tilt;
        return value;
    };
    const wall = (w, h, d, x, z) => {
        box(w, h, d, stone, x, h / 2, z);
        walls.push(new THREE.Box3(new THREE.Vector3(x - w / 2, -1, z - d / 2), new THREE.Vector3(x + w / 2, h, z + d / 2)));
    };
    const book = () => {
        box(2.2, 0.18, 1.4, wood, 0, 1.25);
        for (const x of [-0.78, 0.78]) box(0.16, 1.2, 0.18, wood, x, 0.6, 0.4);
        box(1.16, 0.1, 0.88, brass, 0, 1.4);
        for (const side of [-1, 1]) {
            const page = box(0.53, 0.07, 0.76, paper, side * 0.27, 1.48);
            page.rotation.z = side * -0.12;
            for (let line = 0; line < 4; line++) box(0.34, 0.015, 0.022, wood, side * 0.27, 1.53, -0.2 + line * 0.12);
        }
        box(0.045, 0.02, 0.95, glow, 0, 1.56, 0.1);
    };
    const house = ['ruined_house', 'flood_shelter', 'cold_kiln', 'observatory'].includes(site.model);
    if (house) {
        box(7.2, 0.12, 6.2, stone, 0, 0.01, -0.5);
        // Roofless and open towards +Z: the book remains visible from the road.
        // Only the actual three walls block walking, never the foundation.
        wall(7, 2.2, 0.45, 0, -3.3);
        wall(0.45, 1.5, 4.8, -3.3, -0.7);
        wall(0.45, 0.85, 3.6, 3.3, -1.3);
        book();
        if (site.model === 'ruined_house') {
            for (let i = 0; i < 5; i++) {
                const branch = cylinder(0.12, 0.21, 2.8, wood, -2.6 + i * 0.18, 0.6, -2.2 + i * 0.8);
                branch.rotation.z = 0.8;
                mesh(new THREE.IcosahedronGeometry(0.35, 0), glow, -1.7 + i * 0.12, 1.4, -2.2 + i * 0.8);
            }
        } else if (site.model === 'flood_shelter') {
            for (const x of [-2.5, 2.5]) {
                cylinder(0.14, 0.18, 2.7, wood, x, 1.35, 1.6);
                const loop = mesh(new THREE.TorusGeometry(0.3, 0.07, 5, 12), brass, x, 1.9, 1.6);
                loop.rotation.x = Math.PI / 2;
            }
            box(5.8, 0.08, 0.03, glow, 0, 0.8, -3.05); // old flood mark
        } else if (site.model === 'cold_kiln') {
            cylinder(0.85, 1.2, 2.5, stone, -1.7, 1.25, -1.8);
            cylinder(0.45, 0.65, 1.2, wood, -1.7, 3.05, -1.8);
            box(0.8, 0.9, 0.12, wood, -1.7, 0.6, -0.65);
        } else {
            cylinder(0.1, 0.16, 2.2, brass, 2, 1.1, -1.5);
            const lens = cylinder(0.27, 0.35, 1.65, brass, 2, 2.2, -1.5);
            lens.rotation.z = -Math.PI / 3;
            const orbit = ring(1, glow, 2.3, Math.PI / 4);
            orbit.position.x = 2;
            orbit.position.z = -1.5;
        }
    } else {
        cylinder(1.9, 2.1, 0.18, stone);
        switch (site.model) {
        case 'root_memory':
        case 'root_growth':
            for (let i = 0; i < 4; i++) {
                const stem = cylinder(0.08, 0.24, 2.1, wood, (i - 1.5) * 0.45, 0.8, 0);
                stem.rotation.z = (i - 1.5) * 0.3;
                if (site.model === 'root_growth') mesh(new THREE.IcosahedronGeometry(0.38, 0), glow, (i - 1.5) * 0.75, 1.7, 0);
            }
            break;
        case 'command_stone':
        case 'horizon_marker':
            box(1.1, 2.2, 0.7, stone);
            for (let i = 0; i < 4; i++) box(0.6 - i * 0.09, 0.06, 0.03, glow, 0, 0.65 + i * 0.35, 0.365);
            if (site.model === 'horizon_marker') ring(1.05, brass, 2.4, 0);
            break;
        case 'still_echo':
        case 'moving_echo':
            cylinder(1.65, 1.65, 0.04, material(colors.glow, { metalness: 0.7, roughness: 0.18 }), 0, 0.2);
            for (let i = 0; i < 3; i++) ring(0.55 + i * 0.4, glow, 0.24 + i * (site.model === 'moving_echo' ? 0.16 : 0));
            break;
        case 'mooring_bell':
            for (const x of [-1.2, 1.2]) box(0.22, 2.8, 0.22, wood, x);
            box(2.8, 0.2, 0.25, wood, 0, 2.8);
            cylinder(0.3, 0.8, 0.9, brass, 0, 2.0);
            cylinder(0.08, 0.08, 0.6, wood, 0, 1.6);
            break;
        case 'cold_ash':
        case 'free_ember':
            for (let i = 0; i < 7; i++) mesh(new THREE.DodecahedronGeometry(0.25, 0), wood, Math.sin(i * 2.4), 0.3, Math.cos(i * 2.4));
            if (site.model === 'free_ember') mesh(new THREE.OctahedronGeometry(0.65, 0), glow, 0, 1.2);
            else box(1.2, 0.02, 0.06, glow, 0, 0.2);
            break;
        case 'silent_vane':
            cylinder(0.08, 0.15, 3, brass);
            box(2.8, 0.12, 0.12, brass, 0, 2.7);
            mesh(new THREE.ConeGeometry(0.35, 0.8, 3), glow, 1.1, 2.7).rotation.z = -Math.PI / 2;
            break;
        case 'trapped_updraft':
            for (let i = 0; i < 5; i++) ring(0.5 + i * 0.18, glow, 0.5 + i * 0.42, Math.PI / 2 + i * 0.08);
            for (let i = 0; i < 4; i++) box(0.12, 2.8, 0.12, brass, Math.sin(i * Math.PI / 2) * 1.5, 1.4, Math.cos(i * Math.PI / 2) * 1.5);
            break;
        default:
            throw new Error(`Missing Chronicle model: ${site.model}`);
        }
    }
    const beacon = mesh(new THREE.OctahedronGeometry(0.24, 0), material(0xffd56a, { emissive: 0xffd56a, emissiveIntensity: 0.9 }), 0, house ? 3.9 : 3.6);
    beacon.name = 'DiscoveryBeacon';
    beacon.visible = false;
    root.userData.bounds = { radius: house ? 4.8 : 2.2, height: house ? 4.1 : 3.9 };
    root.traverse(object => { object.userData.entityId = site.entityId; });
    return { mesh: root, walls, beacon, dispose: () => {
        geometries.forEach(value => value.dispose());
        materials.forEach(value => value.dispose());
    } };
}

export function getChronicleSiteColliders(mesh, walls) {
    mesh.updateMatrixWorld(true);
    return walls.map(box => ({ box: box.clone(), matrix: mesh.matrixWorld.clone(), inverse: mesh.matrixWorld.clone().invert() }));
}
