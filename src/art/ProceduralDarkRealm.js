import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildDungeonSurfaceUnion } from '../world/dungeonSurfaceUnion.js';
import { createProceduralDungeonInteriorKit, DUNGEON_FLOOR_TEXTURE_SPAN } from './ProceduralDungeonInteriors.js';

// An open-air expedition, not another sequence of enclosed boss rooms. All
// solid scenery stays beyond authoritative floors; streets remain unobstructed.
export function createDarkRealmScene(scene, layout) {
    if (!layout?.rooms?.length || !layout?.walkRects?.length) throw new Error('Dark Realm requires authoritative geography');
    const root = new THREE.Group();
    root.name = 'dark-realm-expedition';
    const origin = layout.rooms[0];
    root.position.set(origin.x, 0, origin.z);
    const kit = createProceduralDungeonInteriorKit('umbral_nexus');
    const floorMaterial = kit.floorMaterial(DUNGEON_FLOOR_TEXTURE_SPAN, DUNGEON_FLOOR_TEXTURE_SPAN);
    const { floors, walls } = buildDungeonSurfaceUnion(layout.walkRects);
    for (const rect of floors) {
        const x = (rect.left + rect.right) / 2 - origin.x;
        const z = (rect.top + rect.bottom) / 2 - origin.z;
        const geometry = new THREE.PlaneGeometry(rect.right - rect.left, rect.bottom - rect.top);
        const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) uv.setXY(i,
            (positions.getX(i) + x) / DUNGEON_FLOOR_TEXTURE_SPAN,
            (positions.getY(i) - z) / DUNGEON_FLOOR_TEXTURE_SPAN);
        const floor = new THREE.Mesh(geometry, floorMaterial);
        floor.name = 'dark-realm-union-floor';
        floor.userData.walkSurface = { ...rect };
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(x, .1, z);
        floor.receiveShadow = true;
        root.add(floor);
    }

    const stone = new THREE.MeshStandardMaterial({ color: 0x343342, roughness: .86 });
    const bronze = new THREE.MeshStandardMaterial({ color: 0x84755c, metalness: .55, roughness: .6 });
    const shadow = new THREE.MeshStandardMaterial({ color: 0x171925, roughness: .9 });
    const palettes = [0x9bd5d2, 0x8aafc1, 0xc2a6db, 0xe8a475, 0x9c8fce];
    const batches = new Map();
    const block = (material, size, position, angle = 0) => {
        const geometry = new THREE.BoxGeometry(...size).toNonIndexed();
        geometry.rotateY(angle);
        geometry.translate(...position);
        const parts = batches.get(material) || [];
        parts.push(geometry); batches.set(material, parts);
    };
    // Low broken quay edges outline the void without tall foreground walls.
    for (const wall of walls) {
        const alongX = wall.axis === 'x';
        const middle = (wall.start + wall.end) / 2;
        const outside = wall.at + wall.normal * 1.5;
        block(stone, alongX ? [wall.end - wall.start, 1.8, 2] : [2, 1.8, wall.end - wall.start],
            [ (alongX ? middle : outside) - origin.x, -.8, (alongX ? outside : middle) - origin.z ]);
    }

    root.userData.landmarks = [];
    for (const [index, room] of layout.rooms.entries()) {
        const x = room.x - origin.x, z = room.z - origin.z;
        // Thin inlaid processional lines are decoration, not a second floor.
        for (const side of [-1, 1]) {
            block(bronze, [1, .025, room.height - 20], [x + side * 15, .13, z]);
        }
        if (index === 0) {
            for (const [i, offset] of [[-1, -1], [1, -1], [1, 1], [-1, 1]].entries()) {
                const px = x + offset[0] * (room.width / 2 + 10);
                const pz = z + offset[1] * (room.height / 2 + 10);
                const elemental = new THREE.MeshStandardMaterial({ color: [0x8bb96b, 0x70bcd8, 0xe99663, 0xb9a9ed][i],
                    emissive: [0x8bb96b, 0x70bcd8, 0xe99663, 0xb9a9ed][i], emissiveIntensity: .9 });
                block(stone, [8, 3, 8], [px, 1.5, pz]);
                block(bronze, [2, 12, 2], [px, 9, pz]);
                block(elemental, [4, 6, 4], [px, 18, pz], Math.PI / 4);
                root.userData.landmarks.push({ kind: 'resonance-lantern', x: px + origin.x, z: pz + origin.z });
            }
            continue;
        }
        const glow = new THREE.MeshStandardMaterial({ color: palettes[index] || palettes[4],
            emissive: palettes[index] || palettes[4], emissiveIntensity: .65, roughness: .5 });
        // District silhouettes sit outside the floor, leaving clear roads and
        // space for authored investigation sites and real encounter actors.
        for (const side of [-1, 1]) for (const offset of [-160, -80, 80, 160]) {
            const px = x + side * (room.width / 2 + 22), pz = z + offset;
            const height = index === 4 ? 42 : index === 3 ? 28 : 20;
            block(stone, [24, height, 28], [px, height / 2 - 2, pz]);
            block(shadow, [28, 3, 32], [px, height - 1, pz]);
            for (const windowZ of [-7, 7]) block(glow, [1, 7, 4], [px - side * 12.1, height * .65, pz + windowZ]);
            if (index === 1) {
                // Broken mooring spars on the nameless shore.
                block(bronze, [2, 28, 2], [px, 23, pz], .2);
                block(shadow, [16, 2, 3], [px, 30, pz]);
            } else if (index === 2) {
                // Archive stacks: gilt bindings on monumental sealed volumes.
                for (let tier = 0; tier < 3; tier++) block(bronze, [26, 1, 30], [px, 5 + tier * 6, pz]);
            } else if (index === 3) {
                // Foundry exhaust and glowing resonance conduits.
                block(shadow, [8, 30, 8], [px + side * 5, 35, pz]);
                block(glow, [4, 1, 26], [px, 28, pz]);
            } else {
                // The king's crown repeats across a city frozen in one morning.
                for (const tooth of [-8, 0, 8]) block(bronze, [3, 8, 3], [px + tooth, height + 5, pz]);
            }
            root.userData.landmarks.push({ kind: ['camp', 'shore', 'archive', 'foundry', 'city'][index],
                x: px + origin.x, z: pz + origin.z });
        }
    }
    for (const [material, geometries] of batches) {
        const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
        mesh.name = 'dark-realm-scenery-batch';
        mesh.castShadow = true; mesh.receiveShadow = true;
        root.add(mesh);
        geometries.forEach(geometry => geometry.dispose());
    }
    scene.add(root);
    return root;
}
