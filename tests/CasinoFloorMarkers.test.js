import { Group, Raycaster, Scene, Vector3 } from 'three';
import { createCasinoInterior, disposeCasinoObject } from '../src/art/ProceduralCasino.js';
import { Entity } from '../src/entities/Entity.js';

for (const [floorName, y] of [['public', 0], ['vip', 8]]) for (const [label, x, z] of [['carpet', 0, 120], ['medallion', 0, 110], ['gilt border', 3, 120]]) {
    test(`casino ${floorName} ${label} remains below an ordinary party marker at its server height`, () => {
        const root = createCasinoInterior(new Scene(), { addCollider() {} });
        const actor = new Entity(`casino-marker-${label}`); actor.mesh = new Group();
        actor.mesh.position.set(x, y, z); actor.mesh.userData.bounds = { radius: 1.25 };
        for (const [name, floor] of Object.entries(root.userData.floors)) floor.visible = name === floorName;
        actor.setPartyHighlight(true);
        try {
            root.updateMatrixWorld(true); actor.mesh.updateMatrixWorld(true);
            const floor = []; root.userData.floors[floorName].traverseVisible(part => { if (part.isMesh) floor.push(part); });
            const marker = actor.mesh.getObjectByName('PartyRing');
            const target = new Vector3(x + 1.1, y + .05, z), camera = target.clone().add(new Vector3(100, 100, 100));
            expect(marker.material.depthTest).toBe(true);
            const hits = new Raycaster(camera, target.clone().sub(camera).normalize()).intersectObjects([...floor, marker]);
            expect(hits[0]?.object.name).toBe('PartyRing');
        } finally { actor.setPartyHighlight(false); disposeCasinoObject(root); }
    });
}
