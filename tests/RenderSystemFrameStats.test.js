import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';

function createFrameHarness() {
    const info = {
        autoReset: true,
        render: { calls: 999, triangles: 999 },
        reset: jest.fn(function () { this.render = { calls: 0, triangles: 0 }; })
    };
    const submit = (calls, triangles) => {
        if (info.autoReset) info.reset();
        info.render.calls += calls;
        info.render.triangles += triangles;
    };
    const system = Object.assign(Object.create(RenderSystem.prototype), {
        renderer: { info, render: jest.fn(() => submit(12, 240)) },
        composer: { render: jest.fn(() => { submit(20, 300); submit(1, 1); submit(1, 1); }) },
        usePostProcessing: true,
        updatePerfOverlay: jest.fn()
    });
    return { system, info };
}

describe('whole-frame render statistics', () => {
    test('aggregates composer passes, clears old frames and restores renderer policy', () => {
        const { system, info } = createFrameHarness();
        system.render();
        expect(info.render).toEqual({ calls: 22, triangles: 302 });
        expect(info.autoReset).toBe(true);
        system.render();
        expect(info.render).toEqual({ calls: 22, triangles: 302 });
        expect(info.reset).toHaveBeenCalledTimes(2);
        expect(system.updatePerfOverlay).toHaveBeenCalledTimes(2);
    });

    test('quality changes report only the new direct-render frame', () => {
        const { system, info } = createFrameHarness();
        system.render();
        system.usePostProcessing = false;
        system.render();
        expect(info.render).toEqual({ calls: 12, triangles: 240 });
        expect(system.renderer.render).toHaveBeenCalledTimes(1);
    });

    test('restores a profiler-owned policy even when rendering fails', () => {
        const { system, info } = createFrameHarness();
        info.autoReset = false;
        system.composer.render.mockImplementation(() => { throw new Error('context lost'); });
        expect(() => system.render()).toThrow('context lost');
        expect(info.autoReset).toBe(false);
        expect(system.updatePerfOverlay).not.toHaveBeenCalled();
        info.autoReset = true;
        expect(() => system.render()).toThrow('context lost');
        expect(info.autoReset).toBe(true);
    });
});
