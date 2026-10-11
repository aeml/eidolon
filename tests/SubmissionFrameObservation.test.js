import { jest } from '@jest/globals';
import * as THREE from 'three';
import { observeSubmissionFramesInPage } from './submissionFrameObservation.js';

function fixture() {
    const scene = new THREE.Scene(), root = new THREE.Group(), camera = new THREE.PerspectiveCamera();
    root.name = 'Equipped Fighter'; root.userData.authoredClass = 'Fighter'; scene.add(root);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); root.add(mesh);
    const light = new THREE.DirectionalLight(); light.castShadow = true; scene.add(light);
    const direct = jest.fn(() => { renderer.info.render.calls++; renderer.info.render.triangles += 12; return 'direct-result'; });
    const renderer = Object.create({ renderBufferDirect: direct });
    renderer.info = { render: { calls: 0, triangles: 0 } };
    const draw = jest.fn(() => {
        renderer.info.render.calls = 0; renderer.info.render.triangles = 0;
        renderer.renderBufferDirect(camera, scene, mesh.geometry, mesh.material, mesh, null);
        renderer.renderBufferDirect(light.shadow.camera, scene, mesh.geometry, mesh.material, mesh, null);
        return 'draw-result';
    });
    const render = Object.assign(Object.create({ render: draw }), { scene, renderer, camera, graphicsQuality: 'high' });
    const game = { renderSystem: render, player: { state: 'ATTACKING', position: new THREE.Vector3(1, 2, 3),
        stats: { hp: 100 }, currentAction: { getClip: () => ({ name: 'Sword_Attack' }) } },
        activeEntitiesCache: [{ isActive: true, state: 'ATTACKING' }], isHostileActorTarget: () => true };
    window.game = game;
    return { game, render, renderer, direct, draw, mesh };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => { delete window.game; jest.useRealTimers(); });

test('default twelve-frame capture accounts for color and shadow and restores inherited hooks', async () => {
    const { render, renderer, direct, draw, mesh } = fixture();
    const callback = mesh.onBeforeRender, material = mesh.material, geometry = mesh.geometry;
    const capture = observeSubmissionFramesInPage();
    for (let i = 0; i < 12; i++) expect(render.render()).toBe('draw-result');
    const report = await capture;
    expect(report.frames).toHaveLength(12); expect(report.restored).toBe(true);
    for (const frame of report.frames) {
        expect(frame.calls).toBe(2); expect(frame.triangles).toBe(24);
        expect(frame.rows.map(row => row.pass)).toEqual(['color', 'shadow-0']);
        expect(frame.rows.every(row => row.family === 'Equipped Fighter')).toBe(true);
        expect(frame.rows.reduce((sum, row) => sum + row.submittedCalls, 0)).toBe(frame.calls);
        expect(frame.rows.reduce((sum, row) => sum + row.submittedTriangles, 0)).toBe(frame.triangles);
    }
    expect(render.render).toBe(draw); expect(renderer.renderBufferDirect).toBe(direct);
    expect(Object.hasOwn(render, 'render')).toBe(false); expect(Object.hasOwn(renderer, 'renderBufferDirect')).toBe(false);
    expect(mesh.onBeforeRender).toBe(callback); expect(mesh.material).toBe(material); expect(mesh.geometry).toBe(geometry);
});

test('a bounded180frame combat capture reports attack and recovery without changing state', async () => {
    const { game, render } = fixture(), capture = observeSubmissionFramesInPage({ frameCount: 180, activity: true });
    for (let i = 0; i < 180; i++) { game.player.state = i < 90 ? 'ATTACKING' : 'IDLE'; render.render(); }
    const report = await capture;
    expect(report.frames).toHaveLength(180); expect(report.activityObserved).toBe(true);
    expect(report.frames.filter(frame => frame.activity.state === 'ATTACKING')).toHaveLength(90);
    expect(report.frames.at(-1).activity).toMatchObject({ position: [1, 2, 3], hp: 100, aliveHostiles: 1 });
    expect(game.player.state).toBe('IDLE'); expect(game.player.position.toArray()).toEqual([1, 2, 3]);
});

test.each([0, 241, NaN, 1.5])('invalid frame bound%s leaves render hooks untouched', async frameCount => {
    const { render, renderer, draw, direct } = fixture();
    await expect(observeSubmissionFramesInPage({ frameCount })).rejects.toThrow('bounded');
    expect(render.render).toBe(draw); expect(renderer.renderBufferDirect).toBe(direct);
});

test('a nested capture cannot replace the current observer', async () => {
    const { render, renderer, draw, direct } = fixture(), first = observeSubmissionFramesInPage({ frameCount: 1 });
    const observed = render.render;
    await expect(observeSubmissionFramesInPage()).rejects.toThrow('already owns');
    expect(render.render).toBe(observed); render.render(); await first;
    expect(render.render).toBe(draw); expect(renderer.renderBufferDirect).toBe(direct);
});

test('a failed production render propagates its error and restores hooks', async () => {
    const { render, renderer, draw, direct } = fixture(), error = new Error('render failed');
    draw.mockImplementation(() => { throw error; });
    const capture = observeSubmissionFramesInPage(), rejection = expect(capture).rejects.toBe(error);
    expect(() => render.render()).toThrow(error); await rejection;
    expect(render.render).toBe(draw); expect(renderer.renderBufferDirect).toBe(direct);
});

test('timeout preserves a replacement render owner and rejects incomplete evidence', async () => {
    const { render, renderer, direct } = fixture(), capture = observeSubmissionFramesInPage();
    const external = () => {}; render.render = external;
    const rejection = expect(capture).rejects.toThrow('timed out'); jest.advanceTimersByTime(30000); await rejection;
    expect(render.render).toBe(external); expect(renderer.renderBufferDirect).toBe(direct);
});

test('nonenumerable own hook descriptors survive a successful capture', async () => {
    const { render, renderer, draw, direct } = fixture();
    Object.defineProperty(render, 'render', { value: draw, configurable: true, writable: true, enumerable: false });
    Object.defineProperty(renderer, 'renderBufferDirect', { value: direct, configurable: true, writable: true, enumerable: false });
    const beforeRender = Object.getOwnPropertyDescriptor(render, 'render');
    const beforeDirect = Object.getOwnPropertyDescriptor(renderer, 'renderBufferDirect');
    const capture = observeSubmissionFramesInPage({ frameCount: 1 }); render.render(); await capture;
    expect(Object.getOwnPropertyDescriptor(render, 'render')).toEqual(beforeRender);
    expect(Object.getOwnPropertyDescriptor(renderer, 'renderBufferDirect')).toEqual(beforeDirect);
});
