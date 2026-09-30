import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createProceduralDungeonNPC } from './ProceduralTownActors.js';
import { CASINO_INTERIOR_LAYOUT } from '../data/casinoInteriorLayout.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { addCasinoFacade, createCasinoHippedRoof } from './CasinoFacade.js';

export function createCasinoInterior(scene, collision) {
    const root = new THREE.Group(); root.name = 'lanternhold-casino-interior';
    const m = materials();
    const floors = {};
    for (const [floor, y] of [['public', 0], ['vip', 8]]) {
        const group = new THREE.Group(); group.name = `casino-${floor}-floor`; group.position.y = y;
        const palette = floor === 'vip' ? { ...m, velvet: new THREE.MeshStandardMaterial({ color: 0x34234e, roughness: .7 }),
            stone: new THREE.MeshStandardMaterial({ color: 0x667581, roughness: .32, metalness: .15 }) } : m;
        box(group, 'marble-gaming-floor', palette.dark,
            [CASINO_INTERIOR_LAYOUT.width, .3, CASINO_INTERIOR_LAYOUT.depth], [0, -.15, CASINO_INTERIOR_LAYOUT.centerZ]);
        for (let x = -52; x <= 52; x += 8) for (let z = 100; z <= 204; z += 8) {
            box(group, 'polished-marble-tile', ((x + z) / 8) % 2 ? palette.stone : palette.wood,
                [7.88, .015, 7.88], [x, .012, z]);
        }
        box(group, 'central-velvet-walkway', palette.velvet, [8, .025, 104], [0, .035, 152]);
        for (const x of [-4.1, 4.1]) box(group, 'carpet-gilt-border', palette.gold, [.1, .025, 104], [x, .05, 152]);
        for (const z of [110, 132, 154, 176, 198]) {
            cylinder(group, 'fourfold-medallion-border', palette.gold, 2.7, .025, [0, .07, z]);
            cylinder(group, 'fourfold-medallion', palette.dark, 2.5, .026, [0, .085, z]);
            for (let i = 0; i < 4; i++) box(group, 'fourfold-inlay', palette.gold,
                [.16, .025, 3.9], [0, .103, z]).rotation.y = i * Math.PI / 4;
        }
        for (const x of [-56, 56]) box(group, 'perimeter-balustrade', palette.stone, [.7, 1.1, 112], [x, .55, 152]);
        for (const z of [96, 208]) box(group, 'perimeter-balustrade', palette.stone, [112, 1.1, .7], [0, .55, z]);
        for (const x of [-54, 54]) for (const z of [101, 126, 152, 178, 203]) {
            collision.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y+3, z), new THREE.Vector3(1.2, 6, 1.2)));
            cylinder(group, 'fluted-column', palette.stone, .58, 6, [x, 3, z], 12);
            cylinder(group, 'column-capital', palette.gold, .9, .35, [x, 5.8, z], 12);
            box(group, 'amber-sconce', palette.light, [.55, 1, .7], [x, 4, z + .73]);
        }
        for (const x of [-32, 32]) {
            box(group, 'lounge-sofa', palette.velvet, [9, .7, 1.7], [x, .5, 101]);
            box(group, 'lounge-sofa-back', palette.wood, [9.2, 1.5, .3], [x, .8, 100.2]);
            cylinder(group, 'lounge-marble-table', palette.gold, 1.1, .7, [x, .35, 104]);
            collision.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y+.35, 104), new THREE.Vector3(2.2, .7, 2.2)));
            collision.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y+.7, 101), new THREE.Vector3(9.2, 1.5, 2)));
        }
        for (let step = 0; step < 6; step++) box(group, 'grand-stair-tread', palette.stone,
            [7, (step+1)*.25, .5], [0, (step+1)*.125, 99-step*.5]);
        group.userData.drawMeshCount = batchMeshes(group);
        group.visible = floor === 'public'; root.add(group); floors[floor] = group;
    }
    // Reuse the established humanoid rig, with a real body and readable uniform.
    const guard = createProceduralDungeonNPC(); guard.name = 'casino-vip-guard'; guard.position.set(0, 0, CASINO_INTERIOR_LAYOUT.guardZ);
    floors.public.add(guard);
    collision.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 1.65, 100), new THREE.Vector3(1.3, 3.3, 1.3)));
    const exit = box(floors.public, 'casino-interior-exit', m.gold, [6, 4, .4], [0, 2, CASINO_INTERIOR_LAYOUT.exitZ]);
    const stairs = box(floors.vip, 'casino-return-stairs', m.gold, [6, 3, .4], [0, 1.5, CASINO_INTERIOR_LAYOUT.stairsZ]);
    root.userData.floors = floors; root.userData.casinoStairs = stairs;
    root.userData.drawMeshCount = floors.public.userData.drawMeshCount + floors.vip.userData.drawMeshCount;
    root.userData.casinoGuard = guard; root.userData.casinoExit = exit;
    scene.add(root); collision.casinoInterior = true;
    return root;
}

const colors = { stone: 0x394453, dark: 0x17212d, gold: 0xb99a58, wood: 0x30231f, felt: 0x155453, velvet: 0x623647, light: 0xffcf78 };

function materials(keys = Object.keys(colors)) {
    return Object.fromEntries(keys.map(key => [key, new THREE.MeshStandardMaterial({ color: colors[key],
        roughness: key === 'gold' ? 0.35 : 0.78, metalness: key === 'gold' ? 0.7 : 0,
        emissive: key === 'light' ? colors[key] : 0, emissiveIntensity: key === 'light' ? 0.65 : 0 })]));
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
    const m = materials(['stone', 'dark', 'gold', 'wood', 'felt', 'light']);
    // Match the surrounding town's masonry and slate without changing the
    // wall footprint, door target or shared casino rooms.
    applyWorldSurfaceDetail(m.stone, 'stone');
    applyWorldSurfaceDetail(m.dark, 'slate');
    const facade = new THREE.Group(); facade.name = 'casino-exterior'; root.add(facade);
    // The town shell is only an exterior. Both full-sized gaming floors live
    // in the separate shared casino scene entered through this door.
    box(root, 'casino-floor', m.dark, [26, 0.2, 16], [0, -0.1, 0]);
    // Preserve existing walls and the five-unit door interaction opening.
    // WorldGenerator supplies its separate physical door collider.
    const walls = [
        { size: [0.5, 10.8, 16.5], position: [-13, 5.4, 0] },
        { size: [0.5, 10.8, 16.5], position: [13, 5.4, 0] },
        { size: [26.5, 10.8, 0.5], position: [0, 5.4, -8] },
        { size: [10.5, 10.8, 0.5], position: [-7.75, 5.4, 8] },
        { size: [10.5, 10.8, 0.5], position: [7.75, 5.4, 8] }
    ];
    root.userData.casinoWalls = walls;
    for (const [i, wall] of walls.entries()) {
        box(facade, `casino-wall-${i}`, m.stone, wall.size, wall.position);
        box(root, `casino-wall-base-${i}`, m.dark, [wall.size[0], 0.65, wall.size[2]], [wall.position[0], 0.325, wall.position[2]]);
    }
    addCasinoFacade(facade, m);
    for (const px of [-3.25, 3.25]) {
        box(facade, 'casino-lantern-cage', m.dark, [0.65, 1.25, 0.55], [px, 3.4, 8.6]);
        box(facade, 'casino-lantern', m.light, [0.38, 0.8, 0.6], [px, 3.4, 8.64]);
    }
    const roof = new THREE.Mesh(createCasinoHippedRoof(), m.dark);
    roof.name = 'casino-roof'; roof.position.y = 12.55;
    roof.castShadow = true; facade.add(roof);
    root.userData.casinoFacade = facade;
    // Keep the exterior separate for its own bounds and isolated door picking.
    facade.removeFromParent();
    root.userData.structureId = 'casino';
    root.userData.drawMeshCount = batchMeshes(root) + batchMeshes(facade);
    root.add(facade);
    const door = box(root, 'casino-town-door', m.wood, [4.8, 4.8, .3], [0, 2.4, 8.35]);
    // The cornice also uses wood. Hover tint must belong only to the door.
    door.material = door.material.clone();
    door.material.emissiveIntensity = .7;
    box(door, 'casino-door-handle', m.gold, [.15, .7, .2], [.7, 0, .3]);
    root.userData.casinoDoor = door;
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 180;
    const context = canvas.getContext('2d');
    if (context) {
        context.fillStyle = '#111822'; context.fillRect(0, 0, 640, 180);
        context.strokeStyle = '#d8b86b'; context.lineWidth = 4; context.strokeRect(3, 3, 634, 174);
        context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#f6df9b';
        context.font = '600 44px sans-serif'; context.fillText('LANTERNHOLD', 320, 48);
        context.font = 'bold 76px sans-serif'; context.fillText('CASINO', 320, 119);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        // A facade-mounted plaque, not a large always-on-top billboard that
        // cuts across the town view, foreground buildings and phone HUD.
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5 * 180 / 640),
            new THREE.MeshBasicMaterial({ map: texture }));
        sign.name = 'casino-nameplate'; sign.position.set(0, 6.35, 8.58);
        root.add(sign);
    }
    return root;
}

export function createCasinoFurnitureColliders(tables) {
    return tables.map(table => new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(table.x, (table.y || 0) + 1, table.z),
        new THREE.Vector3(table.game === 'slots' ? 1.55 : 2.8, 2, table.game === 'slots' ? 0.95 : 2.8)));
}

export function createCasinoFurniture(tables) {
    const root = new THREE.Group(); root.name = 'casino-furniture';
    const publicFloor = new THREE.Group(), vipFloor = new THREE.Group();
    root.add(publicFloor, vipFloor); root.userData.publicFloor = publicFloor; root.userData.vipFloor = vipFloor;
    const m = materials(); const seats = [];
    for (const table of tables) {
        const unit = new THREE.Group(); unit.name = table.id; unit.position.y = table.y || 0;
        (table.floor === 'vip' ? vipFloor : publicFloor).add(unit);
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
            if (table.game === 'roulette') {
                const wx = table.x - .5, wz = table.z - .2;
                cylinder(unit, 'roulette-brass-rim', m.gold, .79, .1, [wx, 1.42, wz], 48);
                cylinder(unit, 'roulette-wheel-bed', m.wood, .73, .08, [wx, 1.49, wz], 48);
                for (let pocket = 0; pocket < 37; pocket++) {
                    const segment = new THREE.Mesh(new THREE.RingGeometry(.37, .7, 1, 1,
                        pocket * Math.PI * 2 / 37, Math.PI * 2 / 37 * .92), pocket === 0 ? m.felt : pocket % 2 ? m.velvet : m.dark);
                    segment.name = 'roulette-pocket'; segment.rotation.x = -Math.PI / 2;
                    segment.position.set(wx, 1.54, wz); unit.add(segment);
                }
                cylinder(unit, 'roulette-spindle', m.gold, .09, .28, [wx, 1.64, wz], 12);
                for (const rotation of [0, Math.PI / 2]) box(unit, 'roulette-cross', m.gold,
                    [.045, .035, .5], [wx, 1.78, wz]).rotation.y = rotation;
                for (let row = 0; row < 6; row++) for (let column = 0; column < 3; column++) {
                    box(unit, 'roulette-betting-grid', (row+column)%2 ? m.velvet : m.dark,
                        [.15, .02, .16], [table.x+.66+column*.18, 1.37, table.z-.54+row*.19]);
                }
            } else if (table.game === 'baccarat') {
                for (const side of [-1, 1]) {
                    box(unit, side < 0 ? 'baccarat-player' : 'baccarat-banker', m.gold,
                        [.92, .015, 1.12], [table.x+side*.57, 1.36, table.z]);
                    box(unit, 'baccarat-betting-box', side < 0 ? m.dark : m.velvet,
                        [.85, .018, 1.05], [table.x+side*.57, 1.38, table.z]);
                    for (const offset of [-.15,.15]) box(unit, 'baccarat-card', m.light,
                        [.2, .02, .31], [table.x+side*.57+offset, 1.41, table.z-.22]);
                }
                cylinder(unit, 'baccarat-tie', m.gold, .24, .025, [table.x,1.4,table.z+.65], 12);
            } else {
                cylinder(unit, 'table-sigil', m.gold, 0.34, 0.015, [table.x, 1.36, table.z], 4);
            }
        }
        table.seats.forEach((seat, index) => {
            const chair = new THREE.Group(); chair.position.set(seat.x, 0, seat.z); chair.rotation.y = seat.rotation;
            chair.name = `${table.id}-seat-${index}`; chair.userData.casinoSeat = { tableId: table.id, seat: index, floor: table.floor || 'public' };
            box(chair, 'chair-cushion', m.velvet, [0.9, 0.2, 0.8], [0, 0.94, 0]);
            box(chair, 'chair-back', m.wood, [0.96, 1.15, 0.14], [0, 1.45, -0.43]);
            box(chair, 'chair-back-inset', m.velvet, [0.76, 0.8, 0.16], [0, 1.5, -0.42]);
            for (const px of [-0.36, 0.36]) for (const pz of [-0.31, 0.31]) box(chair, 'chair-leg', m.gold, [0.08, 0.9, 0.08], [px, 0.45, pz]);
            unit.add(chair); seats.push(chair);
        });
    }
    root.userData.seats = seats;
    batchMeshes(publicFloor); batchMeshes(vipFloor);
    // Picking proxies retain individual seats after visible geometry is batched.
    const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
    for (const chair of seats) {
        const proxy = box(chair, 'seat-pick-proxy', pickMaterial, [1.05, 2, 1.05], [0, 1, 0]);
        proxy.userData.casinoPickOnly = true; proxy.castShadow = false;
    }
    return root;
}

export function disposeCasinoObject(root) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root?.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) {
            materials.add(material);
            if (material.map) textures.add(material.map);
        }
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose()); root?.removeFromParent();
}
