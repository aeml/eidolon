import * as THREE from 'three';
import { chronicleInvestigations } from '../src/data/chronicleCatalog.js';
import { createChronicleSiteModel } from '../src/art/ChronicleSiteModels.js';
import { createDarkRecordMasonry } from '../src/art/DarkRecordMasonry.js';

const kinds = ['flood_shelter', 'observatory', 'cold_kiln'];
const sites = chronicleInvestigations.filter(chapter => chapter.realm === 'dark')
    .flatMap(chapter => chapter.sites).filter(site => kinds.includes(site.model));
const walls = [
    [[-3.5, -1, -3.525], [3.5, 2.2, -3.075]],
    [[-3.525, -1, -3.1], [-3.075, 1.5, 1.7]],
    [[3.075, -1, -3.1], [3.525, .85, .5]]
];

test('bonded stone stays inside the existing footprint with shallow marker-safe paving and bounded geometry', () => {
    const geometry = createDarkRecordMasonry();
    expect(geometry.attributes.position.count / 3).toBeLessThanOrEqual(3500);
    const bounds = geometry.boundingBox;
    expect(bounds.min.x).toBeCloseTo(-3.6); expect(bounds.max.x).toBeCloseTo(3.6);
    expect(bounds.min.z).toBeCloseTo(-3.6); expect(bounds.max.z).toBeCloseTo(2.6);
    expect(bounds.max.y).toBeCloseTo(2.2);
    const position = geometry.attributes.position, normal = geometry.attributes.normal;
    let paving = 0, masonry = 0;
    for (let i = 0; i < position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(position, i);
        expect(p.toArray().every(Number.isFinite)).toBe(true);
        expect(new THREE.Vector3().fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 5);
        // The middle of the room remains a shallow floor, not a new pedestal.
        if (Math.abs(p.x) < 3 && p.z > -3 && p.y < .05) paving++;
        else if (p.y > .05) {
            expect(walls.some(([min, max]) => p.x >= min[0] - 1e-5 && p.x <= max[0] + 1e-5 &&
                p.y <= max[1] + 1e-5 && p.z >= min[2] - 1e-5 && p.z <= max[2] + 1e-5)).toBe(true);
            masonry++;
        }
    }
    expect(paving).toBeGreaterThan(100); expect(masonry).toBeGreaterThan(1000);
    geometry.dispose();
});

test.each(sites)('$id preserves discovery identity, exact wall colliders and owned resource disposal', site => {
    const model = createChronicleSiteModel(site, 'dark');
    const masonry = model.mesh.getObjectByName('Dark record masonry');
    expect(masonry).toBeDefined();
    expect(masonry.material.vertexColors).toBe(true);
    expect(masonry.material.customProgramCacheKey()).toContain('fieldstone');
    expect(model.walls).toHaveLength(3);
    model.walls.forEach((wall, index) => {
        wall.min.toArray().forEach((n, axis) => expect(n).toBeCloseTo(walls[index][0][axis]));
        wall.max.toArray().forEach((n, axis) => expect(n).toBeCloseTo(walls[index][1][axis]));
    });
    const geometries = new Set(), materials = new Set();
    model.mesh.traverse(part => {
        expect(part.userData.entityId).toBe(site.entityId);
        if (part.geometry) geometries.add(part.geometry);
        if (part.material) materials.add(part.material);
    });
    const counts = [];
    for (const resource of [...geometries, ...materials]) {
        let disposed = 0;
        resource.addEventListener('dispose', () => disposed++);
        counts.push(() => disposed);
    }
    const other = createChronicleSiteModel(site, 'dark');
    expect(other.mesh.getObjectByName('Dark record masonry').geometry).not.toBe(masonry.geometry);
    expect(other.mesh.getObjectByName('Dark record masonry').material).not.toBe(masonry.material);
    model.dispose();
    expect(counts.every(count => count() === 1)).toBe(true);
    other.dispose();
});

test('furnishings match the existing record purpose and fit within the old room envelope', () => {
    expect(sites).toHaveLength(14);
    for (const site of sites.filter(site => site.model !== 'cold_kiln')) {
        const model = createChronicleSiteModel(site, 'dark');
        const furniture = model.mesh.children.filter(part => part.name.startsWith('Dark record furnishings:'));
        expect(furniture.length).toBeGreaterThan(0); expect(furniture.length).toBeLessThanOrEqual(3);
        expect(furniture.reduce((sum, part) => sum + part.geometry.attributes.position.count / 3, 0)).toBeLessThan(1000);
        for (const part of furniture) {
            const bounds = part.geometry.boundingBox;
            expect(bounds.min.x).toBeGreaterThanOrEqual(-3.1);
            expect(bounds.max.x).toBeLessThanOrEqual(3.1);
            expect(bounds.min.z).toBeGreaterThanOrEqual(-3.075);
            // The existing mooring rings extend beyond their Z1.6 posts; the
            // original floor ends at Z2.6. Compare float32 geometry to the same
            // float32 envelope instead of rejecting harmless representation.
            expect(bounds.max.z).toBeLessThanOrEqual(Math.fround(2.6));
            expect(bounds.max.y).toBeLessThanOrEqual(Math.fround(2.7));
        }
        model.dispose();
    }
});

test.each(['earth', 'water', 'fire', 'air'])('%s keeps its own existing investigation architecture', realm => {
    for (const kind of kinds) {
        const site = chronicleInvestigations.filter(chapter => chapter.realm === realm)
            .flatMap(chapter => chapter.sites).find(site => site.model === kind);
        if (!site) continue;
        const model = createChronicleSiteModel(site, realm);
        expect(model.mesh.getObjectByName('Dark record masonry')).toBeUndefined();
        expect(model.mesh.children.some(part => part.name.startsWith('Dark record furnishings:'))).toBe(false);
        model.dispose();
    }
});
