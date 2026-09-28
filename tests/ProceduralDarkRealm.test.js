import * as THREE from 'three';
import { createDarkRealmScene, getDarkRealmCampColliders, getDarkRealmCourtColliders } from '../src/art/ProceduralDarkRealm.js';
import { DARK_REALM_COURTS, DARK_REALM_COURT_SOLIDS, DARK_REALM_PATHS } from '../src/data/darkRealmPopulation.js';
import { darkRealmChapters } from '../src/data/chronicleCatalog.js';
import { getInstanceAtlas } from '../src/ui/InstanceAtlas.js';
import { createChronicleSiteModel, getChronicleSiteColliders } from '../src/art/ChronicleSiteModels.js';
import { createWorldPathGeometry } from '../src/art/ProceduralWorldPaths.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { darkRealmFixture } from './darkRealmFixture.js';

test('expedition renders one floor union, four distinct districts and elemental camp lanterns', () => {
    const layout = darkRealmFixture(), scene = new THREE.Group();
    const before = JSON.stringify(layout);
    const collisions = new CollisionManager();
    const root = createDarkRealmScene(scene, layout, collisions);
    expect(collisions.colliders).toEqual([...getDarkRealmCampColliders(), ...getDarkRealmCourtColliders()]);
    expect(collisions.colliders).toHaveLength(22);
    for (const point of [[40000, 40800], [40012, 40800], [39988, 40800], [40000, 40814]]) {
        expect(collisions.colliders.some(box => box.clone().expandByScalar(1.3).containsPoint(new THREE.Vector3(point[0], 0, point[1])))).toBe(false);
    }
    expect(root.parent).toBe(scene);
    expect(root.position.toArray()).toEqual([40000, 0, 40800]);
    expect(JSON.stringify(layout)).toBe(before);
    const floors = root.children.filter(child => child.name === 'dark-realm-union-floor');
    expect(floors[0].material.emissiveMap).toBeNull();
    expect(floors[0].material.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(new Set(floors.map(floor => floor.material)).size).toBe(1);
    const rects = floors.map(floor => floor.userData.walkSurface);
    const area = rects.reduce((sum, r) => sum + (r.right - r.left) * (r.bottom - r.top), 0);
    expect(area).toBe(1084000);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        expect(Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)).toBe(false);
    }
    expect(new Set(root.userData.landmarks.map(p => p.kind)))
        .toEqual(new Set(['resonance-lantern', 'camp-shelter', 'shore', 'archive', 'foundry', 'city', ...DARK_REALM_COURTS.map(s => s.id)]));
    expect(root.userData.landmarks.filter(p => p.kind === 'resonance-lantern')).toHaveLength(4);
    for (const landmark of root.userData.landmarks) {
        expect(layout.walkRects.some(r => Math.abs(landmark.x - r.x) <= r.width / 2 &&
            Math.abs(landmark.z - r.z) <= r.height / 2)).toBe(['resonance-lantern', 'camp-shelter', ...DARK_REALM_COURTS.map(s => s.id)].includes(landmark.kind));
    }
    const meshes = [];
    root.traverse(node => { if (node.isMesh) meshes.push(node); });
    expect(meshes.length).toBeLessThan(50);
    for (const mesh of meshes) {
        const bounds = new THREE.Box3().setFromObject(mesh);
        expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
    }
});

test('inhabited courts keep existing records, witnesses and their mapped approaches clear', () => {
    const layout = darkRealmFixture(), solids = getDarkRealmCourtColliders();
    const atlas = getInstanceAtlas({currentInstanceId: 'dark-realm', currentInstanceType: 'dark_realm', currentDungeonLayout: layout});
    const clear = (x, z, radius = 1.3) => !solids.some(box => box.clone().expandByScalar(radius).containsPoint(new THREE.Vector3(x, 0, z)));
    for (const site of DARK_REALM_COURTS) {
        expect(clear(site.x, site.z)).toBe(true);
        for (let step = 0; step <= 30; step++) expect(clear(site.x, site.z + step)).toBe(true);
        const pin = atlas.locations.find(p => p.id === site.id);
        expect(pin).toMatchObject({x: site.arrivalX, z: site.arrivalZ, category: 'places', instanceId: 'dark-realm'});
        expect(pin.purpose).toContain('not a merchant');
    }
    for (const chapter of darkRealmChapters) for (const site of chapter.sites || []) {
        // Existing record structures occupy a roughly 7m square; scenery must
        // leave them and a generous hero approach, not merely their point, clear.
        expect(clear(site.x, site.z, 5)).toBe(true);
    }
    for (const s of DARK_REALM_COURT_SOLIDS) {
        for (const dx of [-s.width / 2, s.width / 2]) for (const dz of [-s.depth / 2, s.depth / 2])
            expect(layout.walkRects.some(r => Math.abs(s.x + dx - r.x) < r.width / 2 && Math.abs(s.z + dz - r.z) < r.height / 2)).toBe(true);
    }
});

test('missing authoritative geography cannot silently create an overworld scene', () => {
    expect(() => createDarkRealmScene(new THREE.Group(), {})).toThrow('authoritative geography');
});

test('shared street geometry stays on the actual floor and clears existing records and court solids', () => {
    const layout = darkRealmFixture(), collision = new CollisionManager();
    getDarkRealmCourtColliders().forEach(box => collision.addCollider(box));
    for (const chapter of darkRealmChapters) for (const site of chapter.sites || []) {
        const model = createChronicleSiteModel(site, 'dark'); model.mesh.position.set(site.x, 0, site.z);
        getChronicleSiteColliders(model.mesh, model.walls).forEach(box => collision.addOrientedCollider(box));
        model.dispose();
    }
    const inside = (x, z) => layout.walkRects.some(r => Math.abs(x - r.x) <= r.width / 2 && Math.abs(z - r.z) <= r.height / 2);
    for (const path of DARK_REALM_PATHS) {
        const geometry = createWorldPathGeometry(path), vertices = geometry.attributes.position;
        for (let i = 0; i < vertices.count; i++) expect({path: path.id, inside: inside(vertices.getX(i), vertices.getZ(i))}).toEqual({path: path.id, inside: true});
        geometry.dispose();
        for (let i = 1; i < path.points.length; i++) {
            const a = path.points[i - 1], b = path.points[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
            for (let step = 0; step <= steps; step++) {
                const x = a[0] + (b[0] - a[0]) * step / steps, z = a[1] + (b[1] - a[1]) * step / steps;
                expect({path: path.id, x, z, blocked: Boolean(collision.checkCollision(new THREE.Vector3(x, 0, z), path.width / 2 + 1.3))})
                    .toEqual({path: path.id, x, z, blocked: false});
            }
        }
    }
    expect(getInstanceAtlas({currentInstanceId: 'dark-realm', currentInstanceType: 'dark_realm', currentDungeonLayout: layout}).paths).toBe(DARK_REALM_PATHS);
});
