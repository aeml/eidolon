import { jest } from '@jest/globals';
import { createEngineModuleLoader } from '../src/core/EngineModuleLoader.js';

const downloadError = () => new TypeError('Failed to fetch dynamically imported module: fixture');

test('login stays lazy and concurrent starts share one successful module', async () => {
    let resolve;
    const load = jest.fn(() => new Promise(done => { resolve = done; })), recover = jest.fn();
    const enter = createEngineModuleLoader(load, recover);
    expect(load).not.toHaveBeenCalled();
    const first = enter(), second = enter();
    expect(first).toBe(second); await Promise.resolve();
    const module = { GameEngine: class {} }; resolve(module);
    expect(await first).toBe(module); expect(await enter()).toBe(module);
    expect(load).toHaveBeenCalledTimes(1); expect(recover).not.toHaveBeenCalled();
});

test('recognized interrupted downloads recover once and preserve the module identity', async () => {
    const module = { GameEngine: class {} }, load = jest.fn().mockRejectedValue(downloadError());
    const recover = jest.fn().mockResolvedValue(module), enter = createEngineModuleLoader(load, recover);
    expect(await enter()).toBe(module); expect(await enter()).toBe(module);
    expect(load).toHaveBeenCalledTimes(1); expect(recover).toHaveBeenCalledTimes(1);
});

test('persistent failure stays failed across repeated and concurrent clicks', async () => {
    const final = downloadError(), load = jest.fn().mockRejectedValue(downloadError());
    const recover = jest.fn().mockRejectedValue(final), enter = createEngineModuleLoader(load, recover);
    const first = enter(); expect(enter()).toBe(first);
    await expect(first).rejects.toBe(final); await expect(enter()).rejects.toBe(final);
    expect(load).toHaveBeenCalledTimes(1); expect(recover).toHaveBeenCalledTimes(1);
});

test.each([
    new SyntaxError('does not provide an export named GameEngine'),
    new TypeError('fixture evaluation error'),
    new Error('Failed to fetch dynamically imported module: thrown by application'),
    Object.assign(new Error('graphics error'), { code: 'WEBGL2_UNAVAILABLE' })
])('evaluation/export/graphics failures remain visible without module recovery %#', async error => {
    const load = jest.fn(() => { throw error; }), recover = jest.fn(), enter = createEngineModuleLoader(load, recover);
    await expect(enter()).rejects.toBe(error); await expect(enter()).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(1); expect(recover).not.toHaveBeenCalled();
});
