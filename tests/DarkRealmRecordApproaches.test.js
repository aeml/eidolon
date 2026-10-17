import { darkRealmChapters } from '../src/data/chronicleCatalog.js';
import * as THREE from 'three';
import { DARK_REALM_PATHS, DARK_REALM_MAIN_PATHS } from '../src/data/darkRealmPopulation.js';
import { DARK_REALM_RECORD_APPROACHES } from '../src/data/darkRealmRecordApproaches.js';
import { createDarkRealmScene } from '../src/art/ProceduralDarkRealm.js';
import { createWorldPathGeometry } from '../src/art/ProceduralWorldPaths.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { darkRealmFixture } from './darkRealmFixture.js';

function distanceToStreet(point, paths) {
    let nearest = Infinity;
    for (const path of paths) for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1], b = path.points[i];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz)));
        nearest = Math.min(nearest, Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz));
    }
    return nearest;
}

test('every existing Dark Realm record has a street approach outside its discovery model', () => {
    // The public streets stop on the open side of each record, as the existing
    // witness approaches do. They do not auto-inspect or grant a safe route.
    const missing = darkRealmChapters.flatMap(chapter => chapter.sites || [])
        .filter(site => distanceToStreet([site.x, site.z + 12], DARK_REALM_PATHS) > 4)
        .map(site => site.id);
    expect(missing).toEqual([]);
});

test('record approaches connect to original streets and identify existing records without duplicates', () => {
    const sites = new Map(darkRealmChapters.flatMap(chapter => chapter.sites || []).map(site => [site.id, site]));
    expect(new Set(DARK_REALM_PATHS.map(path => path.id)).size).toBe(DARK_REALM_PATHS.length);
    expect(new Set(DARK_REALM_RECORD_APPROACHES.map(path => path.siteId)).size).toBe(DARK_REALM_RECORD_APPROACHES.length);
    for (const path of DARK_REALM_RECORD_APPROACHES) {
        const site = sites.get(path.siteId);
        expect(site).toBeDefined();
        expect(path.points.at(-1)).toEqual([site.x, site.z + 12]);
        expect(distanceToStreet(path.points[0], DARK_REALM_MAIN_PATHS)).toBeLessThan(.02);
        expect(DARK_REALM_MAIN_PATHS.some(street => street.id === path.streetId)).toBe(true);
    }
});

test('district street batches retain every authored ribbon without increasing mesh or material count', () => {
    const root = createDarkRealmScene(new THREE.Group(), darkRealmFixture(), null, { quality: 'low' });
    const paths = root.getObjectByName('Dark Realm authored paths');
    const rows = geometry => {
        const position = geometry.attributes.position, uv = geometry.attributes.uv;
        return Array.from({ length: position.count }, (_, i) =>
            [position.getX(i), position.getY(i), position.getZ(i), uv.getX(i), uv.getY(i)].join(','));
    };
    try {
        expect(paths.children).toHaveLength(DARK_REALM_MAIN_PATHS.length);
        expect(new Set(paths.children.map(mesh => mesh.material)).size).toBe(1);
        const expected = [], actual = []; let expectedIndices = 0, actualIndices = 0;
        for (const path of DARK_REALM_PATHS) {
            const geometry = createWorldPathGeometry(path);
            expected.push(...rows(geometry)); expectedIndices += geometry.index.count; geometry.dispose();
        }
        for (const mesh of paths.children) {
            actual.push(...rows(mesh.geometry)); actualIndices += mesh.geometry.index.count;
            expect(mesh.renderOrder).toBe(-.5); expect(mesh.material.depthTest).toBe(true);
        }
        expect(actual.sort()).toEqual(expected.sort()); expect(actualIndices).toBe(expectedIndices);
        for (const path of DARK_REALM_RECORD_APPROACHES) {
            const street = paths.children.find(mesh => mesh.userData.worldPathId === path.streetId);
            expect(street.userData.worldPathIds).toContain(path.id);
        }
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, root); }
});
