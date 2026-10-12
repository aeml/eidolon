import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildDungeonSurfaceUnion } from '../world/dungeonSurfaceUnion.js';
import { DUNGEON_FLOOR_TEXTURE_SPAN } from './ProceduralDungeonInteriors.js';
import { DARK_REALM_COURTS, DARK_REALM_COURT_SOLIDS, DARK_REALM_PATHS } from '../data/darkRealmPopulation.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { createWorldPathNetwork } from './ProceduralWorldPaths.js';
import { createDarkRealmStreetMaterial } from './DarkRealmStreetSurface.js';
import { createDarkCampShelterGeometry } from './DarkCampShelterGeometry.js';
import { createDarkCampLanternGeometry } from './DarkCampLanternGeometry.js';
import { createDarkDistrictArchitectureGeometry } from './DarkDistrictArchitectureGeometry.js';
import { createDarkCourtWorkbenchGeometry, createDarkCourtStandardGeometry } from './DarkCourtFurnitureGeometry.js';

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

export function getDarkRealmCourtColliders() {
    return DARK_REALM_COURT_SOLIDS.map(s => new THREE.Box3(
        new THREE.Vector3(s.x - s.width / 2, -1, s.z - s.depth / 2),
        new THREE.Vector3(s.x + s.width / 2, s.height, s.z + s.depth / 2)));
}

// An open-air expedition, not another sequence of enclosed boss rooms. District
// silhouettes stay outside the floors; camp solids have shared walk colliders.
export function createDarkRealmScene(scene, layout, collisionManager = null, { quality = 'high' } = {}) {
    if (!layout?.rooms?.length || !layout?.walkRects?.length) throw new Error('Dark Realm requires authoritative geography');
    const root = new THREE.Group();
    root.name = 'dark-realm-expedition';
    const origin = layout.rooms[0];
    root.position.set(origin.x, 0, origin.z);
    const paths = createWorldPathNetwork(DARK_REALM_PATHS, {name: 'Dark Realm', color: [124, 115, 121]});
    paths.position.set(-origin.x, .085, -origin.z);
    root.add(paths);
    getDarkRealmCampColliders(origin).forEach(box => collisionManager?.addCollider(box));
    getDarkRealmCourtColliders().forEach(box => collisionManager?.addCollider(box));
    const floorMaterial = createDarkRealmStreetMaterial(quality);
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

    const stone = applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x44414b, roughness: .9 }), 'stone');
    const bronze = new THREE.MeshStandardMaterial({ color: 0x84755c, metalness: .55, roughness: .6 });
    const shadow = new THREE.MeshStandardMaterial({ color: 0x171925, roughness: .9 });
    const palettes = [0x9bd5d2, 0x8aafc1, 0xc2a6db, 0xe8a475, 0x9c8fce];
    const batches = new Map();
    const append = (material, geometry, position) => {
        geometry.translate(...position);
        const parts = batches.get(material) || [];
        parts.push(geometry); batches.set(material, parts);
    };
    const block = (material, size, position, angle = 0) => {
        const geometry = new THREE.BoxGeometry(...size).toNonIndexed();
        geometry.rotateY(angle); append(material, geometry, position);
    };
    const tie = (a, b) => {
        const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
        const geometry = new THREE.CylinderGeometry(.022, .022, delta.length(), quality === 'low' ? 4 : 6).toNonIndexed();
        geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
        append(bronze, geometry, from.add(to).multiplyScalar(.5).toArray());
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
    // Inhabited-scale spaces within the real districts. These complement, not
    // replace, the distant skyline and the original discovery models.
    const paper = new THREE.MeshStandardMaterial({ color: 0xa69b89, roughness: 1, vertexColors: true });
    const cloth = applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x71687e, roughness: 1, vertexColors: true }), 'canvas');
    const timber = applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x695344, roughness: .92 }), 'timber');
    const courtMaterials = { stone, bronze, shadow, paper, cloth, timber };
    for (const site of DARK_REALM_COURTS) {
        const x = site.x - origin.x, z = site.z - origin.z;
        // Broken paving inlays stay below ankle height; not extra walk floors.
        for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
            block(bronze, [.25, .02, 1.7], [x + side * 5, .125, z + 3 + i * 3]);
            block(stone, [3, .08, 1.5], [x + side * 9, .15, z + 11 + i * 1.7]);
        }
        root.userData.landmarks.push({ kind: `court-${site.recipe}`, x: site.arrivalX, z: site.arrivalZ });
    }
    for (const solid of DARK_REALM_COURT_SOLIDS) {
        const x = solid.x - origin.x, z = solid.z - origin.z;
        const parts = solid.kind === 'standard' ? createDarkCourtStandardGeometry(solid.recipe, quality) :
            createDarkCourtWorkbenchGeometry(solid.recipe, quality);
        for (const [key, geometry] of Object.entries(parts)) append(courtMaterials[key], geometry, [x, 0, z]);
    }
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
                    emissive: [0x8bb96b, 0x70bcd8, 0xe99663, 0xb9a9ed][i], emissiveIntensity: .55, roughness: .42 });
                elemental.userData.darkRealmLanternCore = true;
                const lantern = createDarkCampLanternGeometry(quality);
                append(stone, lantern.stone, [px, 0, pz]);
                append(bronze, lantern.metal, [px, 0, pz]);
                append(elemental, lantern.core, [px, 0, pz]);
                root.userData.landmarks.push({ kind: 'resonance-lantern', x: px + origin.x, z: pz + origin.z });
            }
            const canvas = applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({
                color: 0x687c80, roughness: .94, vertexColors: true
            }), 'canvas');
            canvas.userData.darkRealmShelterCanvas = true;
            for (const [sx, sz] of CAMP_SHELTERS) {
                const px = x + sx, pz = z + sz;
                const fabric = createDarkCampShelterGeometry(quality);
                append(canvas, fabric.toNonIndexed(), [px, 0, pz]); fabric.dispose();
                block(bronze, [.11, .1, 2.9], [px, 4.74, pz]);
                for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
                    block(bronze, [.1, 2.15, .1], [px + dx * 3.21, 1.175, pz + dz * 3.21]);
                    block(bronze, [.065, .28, .065], [px + dx * 3.3, .24, pz + dz * 3.3]);
                    tie([px + dx * 3.2, 2.15, pz + dz * 3.2], [px + dx * 3.3, .2, pz + dz * 3.3]);
                }
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
            const recipe = ['camp', 'shore', 'archive', 'foundry', 'city'][index];
            const architecture = createDarkDistrictArchitectureGeometry(recipe, quality);
            for (const [key, geometry] of Object.entries(architecture)) {
                geometry.rotateY(-side * Math.PI / 2);
                append({ stone, bronze, shadow, glow }[key], geometry, [px, 0, pz]);
            }
            root.userData.landmarks.push({ kind: ['camp', 'shore', 'archive', 'foundry', 'city'][index],
                x: px + origin.x, z: pz + origin.z });
        }
    }
    for (const [material, geometries] of batches) {
        const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
        mesh.name = material.userData.darkRealmLanternCore ? 'dark-realm-resonance-core' :
            material.userData.darkRealmShelterCanvas ? 'expedition-canvas-shelter' : 'dark-realm-scenery-batch';
        mesh.castShadow = true; mesh.receiveShadow = true;
        root.add(mesh);
        geometries.forEach(geometry => geometry.dispose());
    }
    scene.add(root);
    return root;
}
