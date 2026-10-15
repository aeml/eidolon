import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ActorGameplayGeometryRuntime } from '../src/core/ActorGameplayGeometryRuntime.js';
import { gameplayGeometryWorkerURL } from '../src/core/ActorGameplayGeometryDelivery.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

function actor(quality = 'high') {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(16), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial()), bone = new THREE.Bone();
    mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
    const root = new THREE.Group(); root.userData.authoredClass = 'Fighter'; root.userData.authoredQuality = quality; root.add(mesh);
    return { root, mesh, geometry };
}

function fixture() {
    const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
    const camera = new THREE.OrthographicCamera(-15, 15, 15, -15, .1, 100);
    const original = jest.fn(), renderer = { domElement: { height: 900 }, render: original };
    const listeners = new Map(), sent = [], worker = { addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: name => listeners.delete(name), terminate: jest.fn(), postMessage: jest.fn(data => sent.push(data)) };
    const runtime = new ActorGameplayGeometryRuntime(renderer, scene, camera, [scene, group, group], { workerFactory: () => worker });
    const pump = () => jest.advanceTimersByTime(0);
    const reply = () => listeners.get('message')({ data: { id: sent.at(-1).id, indices: new Uint32Array([0, 1, 2]) } });
    return { scene, group, camera, renderer, original, worker, runtime, sent, pump, reply };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('actual renderer owns lazy geometry by default and shutdown cannot reactivate it', () => {
    const render = new RenderSystem(false);
    expect(render.actorGameplayGeometry).toBeInstanceOf(ActorGameplayGeometryRuntime);
    expect(render.actorGameplayGeometry.delivery.worker).toBeNull();
    render.setActorGameplayGeometryEnabled(false);
    const worker = { addEventListener: jest.fn(), removeEventListener: jest.fn(), postMessage: jest.fn(), terminate: jest.fn() };
    render.setActorGameplayGeometryEnabled(true, { workerFactory: () => worker });
    const runtime = render.actorGameplayGeometry;
    expect(runtime).not.toBeNull(); render.setActorGameplayGeometryEnabled(true);
    expect(render.actorGameplayGeometry).toBe(runtime);
    render.add(actor().root); jest.advanceTimersByTime(0);
    render.dispose(); expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(runtime.delivery.roots.size).toBe(0); expect(render.actorGameplayGeometry).toBeNull();
    render.setActorGameplayGeometryEnabled(true); expect(render.actorGameplayGeometry).toBeNull();
});

test('streaming async mesh arrival, detach, pool reuse and quality replacement follow ownership groups', () => {
    const f = fixture(), old = actor(), replacement = actor('low');
    f.group.add(old.root); f.pump(); expect(f.sent).toHaveLength(1);
    old.root.removeFromParent(); f.group.add(replacement.root);
    f.reply(); expect(f.runtime.pass.entries.size).toBe(0); expect(f.runtime.delivery.roots.has(old.root)).toBe(false);
    f.pump(); f.reply(); expect(f.runtime.pass.entries.get(replacement.mesh).source).toBe(replacement.geometry);
    replacement.root.removeFromParent(); f.scene.add(old.root); f.pump(); f.reply();
    expect(f.runtime.delivery.roots.size).toBe(1); expect(f.runtime.pass.entries.has(old.mesh)).toBe(true);
    expect(f.runtime.pass.entries.has(replacement.mesh)).toBe(false); f.runtime.dispose();
});

test('a temporarily detached ownership group drops all roots and reacquires them when attached', () => {
    const f = fixture(), a = actor(); f.group.add(a.root); f.pump(); f.reply();
    f.group.removeFromParent(); expect(f.runtime.delivery.roots.size).toBe(0); expect(f.runtime.pass.entries.size).toBe(0);
    const b = actor(); f.group.add(b.root); expect(f.runtime.delivery.roots.size).toBe(0);
    f.scene.add(f.group); expect(f.runtime.delivery.roots.size).toBe(2); f.runtime.dispose();
});

test('room clear releases borrowed-root listeners/candidates, preserves worker cache owner and accepts reentry', () => {
    const f = fixture(), a = actor(); f.group.add(a.root); f.pump(); f.reply();
    const candidate = f.runtime.pass.entries.get(a.mesh).candidate;
    const candidateDispose = jest.spyOn(candidate, 'dispose'), sourceDispose = jest.spyOn(a.geometry, 'dispose');
    f.runtime.clear(); f.runtime.clear(); f.group.clear();
    expect(candidateDispose).toHaveBeenCalledTimes(1); expect(sourceDispose).not.toHaveBeenCalled();
    expect(f.runtime.delivery.roots.size).toBe(0); expect(f.worker.terminate).not.toHaveBeenCalled();
    f.group.add(a.root); f.pump(); f.reply(); expect(f.runtime.pass.entries.size).toBe(1); f.runtime.dispose();
});

test('shutdown removes only its group listeners and late arrivals cannot retain roots', () => {
    const f = fixture(), observer = jest.fn(); f.group.addEventListener('childadded', observer);
    const a = actor(); f.group.add(a.root); f.pump(); const delivery = f.runtime.delivery;
    f.runtime.dispose(); f.runtime.dispose(); f.group.add(actor().root);
    expect(delivery.roots.size).toBe(0); expect(delivery.jobs.size).toBe(0);
    expect(f.renderer.render).toBe(f.original); expect(observer).toHaveBeenCalledTimes(2);
    expect(f.worker.terminate).toHaveBeenCalledTimes(1);
});

test('scenery subtrees do not get scanned or watched on actor-group changes', () => {
    const f = fixture(), scenery = new THREE.Group();
    const traverse = jest.spyOn(scenery, 'traverse'); f.scene.add(scenery);
    expect(traverse).not.toHaveBeenCalled(); expect(f.runtime.delivery.roots.size).toBe(0); f.runtime.dispose();
});

test('Ilyra prepares only her opaque costume and restores source geometry for close views and pool reuse', () => {
    const f = fixture(), a = actor(), face = actor(), unknown = actor();
    delete a.root.userData.authoredClass; delete a.root.userData.authoredQuality;
    a.root.userData.npcAppearance = 'ilyra-fourfold-archmage';
    const costume = new THREE.Group(); costume.name = 'Ilyra_FourfoldCostume';
    costume.add(a.mesh); a.root.add(costume, face.mesh);
    delete unknown.root.userData.authoredClass;
    unknown.root.userData.npcAppearance = 'unrecognized-npc';
    f.group.add(a.root, unknown.root); f.pump();
    expect(f.sent).toHaveLength(1); f.reply();
    expect(f.runtime.pass.entries.size).toBe(1);
    const candidate = f.runtime.pass.entries.get(a.mesh).candidate;
    f.original.mockImplementation(() => {
        expect(a.mesh.geometry).toBe(f.camera.zoom === 2 ? a.geometry : candidate);
        expect(face.mesh.geometry).toBe(face.geometry);
        expect(unknown.mesh.geometry).toBe(unknown.geometry);
    });
    f.renderer.render(f.scene, f.camera); expect(a.mesh.geometry).toBe(a.geometry);
    f.camera.zoom = 2; f.renderer.render(f.scene, f.camera);
    const dispose = jest.spyOn(candidate, 'dispose'), originalDispose = jest.spyOn(a.geometry, 'dispose');
    a.root.removeFromParent(); expect(dispose).toHaveBeenCalledTimes(1);
    expect(originalDispose).not.toHaveBeenCalled();
    f.group.add(a.root); f.pump(); f.reply();
    expect(f.runtime.pass.entries.has(a.mesh)).toBe(true);
    expect(f.runtime.pass.entries.has(face.mesh)).toBe(false);
    f.runtime.dispose(); expect(a.mesh.geometry).toBe(a.geometry);
});

test('worker URL preserves only the exact engine release for source and bundled module paths', () => {
    for (const file of ['ActorGameplayGeometryDelivery.js', 'GameEngine.bundle.js']) {
        expect(gameplayGeometryWorkerURL(`https://example.test/game/src/core/${file}?release=abcdef123&unrelated=omit`).href)
            .toBe('https://example.test/game/src/core/ActorGameplayGeometryWorker.bundle.js?release=abcdef123');
    }
});
