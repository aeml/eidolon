import * as THREE from 'three';
import { chronicleInvestigations } from '../src/data/chronicleCatalog.js';
import { createChronicleSiteModel } from '../src/art/ChronicleSiteModels.js';

const cases = chronicleInvestigations.filter(chapter => ['water', 'fire', 'air'].includes(chapter.realm))
    .flatMap(chapter => chapter.sites.filter(site => site.kind === 'inspect').map(site => ({ site, realm: chapter.realm })));

test.each(cases)('$realm/$site.id has a shallow walk-through finish and retains its footprint', ({ site, realm }) => {
    const model = createChronicleSiteModel(site, realm);
    const apron = model.mesh.getObjectByName('ChronicleSiteApron');
    const floor = apron || model.mesh.getObjectByName('ChronicleSiteFloor');
    expect(floor).toBeDefined();
    const bounds = new THREE.Box3().setFromObject(floor);
    expect(bounds.min.y).toBeCloseTo(0, 6);
    expect(bounds.max.y).toBeCloseTo(.03, 6);
    expect(bounds.max.y).toBeLessThan(.05);
    expect(bounds.min.x).toBeCloseTo(apron ? -2.1 : -3.6, 6);
    expect(bounds.max.x).toBeCloseTo(apron ? 2.1 : 3.6, 6);
    expect(bounds.min.z).toBeCloseTo(apron ? -2.1 : -3.6, 6);
    expect(bounds.max.z).toBeCloseTo(apron ? 2.1 : 2.6, 6);
    expect(floor.material.depthTest).toBe(true); expect(floor.material.depthWrite).toBe(true);
    expect(floor.material.transparent).toBe(false); expect(floor.material.opacity).toBe(1);
    expect(model.walls).toHaveLength(apron ? 0 : 3);
    const target = new THREE.Vector3(apron ? 0 : -1, 0, apron ? 0 : 1);
    expect(model.walls.some(wall => wall.clone().expandByScalar(1.25).containsPoint(target))).toBe(false);
    expect(model.mesh.userData.bounds).toEqual(apron ? { radius: 2.2, height: 3.9 } : { radius: 4.8, height: 4.1 });
    model.mesh.traverse(part => expect(part.userData.entityId).toBe(site.entityId));
    let retired = 0; floor.geometry.addEventListener('dispose', () => retired++);
    model.dispose(); expect(retired).toBe(1);
});

test('grounding coverage includes all twenty-three elemental records and three building floors', () => {
    expect(cases).toHaveLength(23);
    expect(Object.fromEntries(['water', 'fire', 'air'].map(realm => [realm, cases.filter(entry => entry.realm === realm).length])))
        .toEqual({ water: 13, fire: 6, air: 4 });
    expect(cases.filter(({ site }) => ['flood_shelter', 'cold_kiln', 'observatory'].includes(site.model)).map(({ site }) => site.id))
        .toEqual(['dain_ledger', 'hessa_ledger', 'selen_journal']);
});

test.each(cases.filter(({ site }) => ['still_echo', 'moving_echo'].includes(site.model)))('$site.id keeps its reflective fill below markers and its magical ripple heights', ({ site, realm }) => {
    const model = createChronicleSiteModel(site, realm);
    const pool = model.mesh.getObjectByName('ChronicleEchoPool');
    const bounds = new THREE.Box3().setFromObject(pool);
    expect(bounds.min.y).toBeCloseTo(.02, 6); expect(bounds.max.y).toBeCloseTo(.04, 6);
    expect(bounds.max.y).toBeLessThan(.05);
    expect(bounds.min.x).toBeCloseTo(-1.65, 6); expect(bounds.max.x).toBeCloseTo(1.65, 6);
    expect(bounds.min.z).toBeCloseTo(-1.65, 6); expect(bounds.max.z).toBeCloseTo(1.65, 6);
    expect(pool.material.metalness).toBe(.7); expect(pool.material.roughness).toBe(.18);
    expect(pool.material.depthTest).toBe(true); expect(pool.material.depthWrite).toBe(true);
    expect(pool.material.transparent).toBe(false); expect(pool.material.opacity).toBe(1);
    for (let index = 0; index < 3; index++) {
        const ripple = model.mesh.children.find(part => part.geometry?.type === 'TorusGeometry'
            && Math.abs(part.geometry.parameters.radius - (.55 + index * .4)) < 1e-6);
        expect(ripple).toBeDefined();
        expect(ripple.position.y).toBeCloseTo(.24 + index * (site.model === 'moving_echo' ? .16 : 0), 6);
    }
    model.dispose();
});
