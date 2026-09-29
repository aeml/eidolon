import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Projectile } from '../src/entities/Projectile.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';

const owner = { stats: { intelligence: 20, wisdom: 20, dexterity: 20 }, isMultiplayer: true };
const chunks = { getActiveEntities: () => [] };

test.each(['ZoneDamage', 'ZoneHoly', 'Zone', 'Tripwire', 'ExplosiveTrap', 'SnareTrap'])(
    '%s anchors owned surfaces while retaining raised animation, radius and shared cache', type => {
        const offset = type.startsWith('Zone') ? .1 : .5;
        const position = new THREE.Vector3(-570, field.sample(-570, 410)+offset, 410);
        const projectile = new Projectile('grounded-area', owner, type, position);
        const untouched = new Projectile('other-area', owner, type, position);
        const engine = { terrainElevation: field, isMultiplayer: true };
        const originals = new Map();
        projectile.mesh.traverse(part => {
            if (part.userData.groundSurface) originals.set(part.name, { geometry: part.geometry,
                values: Array.from(part.geometry.attributes.position.array), dispose: jest.spyOn(part.geometry, 'dispose') });
        });
        if (type.startsWith('Zone')) projectile.setScale(2.4);
        try {
            projectile.update(.05, null, null, chunks, null, engine); projectile.render(1);
            const state = projectile.groundPresentation;
            const owned = state.surfaces.map(entry => entry.part.geometry);
            const disposeOwned = owned.map(g => jest.spyOn(g, 'dispose'));
            const spin = projectile.mesh.getObjectByName(`${type}:Spin`);
            const angle = spin.rotation.y;
            const detail = state.details[0]?.part;
            const detailStart = detail?.getWorldPosition(new THREE.Vector3());
            for (let frame = 0; frame < 8; frame++) {
                projectile.update(.1, null, null, chunks, null, engine); projectile.render(1);
                projectile.mesh.updateMatrixWorld(true);
                state.surfaces.forEach((entry, index) => {
                    expect(entry.part.geometry).toBe(owned[index]); // No rebuilding per animation frame.
                    const vertices = entry.part.geometry.attributes.position;
                    let lift;
                    for (let i = 0; i < vertices.count; i += 3) {
                        const center = new THREE.Vector3();
                        for (let j = 0; j < 3; j++) center.add(new THREE.Vector3().fromBufferAttribute(vertices, i+j).applyMatrix4(entry.part.matrixWorld));
                        center.divideScalar(3);
                        const height = center.y - field.sample(center.x, center.z);
                        lift ??= height;
                        expect(height).toBeCloseTo(lift, 4);
                        if (entry.part.userData.gameplayBoundary) {
                            expect(Math.hypot(center.x-position.x, center.z-position.z)).toBeLessThanOrEqual(projectile.mesh.userData.gameplayRadius+.0001);
                        }
                    }
                });
            }
            expect(spin.rotation.y).not.toBe(angle);
            if (detail) expect(detail.getWorldPosition(new THREE.Vector3()).distanceTo(detailStart)).toBeGreaterThan(.001);
            for (const [name, original] of originals) {
                expect(untouched.mesh.getObjectByName(name).geometry).toBe(original.geometry);
                expect(Array.from(original.geometry.attributes.position.array)).toEqual(original.values);
                expect(original.dispose).not.toHaveBeenCalled();
            }
            // Disabling terrain restores source resources and parenting safely.
            engine.currentInstanceId = 'dungeon_test';
            projectile.update(0, null, null, chunks, null, engine);
            expect(projectile.groundPresentation).toBeNull();
            disposeOwned.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
            for (const [name, original] of originals) expect(projectile.mesh.getObjectByName(name).geometry).toBe(original.geometry);
        } finally { projectile.dispose(); untouched.dispose(); jest.restoreAllMocks(); }
    }
);

test('rescaling a persistent field rebuilds owned surfaces once and releases them on removal', () => {
    const position = new THREE.Vector3(-570, field.sample(-570, 410)+.1, 410);
    const projectile = new Projectile('rescaled-zone', owner, 'ZoneHoly', position);
    const engine = { terrainElevation: field, isMultiplayer: true };
    projectile.update(0, null, null, chunks, null, engine);
    const previous = projectile.groundPresentation.surfaces.map(e => jest.spyOn(e.part.geometry, 'dispose'));
    projectile.setScale(3);
    projectile.update(0, null, null, chunks, null, engine);
    previous.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    expect(projectile.mesh.userData.gameplayRadius).toBe(15);
    const final = projectile.groundPresentation.surfaces.map(e => jest.spyOn(e.part.geometry, 'dispose'));
    projectile.dispose(); projectile.dispose();
    final.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    jest.restoreAllMocks();
});
