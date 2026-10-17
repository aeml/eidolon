import * as THREE from 'three';
import { chronicleInvestigations } from '../src/data/chronicleCatalog.js';
import { createChronicleSiteModel } from '../src/art/ChronicleSiteModels.js';
import { getDarkRealmCampColliders, getDarkRealmCourtColliders } from '../src/art/ProceduralDarkRealm.js';
import { darkRealmFixture } from './darkRealmFixture.js';

const houses = new Set(['ruined_house', 'flood_shelter', 'cold_kiln', 'observatory']);
const sites = chronicleInvestigations.filter(chapter => chapter.realm === 'dark')
    .flatMap(chapter => chapter.sites).filter(site => !houses.has(site.model));

test.each(sites)('$id retains its footprint and interaction identity below ordinary markers', site => {
    const model = createChronicleSiteModel(site, 'dark');
    const apron = model.mesh.getObjectByName('ChronicleSiteApron');
    const bounds = new THREE.Box3().setFromObject(apron);
    expect(bounds.min.y).toBeCloseTo(0, 6);
    expect(bounds.max.y).toBeCloseTo(.03, 6);
    expect(bounds.max.y).toBeLessThan(.05);
    expect(bounds.min.x).toBeCloseTo(-2.1); expect(bounds.max.x).toBeCloseTo(2.1);
    expect(bounds.min.z).toBeCloseTo(-2.1); expect(bounds.max.z).toBeCloseTo(2.1);
    expect(apron.material.depthTest).toBe(true); expect(apron.material.depthWrite).toBe(true);
    expect(apron.material.transparent).toBe(false); expect(apron.material.opacity).toBe(1);
    expect(model.walls).toHaveLength(0);
    expect(darkRealmFixture().walkRects.some(rect => Math.abs(site.x - rect.x) <= rect.width / 2 && Math.abs(site.z - rect.z) <= rect.height / 2)).toBe(true);
    const point = new THREE.Vector3(site.x, 0, site.z);
    expect([...getDarkRealmCampColliders(), ...getDarkRealmCourtColliders()]
        .some(box => box.expandByScalar(1.25).containsPoint(point))).toBe(false);
    expect(model.mesh.userData.bounds).toEqual({ radius: 2.2, height: 3.9 });
    model.mesh.traverse(part => expect(part.userData.entityId).toBe(site.entityId));
    model.dispose();
});

test.each(['water', 'fire', 'air'])('%s grounds its apron below ordinary markers and retains ownership', realm => {
    const site = chronicleInvestigations.filter(chapter => chapter.realm === realm)
        .flatMap(chapter => chapter.sites).find(site => site.kind === 'inspect' && !houses.has(site.model));
    expect(site).toBeDefined();
    const model = createChronicleSiteModel(site, realm);
    const apron = model.mesh.getObjectByName('ChronicleSiteApron');
    expect(new THREE.Box3().setFromObject(apron).max.y).toBeCloseTo(.03, 6);
    let disposed = 0;
    apron.geometry.addEventListener('dispose', () => disposed++);
    model.dispose();
    expect(disposed).toBe(1);
});

test('the audit covers all seventeen non-house Dark Realm records', () => {
    expect(sites).toHaveLength(17);
    expect(new Set(sites.map(site => site.model))).toEqual(new Set(['horizon_marker', 'command_stone', 'root_memory', 'root_growth', 'tide_lens']));
});
