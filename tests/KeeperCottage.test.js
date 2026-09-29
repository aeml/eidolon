import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createChronicleSiteModel } from '../src/art/ChronicleSiteModels.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { createKeeperGardenPlant } from '../src/art/KeeperCottage.js';

const site = chronicleInvestigations[0].sites[0];
test('keeper cottage replaces placeholder props with bounded batched construction and unchanged walls', () => {
    const model = createChronicleSiteModel(site, 'earth');
    const cottage = model.mesh.getObjectByName('Keeper cottage');
    expect(cottage.children).toHaveLength(7);
    const bounds = new THREE.Box3().setFromObject(cottage);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-3.6);
    expect(bounds.max.x).toBeLessThanOrEqual(3.6);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-3.6);
    expect(bounds.max.z).toBeLessThanOrEqual(2.6);
    expect(bounds.max.y).toBeLessThanOrEqual(2.2);
    expect(model.walls.map(box => [box.min.toArray(), box.max.toArray()])).toEqual([
        [[-3.5, -1, -3.525], [3.5, 2.2, -3.0749999999999997]],
        [[-3.525, -1, -3.0999999999999996], [-3.0749999999999997, 1.5, 1.7]],
        [[3.0749999999999997, -1, -3.1], [3.525, .85, .5]]
    ]);
    let triangles = 0;
    const disposals = [];
    for (const mesh of cottage.children) {
        expect(mesh.material.emissive.getHex()).toBe(0);
        const position = mesh.geometry.attributes.position;
        triangles += position.count / 3;
        expect([...position.array].every(Number.isFinite)).toBe(true);
        expect([...mesh.geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
        expect(mesh.geometry.attributes.color.count).toBe(position.count);
        expect(mesh.userData.entityId).toBe(site.entityId);
        disposals.push(jest.spyOn(mesh.geometry, 'dispose'), jest.spyOn(mesh.material, 'dispose'));
    }
    expect(triangles).toBeGreaterThan(2000);
    expect(triangles).toBeLessThan(10000);
    model.dispose();
    disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
});

test.each([0, 17, 39])('nursery leaves %s have finite folded geometry inside the old crop envelope', seed => {
    const geometry = createKeeperGardenPlant(seed), p = geometry.attributes.position;
    expect(p.count / 3).toBe(28);
    expect(geometry.attributes.color.count).toBe(p.count);
    expect([...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    for (let i = 0; i < p.count; i++) {
        expect(Math.hypot(p.getX(i), p.getZ(i))).toBeLessThanOrEqual(.55);
        expect(p.getY(i)).toBeGreaterThanOrEqual(0);
        expect(p.getY(i)).toBeLessThan(.35);
    }
    geometry.dispose();
});
