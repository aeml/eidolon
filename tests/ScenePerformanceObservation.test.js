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

test('immediate activity samples contain180real intervals and distinguish attack from recovery', async () => {
    const { game, renderer, original } = fixture();
    let boneValue = 0;
    game.player = { state: 'ATTACKING', stats: { hp: 300 }, position: { toArray: () => [2, 0, 4] },
        currentAction: { time: 0, getClip: () => ({ name: game.player.state === 'ATTACKING' ? 'Attack' : 'Idle' }) },
        mesh: { position: { toArray: () => [2, 0, 4] }, getObjectByProperty: () =>
            ({ name: 'Hips', quaternion: { toArray: () => [boneValue, 0, 0, 1] } }) } };
    const promise = observeGameplayScene(game, 'mixed-fight', { warmupFrames: 0, activity: true });
    game.loop(0);
    for (let i = 1; i <= 180; i++) {
        game.player.state = i <= 90 ? 'ATTACKING' : 'IDLE';
        game.player.currentAction.time = i / 100; boneValue = i;
        game.loop(Number(BigInt(i) * 167000n) / 10000);
    }
    const report = await promise;
    expect(report.frames).toBe(180); expect(report.warmupFrames).toBe(0); expect(report.observedBone).toBe('Hips');
    expect(report.frameSamples.every(row => row.intervalMs === 16.7 && row.previousTime !== null)).toBe(true);
    expect(report.frameSamples.filter(row => row.activity.localClip === 'Attack')).toHaveLength(90);
    expect(report.frameSamples.filter(row => row.activity.localClip === 'Idle')).toHaveLength(90);
    expect(report.frameSamples[0].activity.bone).toEqual([1, 0, 0, 1]);
    expect(report.frameSamples[179].activity.bone).toEqual([180, 0, 0, 1]);
    expect(game.loop).toBe(original); expect(renderer.info.autoReset).toBe(true);
});

test.each([-1, 1.5, NaN, 61])('invalid warmup%s cannot alter the original loop or render policy', async warmupFrames => {
    const { game, renderer, original } = fixture();
    await expect(observeGameplayScene(game, 'invalid', { warmupFrames })).rejects.toThrow('QA warmup');
    expect(game.loop).toBe(original); expect(Object.hasOwn(game, 'loop')).toBe(false);
    expect(renderer.info.autoReset).toBe(true);
});

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
