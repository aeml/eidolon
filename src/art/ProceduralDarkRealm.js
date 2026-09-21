import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildDungeonSurfaceUnion } from '../world/dungeonSurfaceUnion.js';
import { DUNGEON_FLOOR_TEXTURE_SPAN } from './ProceduralDungeonInteriors.js';

const CAMP_LANTERNS = [[-24, -24], [24, -24], [24, 24], [-24, 24]];
const CAMP_SHELTERS = [[-22, 12], [22, 12]];

// The same footprints feed ordinary walking and generated admin landings.
// Canvas shelters are closed supplies/sleeping tents, not walk-through rooms.
export function getDarkRealmCampColliders(origin = { x: 40000, z: 40800 }) {
    return [...CAMP_LANTERNS.map(([x, z]) => [x, z, 1.1, 1.1, 6]),
        ...CAMP_SHELTERS.map(([x, z]) => [x, z, 3.4, 3.4, 5])]
        .map(([x, z, hx, hz, height]) => new THREE.Box3(
            new THREE.Vector3(origin.x + x - hx, -1, origin.z + z - hz),
            new THREE.Vector3(origin.x + x + hx, height, origin.z + z + hz)));
}

// Streets should support readable actors and discoveries, not repeat the
// Nexus's luminous fracture pattern across an entire outdoor district.
function expeditionStoneTexture() {
    const size = 128, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const row = Math.floor(y / 16), shifted = (x + (row % 2) * 16) % size;
        const column = Math.floor(shifted / 32), u = shifted % 32, v = y % 16;
        const joint = u < 1 || v < 1;
        const edge = u === 1 || v === 1;
        const grain = ((x * 17 + y * 29 + x * y * 3) % 7) - 3;
        const shade = joint ? -14 : (edge ? 5 : 0) + ((row * 13 + column * 7) % 11) - 5 + grain;
        const index = (y * size + x) * 4;
        pixels.set([77 + shade, 74 + shade, 87 + shade, 255], index);
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
}

// An open-air expedition, not another sequence of enclosed boss rooms. District
// silhouettes stay outside the floors; camp solids have shared walk colliders.
export function createDarkRealmScene(scene, layout, collisionManager = null) {
    if (!layout?.rooms?.length || !layout?.walkRects?.length) throw new Error('Dark Realm requires authoritative geography');
    const root = new THREE.Group();
    root.name = 'dark-realm-expedition';
    const origin = layout.rooms[0];
    root.position.set(origin.x, 0, origin.z);
    getDarkRealmCampColliders(origin).forEach(box => collisionManager?.addCollider(box));
    const floorMaterial = new THREE.MeshStandardMaterial({ map: expeditionStoneTexture(), roughness: .96 });
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
            for (const [i, offset] of CAMP_LANTERNS.entries()) {
                const px = x + offset[0], pz = z + offset[1];
                const elemental = new THREE.MeshStandardMaterial({ color: [0x8bb96b, 0x70bcd8, 0xe99663, 0xb9a9ed][i],
                    emissive: [0x8bb96b, 0x70bcd8, 0xe99663, 0xb9a9ed][i], emissiveIntensity: .9 });
                block(stone, [2.2, 1.2, 2.2], [px, .6, pz]);
                block(bronze, [.4, 3.4, .4], [px, 2.9, pz]);
                block(elemental, [1.2, 1.6, 1.2], [px, 5, pz], Math.PI / 4);
                root.userData.landmarks.push({ kind: 'resonance-lantern', x: px + origin.x, z: pz + origin.z });
            }
            const canvas = new THREE.MeshStandardMaterial({ color: 0x587c83, roughness: .94 });
            for (const [sx, sz] of CAMP_SHELTERS) {
                const px = x + sx, pz = z + sz;
                block(canvas, [6.4, 2, 6.4], [px, 1.1, pz]);
                block(shadow, [1.8, 1.8, .03], [px, 1, pz + 3.22]);
                block(bronze, [6.45, .1, 6.45], [px, 2.13, pz]);
                for (const side of [-1, 1]) block(bronze, [.08, 1.9, .04], [px + side * 1, 1.05, pz + 3.24]);
                const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 4.6, 2.8, 4, 1, false, Math.PI / 4), canvas);
                roof.position.set(px, 3.5, pz);
                roof.name = 'expedition-canvas-shelter';
                roof.castShadow = true;
                root.add(roof);
                for (const side of [-1, 1]) block(bronze, [.14, 2.3, .14], [px + side * 3.2, 1.15, pz + 3.2]);
                root.userData.landmarks.push({ kind: 'camp-shelter', x: px + origin.x, z: pz + origin.z });
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
