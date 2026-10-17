import { Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { createDungeonFloorComposition } from '../src/art/DungeonFloorComposition.js';
import { createDungeonProcessionalPaving } from '../src/art/DungeonProcessionalPaving.js';
import { createDungeonDaisMasonry } from '../src/art/DungeonDaisMasonry.js';
import { Entity } from '../src/entities/Entity.js';

for (const [label, create] of [
    ...['nave', 'court', 'procession', 'arena'].map(plan => [`${plan} border`, () => createDungeonFloorComposition(plan)]),
    ...['entry_gate', 'treasure_cache', 'restorative_shrine'].map(identity => [`${identity} paving`, () => createDungeonProcessionalPaving(identity)]),
    ['boss dais', () => createDungeonDaisMasonry()]
]) test(`${label} remains below ordinary player markers when crossed`, () => {
    const geometry = create(), finish = new Mesh(geometry, new MeshStandardMaterial()); finish.name = 'FloorFinish';
    const actor = new Entity('finish-marker'); actor.mesh = new Group(); actor.mesh.userData.bounds = { radius: 1.25 };
    actor.setPartyHighlight(true);
    try {
        const p = geometry.attributes.position, n = geometry.attributes.normal;
        let index = -1;
        for (let i = 0; i < n.count; i += 3) if (n.getY(i) > .99) { index = i; break; }
        expect(index).toBeGreaterThanOrEqual(0);
        const target = new Vector3();
        for (let i = index; i < index + 3; i++) target.add(new Vector3().fromBufferAttribute(p, i).multiplyScalar(1 / 3));
        target.y = .05; actor.mesh.position.set(target.x - 1.1, 0, target.z);
        finish.updateMatrixWorld(true); actor.mesh.updateMatrixWorld(true);
        const marker = actor.mesh.getObjectByName('PartyRing');
        const hits = new Raycaster(new Vector3(target.x, 100, target.z), new Vector3(0, -1, 0)).intersectObjects([finish, marker]);
        expect(marker.material.depthTest).toBe(true); expect(hits[0]?.object.name).toBe('PartyRing');
        expect(geometry.boundingBox.min.y).toBeGreaterThan(0); expect(geometry.boundingBox.max.y).toBeLessThan(.05);
    } finally { actor.setPartyHighlight(false); geometry.dispose(); finish.material.dispose(); }
});
