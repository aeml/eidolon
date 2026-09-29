import * as THREE from 'three';
import { jest } from '@jest/globals';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';
import { createProceduralProjectileImpactEffect, PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS } from '../src/art/ProceduralProjectileImpacts.js';

test.each(Object.keys(PROCEDURAL_PROJECTILE_IMPACT_DEFINITIONS))('%s separates grounded marks from an elevated animated hit without shared-cache mutation', type => {
    const scene = new THREE.Group();
    const position = new THREE.Vector3(-570, field.sample(-570, 410)+2, 410);
    const options = { projectileType: type, direction: new THREE.Vector3(.6, 0, .8), quality: 'low' };
    const flat = createProceduralProjectileImpactEffect(scene, position, options);
    const raised = createProceduralProjectileImpactEffect(scene, position, { ...options, terrainElevation: field });
    const surfaces = raised.groundPresentation.surfaces;
    const sourceSpies = surfaces.map(entry => jest.spyOn(entry.geometry, 'dispose'));
    const ownedSpies = surfaces.map(entry => jest.spyOn(entry.part.geometry, 'dispose'));
    const geometries = surfaces.map(entry => entry.part.geometry);
    try {
        expect(raised.root.position.y).toBe(position.y);
        for (let step = 0; step < 5; step++) {
            raised.update(.1); flat.update(.1); scene.updateMatrixWorld(true);
            surfaces.forEach((entry, index) => {
                expect(entry.part.geometry).toBe(geometries[index]);
                const sourcePart = flat.root.getObjectByName(entry.part.name);
                expect(sourcePart.geometry).toBe(entry.geometry);
                const lift = .1 + entry.position.y;
                const vertices = entry.part.geometry.attributes.position;
                for (let i = 0; i < vertices.count; i += 3) {
                    const center = new THREE.Vector3();
                    for (let j = 0; j < 3; j++) center.add(new THREE.Vector3().fromBufferAttribute(vertices, i+j).applyMatrix4(entry.part.matrixWorld));
                    center.divideScalar(3);
                    expect(center.y - field.sample(center.x, center.z)).toBeCloseTo(lift, 4);
                    if (entry.part.userData.gameplayBoundary) {
                        expect(Math.hypot(center.x-position.x, center.z-position.z)).toBeLessThanOrEqual(entry.part.userData.gameplayRadius+.0001);
                    }
                }
            });
            raised.root.traverse(part => {
                if (!part.isMesh || part.userData.groundSurface) return;
                const source = flat.root.getObjectByName(part.name);
                const actual = part.getWorldPosition(new THREE.Vector3());
                const expected = source.getWorldPosition(new THREE.Vector3());
                expected.y += field.sample(expected.x, expected.z) - field.sample(position.x, position.z);
                expect(actual.distanceTo(expected)).toBeLessThan(1e-7);
                expect(part.scale.toArray()).toEqual(source.scale.toArray());
            });
        }
        raised.update(2); raised.dispose();
        ownedSpies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
        sourceSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally { flat.dispose(); raised.dispose(); jest.restoreAllMocks(); }
});
