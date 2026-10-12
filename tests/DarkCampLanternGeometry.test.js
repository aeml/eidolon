import * as THREE from 'three';
import { createDarkCampLanternGeometry } from '../src/art/DarkCampLanternGeometry.js';
import { createDarkRealmScene, getDarkRealmCampColliders } from '../src/art/ProceduralDarkRealm.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { darkRealmFixture } from './darkRealmFixture.js';

test.each([['high', 900], ['low', 650]])('%s lantern construction fits the authoritative solid and supports its core', (quality, limit) => {
    const parts = createDarkCampLanternGeometry(quality), bounds = new THREE.Box3();
    try {
        let count = 0, minimumArea = Infinity, finite = true;
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (const geometry of Object.values(parts)) {
            bounds.union(geometry.boundingBox);
            const p = geometry.attributes.position, n = geometry.attributes.normal;
            count += p.count / 3;
            for (let i = 0; i < p.count; i++) finite &&= [p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite) && Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5;
            for (let i = 0; i < p.count; i += 3) {
                a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
                minimumArea = Math.min(minimumArea, b.sub(a).cross(c.sub(a)).length() / 2);
            }
        }
        const solid = getDarkRealmCampColliders({ x: 0, z: 0 })[0].clone(); solid.translate(new THREE.Vector3(24, 0, 24));
        expect(solid.containsBox(bounds)).toBe(true); expect(count).toBeLessThan(limit);
        expect(finite).toBe(true); expect(minimumArea).toBeGreaterThan(1e-5);
        const material = new THREE.MeshBasicMaterial();
        try {
            const meshes = Object.values(parts).map(geometry => new THREE.Mesh(geometry, material));
            // Stone, tapered shaft, bowl, core and roof must meet vertically.
            for (const y of [.2, .6, 1, 1.1, 2, 3.5, 4.1, 4.25, 4.5, 5, 5.35, 5.6, 5.85]) {
                expect(new THREE.Raycaster(new THREE.Vector3(0, y, 3), new THREE.Vector3(0, 0, -1)).intersectObjects(meshes).length).toBeGreaterThan(0);
            }
            expect(parts.core.boundingBox.min.y).toBeGreaterThan(4.3);
            expect(parts.core.boundingBox.max.y).toBeLessThan(5.34);
        } finally { material.dispose(); }
    } finally { Object.values(parts).forEach(geometry => geometry.dispose()); }
});

test.each(['high', 'low'])('%s expedition retains four opaque elemental cores without lights or new maps', quality => {
    const root = createDarkRealmScene(new THREE.Group(), darkRealmFixture(), null, { quality });
    try {
        const cores = root.children.filter(mesh => mesh.name === 'dark-realm-resonance-core');
        expect(cores).toHaveLength(4);
        expect(cores.map(mesh => mesh.material.emissive.getHex())).toEqual([0x8bb96b, 0x70bcd8, 0xe99663, 0xb9a9ed]);
        for (const { material } of cores) {
            expect(material.transparent).toBe(false); expect(material.side).toBe(THREE.FrontSide);
            expect(['map', 'normalMap', 'roughnessMap'].map(key => material[key])).toEqual([null, null, null]);
        }
        let lights = 0; root.traverse(node => { if (node.isLight) lights++; }); expect(lights).toBe(0);
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, root); }
});
