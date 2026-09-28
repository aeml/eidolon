import { jest } from '@jest/globals';
import * as THREE from 'three';
import { createLanternholdCourtyards } from '../src/art/ProceduralLanternholdCourtyards.js';
import { LANTERNHOLD_COURTYARDS } from '../src/data/worldPopulation.js';
import { getAtlasWorldLocations } from '../src/ui/AtlasNavigation.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { createProceduralLanternholdStructure, getLanternholdWalkCollider } from '../src/art/ProceduralLanternholdArchitecture.js';
import { createResonancePortalModel } from '../src/art/ResonancePortalModel.js';

test('courtyards have bounded local batches, real solid footprints and truthful safe-zone map entries', () => {
    const high = createLanternholdCourtyards(), low = createLanternholdCourtyards({ quality: 'low' });
    expect(high.userData.walkFootprints).toEqual(low.userData.walkFootprints);
    expect(high.userData.walkFootprints).toHaveLength(13);
    for (const group of [high, low]) {
        expect(group.children.map(root => root.name)).toEqual(LANTERNHOLD_COURTYARDS.map(site => site.id));
        expect(group.children.reduce((total, root) => total + root.children.length, 0)).toBe(15);
        const residents = [];
        group.traverse(part => { if (part.userData.ambientResident) residents.push(part); });
        expect(residents).toHaveLength(2);
        for (const resident of residents) resident.traverse(part => {
            expect(part.userData.entityId).toBeUndefined();
            expect(part.name).not.toMatch(/ServiceSigil|ServicePlinth/);
        });
        for (const site of LANTERNHOLD_COURTYARDS) {
            const marker = getAtlasWorldLocations({}).find(p => p.id === site.id);
            expect(marker.availability).toContain('recovery works throughout town');
            expect(marker.x).toBe(site.x + site.arrivalOffset[0]);
            expect(marker.z).toBe(site.z + site.arrivalOffset[1]);
        }
        RenderSystem.prototype.disposeObjectResources.call({}, group);
    }
});

test('full-size heroes can reach both courtyards without hitting services, camps or the portal', async () => {
    const scene = new THREE.Group(), collision = new CollisionManager();
    const generator = new WorldGenerator(scene, collision);
    await generator.loadBuildings(0, 200);
    for (const [kind, x, z, angle] of [['trading_house', -22, 185, Math.PI / 4], ['forge', -28, 218, Math.PI / 2], ['stash', -16, 193, 0]]) {
        const mesh = createProceduralLanternholdStructure(kind); mesh.position.set(x, .5, z); mesh.rotation.y = angle;
        collision.addOrientedCollider(getLanternholdWalkCollider(mesh));
    }
    const portal = createResonancePortalModel(); portal.mesh.position.set(28, 0, 235); portal.mesh.updateMatrixWorld(true);
    for (const f of portal.walls) collision.addOrientedCollider({
        box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(f.x, f.height / 2, f.z), new THREE.Vector3(f.width, f.height, f.depth)),
        matrix: portal.mesh.matrixWorld.clone(), inverse: portal.mesh.matrixWorld.clone().invert()
    });
    const arrivals = LANTERNHOLD_COURTYARDS.map(site => [site.x + site.arrivalOffset[0], site.z + site.arrivalOffset[1]]);
    for (const points of [ [[20, 215], [40, 218], [48, 230], arrivals[0]],
        [[0, 220], [-40, 230], arrivals[1]] ]) {
        for (let i = 1; i < points.length; i++) for (let step = 0; step <= 100; step++) {
            const a = new THREE.Vector3(points[i - 1][0], 0, points[i - 1][1]);
            const b = new THREE.Vector3(points[i][0], 0, points[i][1]);
            const point = a.lerp(b, step / 100);
            expect({ point: point.toArray(), blocked: Boolean(collision.checkCollision(point, 1.25)) })
                .toEqual({ point: point.toArray(), blocked: false });
        }
    }
    // Existing scene solids cannot overlap the new court solids. Only the new
    // well posts intersect its own basin's enclosing footprint intentionally.
    const oldSolids = collision.colliders.slice(0, -13), newSolids = collision.colliders.slice(-13);
    for (const box of newSolids) expect(oldSolids.some(existing => existing.intersectsBox(box))).toBe(false);
    portal.dispose(); RenderSystem.prototype.disposeObjectResources.call({}, scene);
});

test('ambient motion stays local, honors reduced motion and stops after scene removal; resources are owned', () => {
    const scene = new THREE.Group(), group = createLanternholdCourtyards(); scene.add(group);
    const ripple = group.getObjectByName('well-water-ripple'), cloth = group.getObjectByName('drying-cloth-0');
    const workerArm = group.getObjectByName('cloth-mender').getObjectByName('Rig_ForearmRight');
    group.userData.update(.1, { x: 55, z: 240 });
    expect(ripple.scale.x).not.toBe(1);
    const scale = ripple.scale.x;
    group.userData.update(.1, { x: 800, z: 200 }); expect(ripple.scale.x).toBe(scale);
    group.userData.update(.1, { x: 0, z: 240 }, true);
    expect(ripple.scale.x).toBe(1); expect(cloth.rotation.x).toBe(0);
    expect(workerArm.rotation.x).toBe(-.8);
    group.removeFromParent(); group.userData.update(.1, { x: 55, z: 240 });
    expect(ripple.scale.x).toBe(1);
    const disposed = jest.spyOn(ripple.geometry, 'dispose');
    RenderSystem.prototype.disposeObjectResources.call({}, group); expect(disposed).toHaveBeenCalledTimes(1);
});
