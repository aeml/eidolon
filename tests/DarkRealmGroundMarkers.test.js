import { Box3, Group, Raycaster, Vector3 } from 'three';
import { createDarkRealmScene } from '../src/art/ProceduralDarkRealm.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { Entity } from '../src/entities/Entity.js';
import { DARK_REALM_COURTS } from '../src/data/darkRealmPopulation.js';
import { darkRealmFixture } from './darkRealmFixture.js';

const court = DARK_REALM_COURTS[0];
for (const [label, x, z] of [
    ['camp paving', 40000, 40830],
    ['processional line', 40015, 40830],
    ['court bronze inlay', court.x + 5, court.z + 6],
    ['court broken paving', court.x + 9, court.z + 11]
]) test(`Dark Realm ${label} stays below an ordinary party marker at server Y0`, () => {
    const scene = new Group(), root = createDarkRealmScene(scene, darkRealmFixture(), null, { quality: 'low' });
    const actor = new Entity('dark-realm-marker'); actor.mesh = new Group();
    actor.mesh.position.set(x - 1.1, 0, z); actor.mesh.userData.bounds = { radius: 1.25 };
    actor.setPartyHighlight(true);
    try {
        root.updateMatrixWorld(true); actor.mesh.updateMatrixWorld(true);
        const marker = actor.mesh.getObjectByName('PartyRing'), surfaces = [];
        root.traverseVisible(part => { if (part.isMesh && !part.material.transparent) surfaces.push(part); });
        expect(marker.material.depthTest).toBe(true);
        const hits = new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0)).intersectObjects([...surfaces, marker]);
        expect(hits[0]?.object.name).toBe('PartyRing');
        expect(root.children.filter(part => part.name === 'dark-realm-union-floor').every(part => part.position.y === 0)).toBe(true);
    } finally {
        actor.setPartyHighlight(false); RenderSystem.prototype.disposeObjectResources.call({}, root);
    }
});

test('Dark Realm streets stay above the floor and below actor ground markers', () => {
    const root = createDarkRealmScene(new Group(), darkRealmFixture(), null, { quality: 'low' });
    try {
        const streets = root.getObjectByName('Dark Realm authored paths');
        const bounds = new Box3().setFromObject(streets);
        expect(bounds.min.y).toBeGreaterThan(0);
        expect(bounds.max.y).toBeLessThan(.05);
        streets.traverse(part => {
            if (part.isMesh) { expect(part.renderOrder).toBe(-.5); expect(part.material.depthWrite).toBe(false); }
        });
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, root); }
});
