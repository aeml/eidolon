import { jest } from '@jest/globals';
import { Group, Scene } from 'three';
import { prepareConnectedPlayerView, cancelConnectedPlayerView } from '../src/core/ConnectedViewPreparation.js';

let callbacks, nextId;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function frame() {
    const entry = callbacks.entries().next().value;
    expect(entry).toBeDefined();
    callbacks.delete(entry[0]); entry[1](0);
}
function harness({ ready = true, equipment } = {}) {
    const scene = new Scene(), root = new Group(); scene.add(root);
    root.userData.equipmentReady = equipment;
    return { isMultiplayer: true, isDestroyed: false, _initialPlayerStateReceived: ready,
        player: { mesh: root, isActive: true, isMeshLoading: false },
        renderSystem: { scene, prepareInitialView: jest.fn(async ({ shouldContinue }) => shouldContinue()) } };
}
beforeEach(() => {
    jest.useFakeTimers(); callbacks = new Map(); nextId = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { callbacks.set(++nextId, cb); return nextId; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => callbacks.delete(id));
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('world state alone cannot prepare default gear before the authoritative local appearance', async () => {
    const equipment = deferred(), engine = harness({ ready: false, equipment: equipment.promise });
    engine._firstStateReceived = true;
    const pending = prepareConnectedPlayerView(engine);
    equipment.resolve(); await flush(); frame();
    expect(engine.renderSystem.prepareInitialView).not.toHaveBeenCalled();
    engine._initialPlayerStateReceived = true;
    frame(); await flush(); frame();
    expect(await pending).toBe(true);
    expect(engine.renderSystem.prepareInitialView).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
});

test('saved fitted equipment keeps entry pending until it settles', async () => {
    const equipment = deferred(), engine = harness({ equipment: equipment.promise }), done = jest.fn();
    const pending = prepareConnectedPlayerView(engine); pending.then(done);
    frame(); await flush();
    expect(done).not.toHaveBeenCalled(); expect(engine.renderSystem.prepareInitialView).not.toHaveBeenCalled();
    equipment.resolve(); await flush(); frame();
    expect(await pending).toBe(true);
});

test('a superseded equipment load cannot prepare or fail the current appearance', async () => {
    const old = deferred(), fresh = deferred(), engine = harness({ equipment: old.promise });
    const pending = prepareConnectedPlayerView(engine);
    engine.player.mesh.userData.equipmentReady = fresh.promise; frame();
    old.reject(new Error('retired outfit')); await flush(); frame();
    expect(engine.renderSystem.prepareInitialView).not.toHaveBeenCalled();
    fresh.resolve(); await flush(); frame(); expect(await pending).toBe(true);
});

test('an appearance replaced during GPU preparation must prepare its new root', async () => {
    const engine = harness(), firstWarm = deferred();
    engine.renderSystem.prepareInitialView.mockReturnValueOnce(firstWarm.promise);
    const pending = prepareConnectedPlayerView(engine);
    const shouldContinue = engine.renderSystem.prepareInitialView.mock.calls[0][0].shouldContinue;
    const root = new Group(); engine.renderSystem.scene.add(root); engine.player.mesh = root;
    expect(shouldContinue()).toBe(false);
    firstWarm.resolve(true); await flush(); frame();
    expect(await pending).toBe(true); expect(engine.renderSystem.prepareInitialView).toHaveBeenCalledTimes(2);
});

test('temporary detachment during equipment completion does not strand later attachment', async () => {
    const equipment = deferred(), engine = harness({ equipment: equipment.promise }), root = engine.player.mesh;
    const pending = prepareConnectedPlayerView(engine);
    root.removeFromParent(); equipment.resolve(); await flush(); frame();
    expect(engine.renderSystem.prepareInitialView).not.toHaveBeenCalled();
    engine.renderSystem.scene.add(root); frame(); expect(await pending).toBe(true);
});

test('current equipment failure rejects entry and releases callbacks and timeout', async () => {
    const equipment = deferred(), engine = harness({ equipment: equipment.promise }), failure = new Error('gear unavailable');
    const pending = prepareConnectedPlayerView(engine), rejected = expect(pending).rejects.toBe(failure);
    equipment.reject(failure); await flush(); frame(); await rejected;
    expect(callbacks.size).toBe(0); expect(jest.getTimerCount()).toBe(0); expect(engine._connectedViewPreparation).toBeNull();
});

test('explicit cancellation settles even without browser frames', async () => {
    const engine = harness({ ready: false }), pending = prepareConnectedPlayerView(engine);
    cancelConnectedPlayerView(engine); cancelConnectedPlayerView(engine);
    expect(await pending).toBe(false); expect(callbacks.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
});

test('bounded timeout rejects even when animation frames are suspended', async () => {
    const engine = harness({ ready: false }), pending = prepareConnectedPlayerView(engine, { timeoutMs: 100 });
    const rejected = expect(pending).rejects.toThrow('character view did not finish loading');
    await jest.advanceTimersByTimeAsync(100); await rejected;
    expect(callbacks.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
});

test.each(['destroyed', 'player-replaced', 'renderer-disposed'])('%s cannot finish another owner\'s entry', async kind => {
    const engine = harness({ ready: false }), pending = prepareConnectedPlayerView(engine);
    if (kind === 'destroyed') engine.isDestroyed = true;
    if (kind === 'player-replaced') engine.player = { ...engine.player };
    if (kind === 'renderer-disposed') engine.renderSystem._disposed = true;
    frame(); expect(await pending).toBe(false);
});

test('fallback visuals can prepare without optional geometry-worker or remote-asset completion', async () => {
    const engine = harness(); engine.renderSystem.actorGameplayGeometry = { delivery: { jobs: new Map([[{}, {}]]) } };
    expect(await prepareConnectedPlayerView(engine)).toBe(true);
    expect(engine.renderSystem.prepareInitialView).toHaveBeenCalledTimes(1);
});

test('deduplication and old completion leave a newer entry owner intact', async () => {
    const engine = harness(), oldWarm = deferred(); engine.renderSystem.prepareInitialView.mockReturnValueOnce(oldWarm.promise);
    const old = prepareConnectedPlayerView(engine); expect(prepareConnectedPlayerView(engine)).toBe(old);
    cancelConnectedPlayerView(engine); expect(await old).toBe(false);
    engine._initialPlayerStateReceived = false;
    const fresh = prepareConnectedPlayerView(engine), owner = engine._connectedViewPreparation;
    oldWarm.resolve(true); await flush(); expect(engine._connectedViewPreparation).toBe(owner);
    cancelConnectedPlayerView(engine); expect(await fresh).toBe(false);
});

test('render errors preserve failure and release the pending owner', async () => {
    const engine = harness(), failure = new Error('GPU context failed');
    engine.renderSystem.prepareInitialView.mockImplementation(() => { throw failure; });
    await expect(prepareConnectedPlayerView(engine)).rejects.toBe(failure);
    expect(engine._connectedViewPreparation).toBeNull(); expect(jest.getTimerCount()).toBe(0);
});

test('offline and destroyed sessions do not start connected-view work', async () => {
    const offline = harness(); offline.isMultiplayer = false;
    expect(await prepareConnectedPlayerView(offline)).toBe(true); expect(offline.renderSystem.prepareInitialView).not.toHaveBeenCalled();
    const destroyed = harness(); destroyed.isDestroyed = true;
    expect(await prepareConnectedPlayerView(destroyed)).toBe(false); expect(callbacks.size).toBe(0);
});
