import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Object3D } from 'three';
import { observePartyMatrixOwners } from './e2e/party-matrix-observation.js';

test('stock owner measurement preserves changing world transforms and exact property ownership', () => {
    const scene = new Group(), group = new Group(), actor = new Group();
    actor.userData.authoredClass = 'Fighter';
    actor.name = 'private-character-name';
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    scene.add(group); group.add(actor); actor.add(mesh);
    let time = 0;
    const probe = observePartyMatrixOwners(scene, [['entity-group', group]], [], [actor], () => ++time);
    try {
        group.position.x = 5; actor.position.x = 7; scene.updateMatrixWorld();
        expect(mesh.matrixWorld.elements[12]).toBe(12);
        group.position.x = 10; scene.updateMatrixWorld(true);
        expect(mesh.matrixWorld.elements[12]).toBe(17);
        const result = probe.read();
        expect(result.owners.map(row => row.calls)).toEqual([2, 2, 2]);
        expect(result.owners.find(row => row.role === 'supplied-Fighter')).toMatchObject({ nodes: 2, meshes: 1 });
        expect(JSON.stringify(result)).not.toMatch(/private-character|uuid|arguments/);
    } finally { expect(probe.restore()).toBe(true); mesh.geometry.dispose(); mesh.material.dispose(); }
    for (const root of [scene, group, actor]) {
        expect(root.updateMatrixWorld).toBe(Object3D.prototype.updateMatrixWorld);
        expect(Object.hasOwn(root, 'updateMatrixWorld')).toBe(false);
    }
    expect(probe.restore()).toBe(true);
});

test('deduplication and custom callbacks retain their own behavior', () => {
    const scene = new Group(), custom = new Group(); scene.add(custom);
    const callback = () => { throw Error('owned custom transform'); }; custom.updateMatrixWorld = callback;
    const probe = observePartyMatrixOwners(scene, [['duplicate', scene]], [custom], [custom], () => 0);
    try {
        expect(() => scene.updateMatrixWorld()).toThrow('owned custom transform');
        expect(probe.read()).toEqual({ owners: [{ role: 'scene', nodes: 2, meshes: 0, calls: 1, totalMs: 0, maxMs: 0 }], skipped: ['foliage'] });
    } finally { expect(probe.restore()).toBe(true); }
    expect(custom.updateMatrixWorld).toBe(callback);
});

test('an external replacement is never overwritten during diagnostic cleanup', () => {
    const scene = new Group();
    const probe = observePartyMatrixOwners(scene, [], [], [], () => 0);
    const replacement = () => {}; scene.updateMatrixWorld = replacement;
    expect(probe.restore()).toBe(false);
    expect(scene.updateMatrixWorld).toBe(replacement);
});
