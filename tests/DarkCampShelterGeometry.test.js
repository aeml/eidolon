import * as THREE from 'three';
import { createDarkCampShelterGeometry } from '../src/art/DarkCampShelterGeometry.js';
import { createDarkRealmScene, getDarkRealmCampColliders } from '../src/art/ProceduralDarkRealm.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { darkRealmFixture } from './darkRealmFixture.js';

test.each([['high', 700], ['low', 300]])('%s fabric has finite outward faces and stays inside its existing solid', (quality, limit) => {
    const geometry = createDarkCampShelterGeometry(quality);
    try {
        const p = geometry.attributes.position, n = geometry.attributes.normal, index = geometry.index;
        expect(index.count / 3).toBeLessThan(limit);
        let finite = true, minimumArea = Infinity;
        for (let i = 0; i < p.count; i++) finite &&= [p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite) && Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5;
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = 0; i < index.count; i += 3) {
            a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2));
            minimumArea = Math.min(minimumArea, b.sub(a).cross(c.sub(a)).length() / 2);
        }
        expect(finite).toBe(true); expect(minimumArea).toBeGreaterThan(.001);
        const solid = getDarkRealmCampColliders({ x: 0, z: 0 })[4].clone(); solid.translate(new THREE.Vector3(22, 0, -12));
        expect(solid.containsBox(geometry.boundingBox)).toBe(true);
        expect(geometry.boundingBox.min.y).toBeCloseTo(.1, 5); expect(geometry.boundingBox.max.y).toBeLessThan(4.9);
        expect(geometry.attributes.color.count).toBe(p.count); expect(geometry.attributes.uv.count).toBe(p.count);
        // The center seam remains a closed opaque supply tent, not an implied
        // walk-through doorway at odds with the unchanged server collision.
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
        for (const y of [.3, 1, 1.9]) for (const [origin, direction] of [
            [[0, y, 8], [0, 0, -1]], [[0, y, -8], [0, 0, 1]], [[8, y, 0], [-1, 0, 0]], [[-8, y, 0], [1, 0, 0]]
        ]) expect(new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction)).intersectObject(mesh)[0]?.distance).toBeLessThan(5);
        for (const x of [-2, 0, 2]) expect(new THREE.Raycaster(new THREE.Vector3(x, 8, 0), new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0]?.point.y).toBeGreaterThan(2.1);
        mesh.material.dispose();
    } finally { geometry.dispose(); }
});

test.each(['high', 'low'])('%s shelters share one opaque canvas batch and add no maps', quality => {
    const root = createDarkRealmScene(new THREE.Group(), darkRealmFixture(), null, { quality });
    try {
        const canvas = root.getObjectByName('expedition-canvas-shelter');
        expect(canvas).toBeDefined(); expect(root.children.filter(n => n.material === canvas.material)).toHaveLength(1);
        expect(canvas.material.vertexColors).toBe(true); expect(canvas.material.transparent).toBe(false);
        expect(canvas.material.side).toBe(THREE.FrontSide); expect(canvas.material.userData.worldSurfaceDetail).toBe('canvas');
        expect(['map', 'normalMap', 'roughnessMap'].map(key => canvas.material[key])).toEqual([null, null, null]);
        expect(canvas.geometry.attributes.color.count).toBe(canvas.geometry.attributes.position.count);
        expect(root.userData.landmarks.filter(s => s.kind === 'camp-shelter')).toHaveLength(2);
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, root); }
});
