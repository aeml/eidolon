import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createChronicleSiteModel } from '../src/art/ChronicleSiteModels.js';
import { createScarStandingStone, createReturningScarClue } from '../src/art/ReturningScar.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';

const sites = chronicleInvestigations.find(chapter => chapter.id === 'chronicle_earth_returning_scar').sites;
test.each(sites)('$model retains investigation ownership and bounds without a display plinth or new walls', site => {
    const model = createChronicleSiteModel(site, 'earth');
    const clue = model.mesh.getObjectByName(`Returning scar:${site.model}`);
    expect(clue).toBeDefined();
    expect(model.walls).toEqual([]);
    expect(clue.children.length).toBeLessThanOrEqual(4);
    const disposals = [], faces = [];
    let triangles = 0;
    clue.traverse(mesh => {
        if (!mesh.isMesh) return;
        faces.push(mesh.name);
        expect(mesh.userData.entityId).toBe(site.entityId);
        const p = mesh.geometry.attributes.position;
        triangles += p.count / 3;
        expect([...p.array].every(Number.isFinite)).toBe(true);
        expect([...mesh.geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
        expect(mesh.geometry.attributes.uv.count).toBe(p.count);
        expect(mesh.geometry.attributes.color.count).toBe(p.count);
        expect(mesh.material.transparent).toBe(false);
        expect(mesh.material.emissiveIntensity).toBeLessThanOrEqual(1);
        for (let i = 0; i < p.count; i++) {
            expect(Math.hypot(p.getX(i), p.getZ(i))).toBeLessThan(2.2);
            expect(p.getY(i)).toBeLessThan(2.8);
            expect(p.getY(i)).toBeGreaterThan(-.05);
        }
        disposals.push(jest.spyOn(mesh.geometry, 'dispose'), jest.spyOn(mesh.material, 'dispose'));
    });
    expect(triangles).toBeLessThan(5000);
    if (site.model === 'root_memory') expect(faces).toContain('root_memory:grain');
    if (site.model === 'root_growth') expect(faces).toContain('root_growth:leaves');
    if (site.model === 'command_stone') expect(faces).toContain('command_stone:seal');
    model.dispose(); disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
});

test('five boundary slabs remain inside the historical horizontal solid footprint', () => {
    for (let seed = 0; seed < 5; seed++) {
        const geometry = createScarStandingStone(seed);
        geometry.computeBoundingBox();
        const b = geometry.boundingBox;
        expect(b.min.x).toBeGreaterThanOrEqual(-.75); expect(b.max.x).toBeLessThanOrEqual(.75);
        expect(b.min.z).toBeGreaterThanOrEqual(-.75); expect(b.max.z).toBeLessThanOrEqual(.75);
        expect(b.min.y).toBeGreaterThanOrEqual(-.001); expect(b.max.y).toBeLessThan(2.71);
        expect([...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
        geometry.dispose();
    }
});

test('clue generation rejects unrelated models and is deterministic', () => {
    expect(() => createReturningScarClue('tide_lens')).toThrow('Unknown grove clue');
    const a = createScarStandingStone(2), b = createScarStandingStone(2);
    expect(a.attributes.position.array).toEqual(b.attributes.position.array);
    expect(a.attributes.color.array).toEqual(b.attributes.color.array);
    a.dispose(); b.dispose();
});
