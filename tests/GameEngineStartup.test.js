import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => ({
    eidolon: { state: { StateEnvelope: { decode: jest.fn() } } }
}));
const { GameEngine } = await import('../src/core/GameEngine.js');
const { MeshFactory } = await import('../src/utils/MeshFactory.js');

const engines = [];
function harness() {
    const engine = Object.create(GameEngine.prototype);
    Object.assign(engine, {
        playerType: 'Fighter', username: '', isMultiplayer: true, isDestroyed: false,
        addEntity: jest.fn(), syncDeathScreen: jest.fn(),
        uiBindings: { bindSessionCallbacks: jest.fn() },
        renderSystem: { preloadEnvironment: jest.fn(async () => {}) },
        worldGenerator: { createTownBase: jest.fn(async () => {}) },
        chunkManager: { update: jest.fn() },
        inputManager: { subscribe: jest.fn() },
        startDeferredOverworldScenery: jest.fn(async () => true),
        connectToServer: jest.fn(), loop: jest.fn()
    });
    engines.push(engine);
    return engine;
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(MeshFactory, 'preloadAllModels').mockResolvedValue({ failures: [] });
});
afterEach(() => {
    engines.splice(0).forEach(engine => engine.player?.dispose());
    jest.restoreAllMocks(); jest.useRealTimers();
});

test('ready startup keeps required assets and controls, without a fabricated silicon wait', async () => {
    const engine = harness(), progress = jest.fn(), start = Date.now();
    const task = engine.loadGame(progress);
    await jest.runAllTimersAsync(); await task;
    expect(Date.now() - start).toBeLessThanOrEqual(300);
    expect(MeshFactory.preloadAllModels).toHaveBeenCalledWith(expect.objectContaining({
        phase: 'startup', playerType: 'Fighter', concurrency: 2, timeoutMs: 30000
    }));
    expect(engine.worldGenerator.createTownBase).toHaveBeenCalledWith(0, 200, 100);
    expect(engine.startDeferredOverworldScenery).toHaveBeenCalledTimes(1);
    expect(engine.inputManager.subscribe).toHaveBeenCalledWith('onClick', expect.any(Function));
    expect(progress).toHaveBeenLastCalledWith(100, 'Ready!');
    expect(progress.mock.calls.some(([, text]) => text.includes('silicon'))).toBe(false);
    expect(engine.connectToServer).toHaveBeenCalledTimes(1);
    expect(engine.loop).toHaveBeenCalledWith(0);
});

test('an already destroyed engine starts no player, asset or network work', async () => {
    const engine = harness(), progress = jest.fn(); engine.isDestroyed = true;
    const task = engine.loadGame(progress);
    await jest.runAllTimersAsync(); await task;
    expect(engine.player).toBeUndefined();
    expect(progress).not.toHaveBeenCalled();
    expect(MeshFactory.preloadAllModels).not.toHaveBeenCalled();
    expect(engine.connectToServer).not.toHaveBeenCalled();
    expect(engine.loop).not.toHaveBeenCalled();
});

test.each(['environment', 'models', 'town'])('cancelling while %s is loading does not start further scenery, bind controls or rejoin', async stage => {
    const engine = harness(), progress = jest.fn(); let complete;
    const pending = new Promise(resolve => { complete = resolve; });
    if (stage === 'environment') engine.renderSystem.preloadEnvironment.mockReturnValue(pending);
    if (stage === 'models') MeshFactory.preloadAllModels.mockReturnValue(pending);
    if (stage === 'town') engine.worldGenerator.createTownBase.mockReturnValue(pending);
    const task = engine.loadGame(progress);
    await jest.runAllTimersAsync();
    const expectedProgress = { environment: 40, models: 55, town: 75 }[stage];
    expect(progress.mock.calls.at(-1)[0]).toBe(expectedProgress);
    engine.isDestroyed = true; complete({ failures: [] });
    await jest.runAllTimersAsync(); await task;
    if (stage === 'environment') expect(MeshFactory.preloadAllModels).not.toHaveBeenCalled();
    if (stage !== 'town') expect(engine.worldGenerator.createTownBase).not.toHaveBeenCalled();
    expect(engine.startDeferredOverworldScenery).not.toHaveBeenCalled();
    expect(engine.inputManager.subscribe).not.toHaveBeenCalled();
    expect(engine.connectToServer).not.toHaveBeenCalled();
    expect(engine.loop).not.toHaveBeenCalled();
    expect(progress.mock.calls.some(([value]) => value === 100)).toBe(false);
});

test('cancelling on the controls progress step never joins or begins another loop', async () => {
    const engine = harness();
    const progress = jest.fn((value, text) => {
        if (text === 'Setting up Controls...') engine.isDestroyed = true;
    });
    const task = engine.loadGame(progress);
    await jest.runAllTimersAsync(); await task;
    expect(engine.inputManager.subscribe).not.toHaveBeenCalled();
    expect(engine.connectToServer).not.toHaveBeenCalled();
    expect(engine.loop).not.toHaveBeenCalled();
    expect(progress.mock.calls.some(([value]) => value === 100)).toBe(false);
});

test.each(['town', 'structures'])('the compatible generator path also stops after a cancelled %s await', async stage => {
    const engine = harness(); delete engine.worldGenerator.createTownBase;
    let complete; const pending = new Promise(resolve => { complete = resolve; });
    engine.worldGenerator.createTown = jest.fn(async () => {});
    engine.worldGenerator.createOverworldStructures = jest.fn(async () => {});
    if (stage === 'town') engine.worldGenerator.createTown.mockReturnValue(pending);
    else engine.worldGenerator.createOverworldStructures.mockReturnValue(pending);
    const task = engine.loadGame(); await jest.runAllTimersAsync();
    engine.isDestroyed = true; complete();
    await jest.runAllTimersAsync(); await task;
    if (stage === 'town') expect(engine.worldGenerator.createOverworldStructures).not.toHaveBeenCalled();
    expect(engine.inputManager.subscribe).not.toHaveBeenCalled();
    expect(engine.connectToServer).not.toHaveBeenCalled();
    expect(engine.loop).not.toHaveBeenCalled();
});

test('a session cancelled by the ready callback cannot send a stale join', async () => {
    const engine = harness();
    const task = engine.loadGame(value => { if (value === 100) engine.isDestroyed = true; });
    await jest.runAllTimersAsync(); await task;
    expect(engine.connectToServer).not.toHaveBeenCalled();
    expect(engine.loop).not.toHaveBeenCalled();
});
