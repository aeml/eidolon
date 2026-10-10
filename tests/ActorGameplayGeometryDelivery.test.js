import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ActorGameplayGeometry } from '../src/core/ActorGameplayGeometry.js';
import { ActorGameplayGeometryDelivery, copyGameplayGeometry } from '../src/core/ActorGameplayGeometryDelivery.js';

function fixture(options = {}) {
    const source = new THREE.BufferGeometry();
    source.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    source.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    source.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(16), 4));
    source.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    source.setIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new THREE.SkinnedMesh(source, new THREE.MeshStandardMaterial()), bone = new THREE.Bone();
    mesh.add(bone); mesh.bind(new THREE.Skeleton([bone])); mesh.name = 'FittedGear';
    const root = new THREE.Group(); root.userData.authoredClass = 'Fighter'; root.userData.authoredQuality = 'high'; root.add(mesh);
    const scene = new THREE.Scene(); scene.add(root);
    const camera = new THREE.OrthographicCamera(-15, 15, 15, -15, .1, 100);
    const renderer = { domElement: { height: 900 }, render: jest.fn() }, pass = new ActorGameplayGeometry(renderer, scene, camera);
    const listeners = new Map(), sent = [];
    const worker = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => {
        if (listeners.get(name) === fn) listeners.delete(name);
    }, terminate: jest.fn(), postMessage: jest.fn((data, transfers) => sent.push({ data, transfers })) };
    const delivery = new ActorGameplayGeometryDelivery(pass, { workerFactory: () => worker, ...options });
    const reply = (extra = {}) => listeners.get('message')?.({ data: { id: sent.at(-1).data.id, indices: new Uint32Array([0, 1, 2]), ...extra } });
    const draw = () => renderer.render(scene, camera);
    const dispose = () => { delivery.dispose(); pass.dispose(); };
    return { source, mesh, root, scene, renderer, pass, worker, delivery, reply, draw, sent, listeners, dispose };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const pump = () => jest.advanceTimersByTime(0);

test('source remains visible while the worker owns only copied buffers', () => {
    const f = fixture(); f.delivery.track(f.root); pump();
    expect(f.sent).toHaveLength(1); expect(f.pass.entries.size).toBe(0); f.draw(); expect(f.mesh.geometry).toBe(f.source);
    const { data, transfers } = f.sent[0];
    expect(data.kind).toBe('color'); expect(data.source.index).toEqual(new Uint32Array([0, 1, 2, 0, 2, 3]));
    expect(transfers).not.toContain(f.source.index.array.buffer);
    for (const attr of Object.values(f.source.attributes)) expect(transfers).not.toContain(attr.array.buffer);
    f.reply(); expect(f.pass.entries.size).toBe(1); f.draw(); expect(f.mesh.geometry).toBe(f.source);
    expect(f.delivery.stats.installed).toBe(1); f.dispose();
});

test('unloaded actor placeholders do not allocate work or listeners', () => {
    const f = fixture(); f.delivery.track(null); f.delivery.track(undefined); pump();
    expect(f.delivery.roots.size).toBe(0); expect(f.sent).toHaveLength(0); f.dispose();
});

test('appearance changes use originals while translucent and reacquire after restoration', () => {
    const f = fixture(); f.delivery.track(f.root); pump(); f.reply();
    const opaque = f.mesh.material; f.mesh.material = opaque.clone();
    f.mesh.material.transparent = true; f.mesh.material.opacity = .3;
    f.root.dispatchEvent({ type: 'appearancechanged' });
    expect(f.pass.entries.size).toBe(0); pump(); expect(f.sent).toHaveLength(1);
    f.mesh.material = opaque; f.root.dispatchEvent({ type: 'appearancechanged' });
    pump(); f.reply({ cacheHit: true }); expect(f.pass.entries.size).toBe(1); f.dispose();
});

test.each(['geometry', 'material', 'rig', 'quality', 'mask-version', 'revision'])('late worker results cannot attach after a changed %s', change => {
    const f = fixture(); f.delivery.track(f.root); pump();
    if (change === 'geometry') f.mesh.geometry = f.source.clone();
    if (change === 'material') f.mesh.material = f.mesh.material.clone();
    if (change === 'rig') f.mesh.skeleton = new THREE.Skeleton([new THREE.Bone()]);
    if (change === 'quality') f.root.userData.authoredQuality = 'low';
    if (change === 'mask-version') f.source.index.needsUpdate = true;
    if (change === 'revision') f.root.userData.equipmentVisualRevision = 1;
    f.reply(); expect(f.pass.entries.size).toBe(0); expect(f.delivery.stats.stale).toBe(1);
    pump(); expect(f.sent).toHaveLength(2); f.reply(); expect(f.pass.entries.size).toBe(1); f.dispose();
});

test('equipment notifications replace pending work and restored coverage requests the actual source', () => {
    const f = fixture(); f.delivery.track(f.root); pump();
    const oldID = f.sent[0].data.id;
    f.mesh.geometry = f.source.clone(); f.mesh.geometry.setIndex([0, 2, 3]);
    f.root.userData.equipmentVisualRevision = 1; f.root.dispatchEvent({ type: 'equipmentvisualschanged' });
    f.reply(); expect(f.pass.entries.size).toBe(0); pump();
    expect(f.sent.at(-1).data.id).not.toBe(oldID);
    expect(f.sent.at(-1).data.source.index).toEqual(new Uint32Array([0, 2, 3]));
    f.reply({ indices: new Uint32Array([0, 2, 3]) }); expect(f.pass.entries.size).toBe(0);
    f.mesh.geometry = f.source; f.root.userData.equipmentVisualRevision = 2;
    f.root.dispatchEvent({ type: 'equipmentvisualschanged' }); pump(); f.reply({ cacheHit: true });
    expect(f.delivery.stats.cacheHits).toBe(1); expect(f.pass.entries.get(f.mesh).source).toBe(f.source); f.dispose();
});

test('render validation schedules reacquisition outside the render after an attribute change', () => {
    const f = fixture(); f.delivery.track(f.root); pump(); f.reply();
    f.source.attributes.position.needsUpdate = true; f.draw();
    expect(f.pass.entries.size).toBe(0); expect(f.sent).toHaveLength(1);
    pump(); expect(f.sent).toHaveLength(2); f.reply(); expect(f.pass.entries.size).toBe(1); f.dispose();
});

test('equipment notification retires removed meshes even with the renderer paused', () => {
    const f = fixture(); f.delivery.track(f.root); pump(); f.reply();
    f.mesh.removeFromParent(); f.root.userData.equipmentVisualRevision = 1;
    f.root.dispatchEvent({ type: 'equipmentvisualschanged' });
    expect(f.pass.entries.size).toBe(0); expect(f.delivery.jobs.size).toBe(0); f.dispose();
});

test.each([false, true])('disposed source cannot be reacquired, installed=%s', installed => {
    const f = fixture(); f.delivery.track(f.root); pump(); if (installed) f.reply();
    f.source.dispose(); if (!installed) f.reply(); f.delivery.refresh(f.root); pump();
    expect(f.pass.entries.size).toBe(0); expect(f.sent).toHaveLength(1); f.dispose();
});

test('detachment cancels pending results, attachment reacquires, untrack removes listeners', () => {
    const f = fixture(); f.delivery.track(f.root); pump();
    f.root.removeFromParent(); f.reply(); expect(f.pass.entries.size).toBe(0);
    f.scene.add(f.root); pump(); f.reply(); expect(f.pass.entries.size).toBe(1);
    f.delivery.untrack(f.root); expect(f.pass.entries.size).toBe(0);
    f.root.dispatchEvent({ type: 'equipmentvisualschanged' }); pump(); expect(f.sent).toHaveLength(2); f.dispose();
});

test.each(['timeout', 'error', 'messageerror', 'postMessage'])('%s failure leaves originals and drains bounded pending work', failure => {
    const f = fixture({ timeoutMs: 100 });
    if (failure === 'postMessage') f.worker.postMessage.mockImplementation(() => { throw new Error('clone'); });
    f.delivery.track(f.root); pump();
    if (failure === 'timeout') jest.advanceTimersByTime(100);
    if (failure === 'error' || failure === 'messageerror') f.listeners.get(failure)();
    expect(f.delivery.failed).toBe(true); expect(f.delivery.jobs.size).toBe(0); expect(f.delivery.queue).toHaveLength(0);
    expect(f.mesh.geometry).toBe(f.source); expect(f.worker.terminate).toHaveBeenCalledTimes(1); f.dispose();
});

test('disposal ignores late callbacks, releases candidates and leaves source lifetime with its owner', () => {
    const f = fixture(); f.delivery.track(f.root); pump(); const callback = f.listeners.get('message');
    const sourceDisposed = jest.fn(); f.source.addEventListener('dispose', sourceDisposed);
    f.dispose(); f.dispose(); callback({ data: { id: f.sent[0].data.id, indices: new Uint32Array([0, 1, 2]) } });
    expect(f.pass.entries.size).toBe(0); expect(sourceDisposed).not.toHaveBeenCalled(); expect(f.listeners.size).toBe(0);
});

test('source and pending-job budgets preserve full geometry without unbounded copies', () => {
    const f = fixture({ maxSourceBytes: 1, maxJobs: 1 });
    const another = f.mesh.clone(); f.root.add(another); f.delivery.track(f.root);
    expect(f.delivery.jobs.size).toBe(1); expect(f.delivery.stats.rejected).toBe(1); pump();
    expect(f.sent).toHaveLength(0); expect(f.delivery.stats.fallback).toBe(1); f.dispose();
});

test('interleaved normalized attributes copy decoded values without touching source data', () => {
    const f = fixture(), array = new Uint16Array([65535, 0, 0, 7, 0, 65535, 0, 8, 0, 0, 65535, 9, 65535, 65535, 0, 10]);
    f.source.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(array, 4), 3, 0, true));
    const payload = copyGameplayGeometry(f.pass.capture(f.mesh), 100_000);
    expect(payload.source.attributes.normal.array).toEqual(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0]));
    expect(array[3]).toBe(7); f.dispose();
});

test('rigid mount work carries its quality without fabricated skin attributes and ignores other meshes', () => {
    const f = fixture();
    try {
        const mount = new THREE.Group(); Object.assign(mount.userData, { authoredEquipment: true, fittedItem: 'wooden-staff', slot: 'mainHand' });
        const geometry = new THREE.PlaneGeometry(), mesh = new THREE.Mesh(geometry, f.mesh.material); mesh.name = 'Weapon_Body'; mount.add(mesh); f.root.add(mount);
        const unrelated = mesh.clone(); f.root.add(unrelated); f.root.userData.authoredQuality = 'low';
        f.delivery.track(f.root); pump(); f.reply(); pump();
        const sent = f.sent.at(-1).data;
        expect(sent.kind).toBe('rigid'); expect(sent.source.quality).toBe('low');
        expect(Object.keys(sent.source.attributes).sort()).toEqual(['normal', 'position', 'uv']);
        f.reply({ indices: new Uint32Array([0, 2, 1]) }); expect(f.pass.entries.get(mesh).kind).toBe('rigid');
        expect(f.pass.entries.has(unrelated)).toBe(false);
        mount.removeFromParent(); f.root.dispatchEvent({ type: 'equipmentvisualschanged' });
        expect(f.pass.entries.has(mesh)).toBe(false);
    } finally { f.dispose(); }
});
