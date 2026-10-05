import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { createEarthGroundCoverTuft } from './EarthGroundCover.js';

// Two planted rest edges frame the southern service court without filling its
// centre or changing service locations. Solids are exported to the ordinary
// client collider builder and generated server landing geometry together.
export function createLanternholdStreetFurniture({ quality = 'high', cx = 0, cz = 200, multiDraw = true } = {}) {
    const group = new THREE.Group(); group.name = 'Lanternhold planted street edges';
    const materials = {
        stone: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x696658, roughness: .93 }), 'stone'),
        wood: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x47392a, roughness: .92 }), 'timber'),
        iron: new THREE.MeshStandardMaterial({ color: 0x343b3a, metalness: .65, roughness: .52 }),
        earth: new THREE.MeshStandardMaterial({ color: 0x272b20, roughness: 1 }),
        leaves: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .96 }),
        amber: new THREE.MeshStandardMaterial({ color: 0xd9ad61, emissive: 0xd79b41, emissiveIntensity: .7, roughness: .55 })
    };
    const footprints = [], cells = new Map();
    for (const side of [-1, 1]) {
        const root = new THREE.Group(); root.name = `street-rest-edge:${side}`;
        // Keep the western service approaches clear: its planter/bench sits
        // north of the forge, not across the new smithy–stash–forge lane.
        root.position.set(cx + side * 19, 0, cz + (side < 0 ? 24 : 6.5));
        root.rotation.y = side < 0 ? Math.PI : 0;
        const batches = new Map();
        const part = (geometry, key, x, y, z, rotation = [0, 0, 0], scale = 1) => {
            const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
            geometry.dispose();
            transformed.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(scale, scale, scale)));
            if (!batches.has(key)) batches.set(key, []);
            batches.get(key).push(transformed);
        };
        const box = (key, x, y, z, w, h, d) => part(new THREE.BoxGeometry(w, h, d), key, x, y, z);
        const cylinder = (key, x, y, z, top, bottom, h) => part(new THREE.CylinderGeometry(top, bottom, h, 8), key, x, y, z);
        // Actual wall courses, coping joints and recessed soil: not a solid
        // green cube. Low retains the same silhouette and collision footprint.
        box('stone', 0, .1, 0, 1.8, .2, 6.4);
        for (const x of [-.72, .72]) {
            box('stone', x, .48, 0, .24, .76, 6.1);
            for (let i = 0; i < 6; i++) box('stone', x, .89, i - 2.5, .38, .18, .97);
        }
        for (const z of [-3, 3]) {
            box('stone', 0, .48, z, 1.5, .76, .24);
            box('stone', 0, .89, z, 1.8, .18, .35);
        }
        box('earth', 0, .7, 0, 1.25, .1, 5.7);
        for (let i = 0; i < 9; i++) {
            // Compact mixed sedge/fern foliage sits inside the planter wall;
            // asymmetry comes from seeded leaves, not nondeterministic layout.
            const z = -2.4 + i * .56, x = Math.sin(i * 2.4) * .16;
            part(createEarthGroundCoverTuft(120 + i, quality), 'leaves', x, .76, z,
                [0, i * 1.3, 0], .53 + i % 3 * .07);
        }
        // Long plank bench on the court side, with braced iron legs and a
        // shallow back. The clear lane between the two assemblies is >34m.
        for (const z of [-1.45, 1.45]) {
            for (const x of [-1.68, -1.07]) box('iron', x, .45, z, .1, .9, .16);
            box('iron', -1.38, .79, z, .87, .12, .16);
            box('iron', -.99, 1.03, z, .1, 1.35, .14);
        }
        for (let i = 0; i < 3; i++) box('wood', -1.64 + i * .25, .95, 0, .22, .16, 3.55);
        for (const y of [1.25, 1.5]) box('wood', -.99, y, 0, .12, .2, 3.55);
        // The lantern is part of the planted footprint. Emissive glass only:
        // no new point-light or shadow-map workload, even on High.
        const lampZ = 2.22;
        cylinder('stone', 0, 1.02, lampZ, .33, .43, .62);
        cylinder('iron', 0, 2.85, lampZ, .065, .11, 3.2);
        for (const y of [1.48, 3.8, 4.22]) cylinder('iron', 0, y, lampZ, .17, .17, .12);
        box('iron', 0, 4.3, lampZ, .73, .13, .73);
        box('amber', 0, 4.75, lampZ, .46, .78, .46);
        for (const x of [-.29, .29]) for (const z of [-.29, .29]) box('iron', x, 4.77, lampZ + z, .065, .9, .065);
        box('iron', 0, 5.22, lampZ, .76, .12, .76);
        part(new THREE.ConeGeometry(.53, .46, 4), 'iron', 0, 5.51, lampZ, [0, Math.PI / 4, 0]);
        cylinder('iron', 0, 5.82, lampZ, .02, .09, .28);
        for (const [key, geometries] of batches) {
            const geometry = mergeGeometries(geometries, false); geometries.forEach(value => value.dispose());
            if (multiDraw) {
                if (!cells.has(key)) cells.set(key, []);
                root.updateMatrix();
                cells.get(key).push({ geometry, matrix: root.matrix.clone(), name: `${root.name}:${key}` });
            } else {
                const mesh = new THREE.Mesh(geometry, materials[key]); mesh.name = `${root.name}:${key}`;
                mesh.castShadow = !['amber', 'earth'].includes(key); mesh.receiveShadow = true;
                root.add(mesh);
            }
        }
        // Planter includes the lamp; bench is separate, so no invisible solid
        // rectangle spans the whole assembly or neighbouring walking routes.
        footprints.push({ x: root.position.x, y: 3, z: root.position.z, width: 1.8, height: 6, depth: 6.4 },
            { x: root.position.x - side * 1.38, y: .85, z: root.position.z, width: .9, height: 1.7, depth: 3.55 });
        group.add(root);
    }
    // Keep both original spatial cells rather than merging a broad town-sized
    // bound. The renderer independently culls each cell for camera and shadows,
    // with ordinary per-cell submissions when multi-draw is unavailable.
    for (const [key, entries] of cells) {
        const vertices = entries.reduce((sum, cell) => sum + cell.geometry.attributes.position.count, 0);
        const mesh = new THREE.BatchedMesh(entries.length, vertices, 0, materials[key]);
        mesh.name = `street-rest-edges:${key}`; mesh.sortObjects = false;
        mesh.userData.streetCells = entries.map(cell => {
            const geometryId = mesh.addGeometry(cell.geometry), instanceId = mesh.addInstance(geometryId);
            mesh.setMatrixAt(instanceId, cell.matrix); cell.geometry.dispose();
            return { geometryId, instanceId, name: cell.name };
        });
        mesh.computeBoundingBox(); mesh.computeBoundingSphere();
        mesh.castShadow = !['amber', 'earth'].includes(key); mesh.receiveShadow = true;
        group.add(mesh);
    }
    group.userData.walkFootprints = footprints;
    return group;
}
