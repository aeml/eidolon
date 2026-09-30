import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';

let callbacks;
beforeEach(() => {
    callbacks = new Map(); let id = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callbacks.set(++id, callback); return id; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => callbacks.delete(id));
});
afterEach(() => jest.restoreAllMocks());
function harness() { return Object.assign(Object.create(RenderSystem.prototype), { render: jest.fn(), _disposed: false }); }
function frame() {
    const [id, callback] = callbacks.entries().next().value;
    callbacks.delete(id); callback(0);
}

test('two real frames prepare world, shadow and postprocessing before resolving', async () => {
    const render = harness(), done = jest.fn();
    const pending = render.prepareInitialView(); pending.then(done);
    expect(render.prepareInitialView()).toBe(pending);
    expect(render.render).not.toHaveBeenCalled();
    frame(); await Promise.resolve();
    expect(render.render).toHaveBeenCalledTimes(1); expect(done).not.toHaveBeenCalled();
    frame(); expect(await pending).toBe(true);
    expect(render.render).toHaveBeenCalledTimes(2);
    expect(callbacks.size).toBe(0); expect(render._initialViewPreparation).toBeNull();
});

test.each([0, 1])('cancelled entry stops before frame %s and releases its callback', async count => {
    const render = harness(); let active = true;
    const pending = render.prepareInitialView({ shouldContinue: () => active });
    if (count) frame();
    active = false; frame();
    expect(await pending).toBe(false); expect(render.render).toHaveBeenCalledTimes(count);
    expect(callbacks.size).toBe(0); expect(render._initialViewPreparation).toBeNull();
});

test('disposal ends a pending preparation even when the browser is not producing frames', async () => {
    const render = harness();
    const pending = render.prepareInitialView();
    Object.assign(render, { scene: { background: null }, disposePostProcessing: jest.fn(),
        disposeShadowTargets: jest.fn(), disposeObjectResources: jest.fn() });
    render.dispose();
    expect(await pending).toBe(false); expect(callbacks.size).toBe(0);
    expect(render.render).not.toHaveBeenCalled();
    expect(await render.prepareInitialView()).toBe(false);
});

test('a rendering failure rejects entry and leaves no callback or deduplication lock', async () => {
    const render = harness(), failure = new Error('Context failed');
    render.render.mockImplementation(() => { throw failure; });
    const pending = render.prepareInitialView(); frame();
    await expect(pending).rejects.toBe(failure);
    expect(callbacks.size).toBe(0); expect(render._initialViewPreparation).toBeNull();
});

test('disposal during rendering cannot schedule another frame after owned cancellation', async () => {
    const render = harness();
    Object.assign(render, { scene: { background: null }, disposePostProcessing: jest.fn(),
        disposeShadowTargets: jest.fn(), disposeObjectResources: jest.fn() });
    render.render.mockImplementation(() => render.dispose());
    const pending = render.prepareInitialView(); frame();
    expect(await pending).toBe(false); expect(callbacks.size).toBe(0);
});
