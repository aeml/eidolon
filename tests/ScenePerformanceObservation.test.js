import { jest } from '@jest/globals';
import { observeGameplayScene } from './e2e/scene-performance.js';
import { renderFrameInterval } from './e2e/renderFrameInterval.js';

function fixture() {
    const renderer = { info: { autoReset: true, reset: jest.fn(), render: { calls: 312, triangles: 200000 },
        memory: { geometries: 9, textures: 10 } }, getContext: () => ({ getExtension: () => null, getParameter: () => 'fixture' }) };
    const original = jest.fn(() => 'original-return');
    const game = Object.assign(Object.create({ loop: original }), { renderSystem: { renderer }, uiManager: {}, activeEntitiesCache: [1, 2, 3] });
    return { game, renderer, original };
}
function drive(game, step = 334000n) {
    for (let i = 1; i <= 240; i++) game.loop(Number(1000000000n + BigInt(i) * step) / 10000);
}
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test.each([334000n, 334001n, 334010n, 500000n])('full scene observation preserves exact reported intervals and real excesses (%s)', async step => {
    const { game, renderer, original } = fixture(), promise = observeGameplayScene(game, 'fixture');
    drive(game, step); const report = await promise;
    expect(report.frames).toBe(180); expect(report.frameSamples).toHaveLength(180);
    expect(report.frameP95Ms).toBe(Number(step) / 10000);
    expect(report.frameP95Ms <= 33.4).toBe(step === 334000n);
    expect(original).toHaveBeenCalledTimes(240); expect(renderer.info.reset).toHaveBeenCalledTimes(240);
    expect(report.activeEntitiesMin).toBe(3); expect(report.drawCallsMedian).toBe(312);
    for (const row of report.frameSamples) {
        expect(row.intervalMs).toBe(renderFrameInterval(row.time, row.previousTime));
        expect(row.rawIntervalMs).toBe(row.time - row.previousTime);
    }
    if (step === 334000n) expect(report.rawFrameP95Ms).toBeGreaterThan(33.4);
    expect(game.loop).toBe(original); expect(Object.hasOwn(game, 'loop')).toBe(false); expect(renderer.info.autoReset).toBe(true);
});

test('own loop descriptor, return value and disabled automatic reset survive observation', async () => {
    const { game, renderer, original } = fixture();
    Object.defineProperty(game, 'loop', { value: original, configurable: true, writable: true, enumerable: false });
    renderer.info.autoReset = false;
    const descriptor = Object.getOwnPropertyDescriptor(game, 'loop'), promise = observeGameplayScene(game, 'fixture');
    expect(game.loop(1)).toBe('original-return'); drive(game);
    await promise; expect(Object.getOwnPropertyDescriptor(game, 'loop')).toEqual(descriptor);
    expect(renderer.info.autoReset).toBe(false);
});

test('geometry delivery counters follow each completed frame without waiting for preparation', async () => {
    const { game, original } = fixture();
    const geometry = game.renderSystem.actorGameplayGeometry = {
        delivery: { jobs: new Map() }, pass: { entries: new Map(), lastSwaps: 0, reduced: true, enabled: true }
    };
    let frame = 0;
    original.mockImplementation(() => {
        frame++;
        if (frame === 61) geometry.delivery.jobs.set('pending', {});
        if (frame === 62) {
            geometry.delivery.jobs.clear(); geometry.pass.entries.set('installed', {}); geometry.pass.lastSwaps = 1;
        }
    });
    const promise = observeGameplayScene(game, 'geometry-startup'); drive(game);
    const report = await promise;
    expect(report.frameSamples[0].gameplayGeometry).toEqual({ pending: 1, installed: 0, swaps: 0, reduced: true, enabled: true });
    expect(report.frameSamples[1].gameplayGeometry).toEqual({ pending: 0, installed: 1, swaps: 1, reduced: true, enabled: true });
    expect(report.frames).toBe(180); expect(original).toHaveBeenCalledTimes(240);
});

test('an original loop exception rejects the observation, propagates and restores ownership', async () => {
    const { game, renderer, original } = fixture(), error = new Error('fixture loop failed');
    original.mockImplementation(() => { throw error; });
    const promise = observeGameplayScene(game, 'fixture'), rejection = expect(promise).rejects.toBe(error);
    expect(() => game.loop(1)).toThrow(error); await rejection;
    expect(game.loop).toBe(original); expect(renderer.info.autoReset).toBe(true);
});

test('timeout rejects incomplete samples without overwriting a new loop owner', async () => {
    const { game, renderer } = fixture(), promise = observeGameplayScene(game, 'fixture');
    const external = () => {}; game.loop = external;
    const rejection = expect(promise).rejects.toThrow('timed out');
    jest.advanceTimersByTime(45000); await rejection;
    expect(game.loop).toBe(external); expect(renderer.info.autoReset).toBe(true);
});

test('a second observer cannot replace the first and completed observers can be reused', async () => {
    const { game, original } = fixture(), first = observeGameplayScene(game, 'first'), wrapper = game.loop;
    await expect(observeGameplayScene(game, 'second')).rejects.toThrow('active profiler');
    expect(game.loop).toBe(wrapper); drive(game); await first;
    const next = observeGameplayScene(game, 'next'); drive(game); await next;
    expect(game.loop).toBe(original);
});

test.each([NaN, -1])('invalid frame timestamp %s rejects and restores instead of reporting a budget pass', async time => {
    const { game, renderer, original } = fixture(), promise = observeGameplayScene(game, 'fixture');
    game.loop(1); const rejection = expect(promise).rejects.toThrow('monotonic finite'); game.loop(time); await rejection;
    expect(game.loop).toBe(original); expect(renderer.info.autoReset).toBe(true);
});

test('summary/context failure rejects after restoring the original loop and renderer policy', async () => {
    const { game, renderer, original } = fixture(), error = new Error('fixture context lost');
    renderer.getContext = () => { throw error; };
    const promise = observeGameplayScene(game, 'fixture'), rejection = expect(promise).rejects.toBe(error);
    drive(game); await rejection;
    expect(game.loop).toBe(original); expect(renderer.info.autoReset).toBe(true);
});

test('replacing renderer information rejects without modifying the replacement', async () => {
    const { game, renderer, original } = fixture(), previousInfo = renderer.info;
    const promise = observeGameplayScene(game, 'fixture'), replacement = { ...previousInfo, autoReset: false };
    renderer.info = replacement;
    const rejection = expect(promise).rejects.toThrow('render policy ownership'); drive(game); await rejection;
    expect(renderer.info).toBe(replacement); expect(replacement.autoReset).toBe(false);
    expect(previousInfo.autoReset).toBe(true); expect(game.loop).toBe(original);
});

test('a destroyed game cannot contribute an apparently successful completed sample', async () => {
    const { game, renderer, original } = fixture(), promise = observeGameplayScene(game, 'fixture');
    game.isDestroyed = true;
    const rejection = expect(promise).rejects.toThrow('running game'); game.loop(1); await rejection;
    expect(original).not.toHaveBeenCalled(); expect(game.loop).toBe(original); expect(renderer.info.autoReset).toBe(true);
});

function phaseFixture() {
    const setup = fixture(), { game, renderer, original } = setup;
    const renderSystem = game.renderSystem;
    renderSystem.scene = {}; renderSystem.camera = {};
    renderer.render = jest.fn(function (scene, camera) {
        expect(this).toBe(renderer); expect(scene).toBe(renderSystem.scene); expect(camera).toBe(renderSystem.camera);
        jest.advanceTimersByTime(5); return 'renderer-return';
    });
    Object.setPrototypeOf(renderSystem, { render: function () {
        expect(this).toBe(renderSystem); jest.advanceTimersByTime(3);
        return this.renderer.render(this.scene, this.camera);
    } });
    game.update = jest.fn(function (dt, flag) {
        expect(this).toBe(game); expect(dt).toBe(.01); expect(flag).toBe(false);
        jest.advanceTimersByTime(2); return 'update-return';
    });
    Object.defineProperty(game, 'render', { configurable: true, writable: true, enumerable: false, value: function (alpha) {
        expect(this).toBe(game); expect(alpha).toBe(.5);
        jest.advanceTimersByTime(2); return this.renderSystem.render();
    } });
    original.mockImplementation(function () {
        expect(this.update(.01, false)).toBe('update-return');
        this.update(.01, false); jest.advanceTimersByTime(1);
        return this.render(.5);
    });
    return setup;
}

test('opt-in phases measure inclusive clocks and disjoint components across multiple fixed updates', async () => {
    const { game, renderer } = phaseFixture(), update = game.update, render = Object.getOwnPropertyDescriptor(game, 'render');
    const submission = renderer.render, systemRender = game.renderSystem.render;
    const promise = observeGameplayScene(game, 'phases', { phases: true });
    // Calls outside the observed loop preserve behavior without contaminating samples.
    expect(game.render(.5)).toBe('renderer-return');
    drive(game); const report = await promise;
    expect(report.frameSamples).toHaveLength(180);
    for (const row of report.frameSamples) {
        expect(row.cpuMs).toBe(15);
        expect(row.phaseCalls).toEqual({ update: 2, presentation: 1, renderSystem: 1, renderer: 1, rendererWorld: 1, rendererOther: 0 });
        expect(row.phaseCpuMs).toEqual({ update: 4, presentation: 10, renderSystem: 8, renderer: 5, rendererWorld: 5, rendererOther: 0,
            presentationOutsideRenderSystem: 2, renderSystemOutsideRenderer: 3, loopOutsideUpdateAndPresentation: 1 });
    }
    expect(report.phaseSummary.components.renderer).toEqual({ medianMs: 5, p95Ms: 5 });
    expect(report.phaseSummary.calls.update).toEqual({ min: 2, max: 2 });
    expect(game.update).toBe(update); expect(Object.getOwnPropertyDescriptor(game, 'render')).toEqual(render);
    expect(renderer.render).toBe(submission); expect(game.renderSystem.render).toBe(systemRender);
    expect(Object.hasOwn(game.renderSystem, 'render')).toBe(false);
});

test('ordinary observation does not wrap phase methods or emit diagnostic clocks', async () => {
    const { game, renderer } = phaseFixture(), update = game.update, render = game.render, submission = renderer.render;
    const promise = observeGameplayScene(game, 'ordinary');
    expect(game.update).toBe(update); expect(game.render).toBe(render); expect(renderer.render).toBe(submission);
    drive(game); const report = await promise;
    expect(report).not.toHaveProperty('phaseSummary'); expect(report.frameSamples[0]).not.toHaveProperty('phaseCpuMs');
});

test('a phase exception propagates unchanged and restores every owned hook', async () => {
    const { game, renderer } = phaseFixture(), error = new Error('submission failed');
    renderer.render.mockImplementation(() => { throw error; });
    const update = game.update, render = game.render, submission = renderer.render;
    const promise = observeGameplayScene(game, 'exception', { phases: true }), rejection = expect(promise).rejects.toBe(error);
    expect(() => game.loop(1)).toThrow(error); await rejection;
    expect(game.update).toBe(update); expect(game.render).toBe(render); expect(renderer.render).toBe(submission);
    expect(Object.hasOwn(game.renderSystem, 'render')).toBe(false); expect(renderer.info.autoReset).toBe(true);
});

test('phase timeout preserves an external hook replacement while restoring remaining hooks', async () => {
    const { game, renderer } = phaseFixture(), update = game.update, render = game.render;
    const promise = observeGameplayScene(game, 'timeout', { phases: true }), replacement = () => {};
    renderer.render = replacement;
    const rejection = expect(promise).rejects.toThrow('timed out'); jest.advanceTimersByTime(45000); await rejection;
    expect(renderer.render).toBe(replacement); expect(game.update).toBe(update); expect(game.render).toBe(render);
    expect(Object.hasOwn(game.renderSystem, 'render')).toBe(false); expect(renderer.info.autoReset).toBe(true);
});

test('phase ownership loss inside a loop rejects instead of reporting incomplete phase totals', async () => {
    const { game, renderer, original } = phaseFixture(), update = game.update, replacement = () => {};
    original.mockImplementation(() => { renderer.render = replacement; });
    const promise = observeGameplayScene(game, 'lost', { phases: true }), rejection = expect(promise).rejects.toThrow('phase ownership');
    expect(() => game.loop(1)).toThrow('phase ownership'); await rejection;
    expect(renderer.render).toBe(replacement); expect(game.update).toBe(update); expect(renderer.info.autoReset).toBe(true);
});

test('partial phase installation failure restores methods already wrapped', async () => {
    const { game, renderer, original } = phaseFixture(), update = game.update;
    const descriptor = Object.getOwnPropertyDescriptor(game, 'render');
    Object.defineProperty(game, 'render', { ...descriptor, writable: false });
    await expect(observeGameplayScene(game, 'readonly', { phases: true })).rejects.toThrow();
    expect(game.update).toBe(update); expect(game.loop).toBe(original); expect(renderer.info.autoReset).toBe(true);
    expect(Object.getOwnPropertyDescriptor(game, 'render')).toEqual({ ...descriptor, writable: false });
});

test('missing phase methods reject before installing any hook and allow an ordinary observer', async () => {
    const { game, renderer, original } = fixture();
    game.renderSystem.scene = {}; game.renderSystem.camera = {};
    await expect(observeGameplayScene(game, 'missing', { phases: true })).rejects.toThrow('requires update and render');
    expect(game.loop).toBe(original); expect(renderer.info.autoReset).toBe(true);
    const promise = observeGameplayScene(game, 'ordinary'); drive(game); await promise;
});

test('renderer roles require both exact gameplay identities and sum to the inclusive renderer clock', async () => {
    const { game, renderer } = phaseFixture();
    renderer.render.mockImplementation(function () { expect(this).toBe(renderer); jest.advanceTimersByTime(5); });
    Object.getPrototypeOf(game.renderSystem).render = function () {
        jest.advanceTimersByTime(3);
        this.renderer.render(this.scene, this.camera);
        this.renderer.render({}, this.camera);
        return this.renderer.render(this.scene, {});
    };
    const promise = observeGameplayScene(game, 'roles', { phases: true }); drive(game);
    const report = await promise;
    for (const row of report.frameSamples) {
        expect(row.phaseCalls.renderer).toBe(3); expect(row.phaseCalls.rendererWorld).toBe(1); expect(row.phaseCalls.rendererOther).toBe(2);
        expect(row.phaseCpuMs.renderer).toBe(15); expect(row.phaseCpuMs.rendererWorld).toBe(5); expect(row.phaseCpuMs.rendererOther).toBe(10);
        expect(row.phaseCpuMs.renderSystemOutsideRenderer).toBe(3);
    }
});

test('a gameplay camera replacement rejects phase totals and preserves the new camera', async () => {
    const { game, renderer, original } = phaseFixture(), update = game.update, replacement = {};
    original.mockImplementation(() => { game.renderSystem.camera = replacement; });
    const promise = observeGameplayScene(game, 'camera', { phases: true }), rejection = expect(promise).rejects.toThrow('phase ownership');
    expect(() => game.loop(1)).toThrow('phase ownership'); await rejection;
    expect(game.renderSystem.camera).toBe(replacement); expect(game.update).toBe(update); expect(renderer.info.autoReset).toBe(true);
});

test('missing gameplay identities reject before phase hook installation', async () => {
    const { game, renderer, original } = phaseFixture(), update = game.update;
    delete game.renderSystem.scene;
    await expect(observeGameplayScene(game, 'missing-scene', { phases: true })).rejects.toThrow('gameplay scene and camera');
    expect(game.loop).toBe(original); expect(game.update).toBe(update); expect(renderer.info.autoReset).toBe(true);
});
