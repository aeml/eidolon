import { jest } from '@jest/globals';
import { observeWorldGpuTime } from './e2e/world-gpu-observation.js';

function fixture() {
    const extension = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
    let active = null, sequence = 0;
    const gl = {
        CURRENT_QUERY: 3, QUERY_RESULT_AVAILABLE: 4, QUERY_RESULT: 5,
        lost: false, disjoint: false, available: true,
        getExtension: jest.fn(() => extension), isContextLost: () => gl.lost,
        getParameter: () => gl.disjoint, getQuery: () => active,
        createQuery: jest.fn(() => ({ id: sequence++ })),
        beginQuery: jest.fn((target, query) => { expect(target).toBe(extension.TIME_ELAPSED_EXT); expect(active).toBeNull(); active = query; }),
        endQuery: jest.fn(() => { active = null; }), deleteQuery: jest.fn(),
        getQueryParameter: jest.fn((query, parameter) => parameter === gl.QUERY_RESULT_AVAILABLE ? gl.available : (query.id + 1) * 1_000_000),
        externalQuery: query => { active = query; }
    };
    const original = jest.fn(function () { expect(this).toBe(renderer); return 'original-result'; });
    const renderer = Object.assign(Object.create({ render: original }), { getContext: () => gl });
    const game = { renderSystem: { renderer, scene: {}, camera: {} }, activeEntitiesCache: [1, 2, 3] };
    const draw = () => renderer.render(game.renderSystem.scene, game.renderSystem.camera);
    return { game, renderer, gl, original, draw };
}
function drive(draw, count = 240) { for (let i = 0; i < count; i++) expect(draw()).toBe('original-result'); }
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test('world queries are asynchronous, bounded, ordered and cleaned after all180results', async () => {
    const { game, renderer, gl, original, draw } = fixture();
    const promise = observeWorldGpuTime(game, 'world');
    drive(draw, 60); expect(gl.createQuery).not.toHaveBeenCalled();
    drive(draw, 180); expect(gl.createQuery).toHaveBeenCalledTimes(180);
    expect(gl.getQueryParameter).not.toHaveBeenCalled();
    drive(draw, 5); expect(gl.createQuery).toHaveBeenCalledTimes(180);
    jest.advanceTimersByTime(16); const report = await promise;
    expect(report.calls).toBe(180); expect(report.samples.map(row => row.gpuMs)).toEqual(Array.from({ length: 180 }, (_, i) => i + 1));
    expect(report.gpuMedianMs).toBe(90); expect(report.gpuP95Ms).toBe(171);
    expect(report.samples.every(row => row.activeEntities === 3 && row.visibility === 'visible')).toBe(true);
    expect(gl.beginQuery).toHaveBeenCalledTimes(180); expect(gl.endQuery).toHaveBeenCalledTimes(180);
    expect(gl.deleteQuery).toHaveBeenCalledTimes(180); expect(new Set(gl.deleteQuery.mock.calls.map(([q]) => q)).size).toBe(180);
    expect(original).toHaveBeenCalledTimes(245); expect(renderer.render).toBe(original); expect(Object.hasOwn(renderer, 'render')).toBe(false);
    expect(jest.getTimerCount()).toBe(0); expect(report.restored).toBe(true);
});

test('only exact scene AND camera advance warmup and queries; other calls preserve arguments and returns', async () => {
    const { game, renderer, gl, original, draw } = fixture();
    const promise = observeWorldGpuTime(game, 'roles');
    for (let i = 0; i < 240; i++) {
        expect(renderer.render({}, game.renderSystem.camera, 'other-scene')).toBe('original-result');
        expect(renderer.render(game.renderSystem.scene, {}, 'other-camera')).toBe('original-result');
    }
    expect(gl.createQuery).not.toHaveBeenCalled(); drive(draw);
    jest.advanceTimersByTime(16); await promise;
    expect(original).toHaveBeenCalledTimes(720); expect(original.mock.calls[0][2]).toBe('other-scene');
});

test('CPU clocks cover the same world call and own non-enumerable descriptor is restored exactly', async () => {
    const { game, renderer, original, draw } = fixture();
    Object.defineProperty(renderer, 'render', { value: original, writable: true, configurable: true, enumerable: false });
    const descriptor = Object.getOwnPropertyDescriptor(renderer, 'render');
    original.mockImplementation(() => { jest.setSystemTime(Date.now() + 5); return 'original-result'; });
    const clock = jest.spyOn(performance, 'now'); let time = 0; clock.mockImplementation(() => time += 5);
    const promise = observeWorldGpuTime(game, 'cpu'); drive(draw); jest.advanceTimersByTime(16);
    const report = await promise; expect(report.cpuMedianMs).toBe(5); expect(report.cpuP95Ms).toBe(5);
    expect(Object.getOwnPropertyDescriptor(renderer, 'render')).toEqual(descriptor); clock.mockRestore();
});

test.each(['warmup', 'measured', 'other'])('an original %s render exception propagates once and restores resources', async stage => {
    const { game, renderer, gl, original, draw } = fixture(); const error = new Error('original-render-error');
    const promise = observeWorldGpuTime(game, 'exception'); if (stage === 'measured') drive(draw, 60);
    const before = original.mock.calls.length;
    original.mockImplementation(() => { throw error; });
    const rejection = expect(promise).rejects.toBe(error);
    expect(() => stage === 'other' ? renderer.render({}, {}) : draw()).toThrow(error);
    await rejection; expect(original).toHaveBeenCalledTimes(before + 1); expect(renderer.render).toBe(original);
    expect(gl.deleteQuery).toHaveBeenCalledTimes(stage === 'measured' ? 1 : 0); expect(gl.getQuery()).toBeNull();
});

test.each(['lost', 'disjoint'])('%s context invalidates the whole window and deletes pending queries', async condition => {
    const { game, renderer, gl, original, draw } = fixture(); const promise = observeWorldGpuTime(game, condition);
    drive(draw, 65); gl[condition] = true;
    const rejection = expect(promise).rejects.toThrow(condition === 'lost' ? 'context lost' : 'disjoint');
    jest.advanceTimersByTime(16); await rejection;
    expect(gl.deleteQuery).toHaveBeenCalledTimes(5); expect(renderer.render).toBe(original); expect(jest.getTimerCount()).toBe(0);
});

test('disjoint observed after reading a result invalidates even completed readings', async () => {
    const { game, gl, draw } = fixture(); const promise = observeWorldGpuTime(game, 'late-disjoint'); drive(draw);
    const read = gl.getQueryParameter.getMockImplementation();
    gl.getQueryParameter.mockImplementation((q, parameter) => { const result = read(q, parameter); if (parameter === gl.QUERY_RESULT) gl.disjoint = true; return result; });
    const rejection = expect(promise).rejects.toThrow('disjoint'); jest.advanceTimersByTime(16); await rejection;
    expect(gl.deleteQuery).toHaveBeenCalledTimes(180);
});

test('pending query results time out without waiting for GPU or leaking any query', async () => {
    const { game, gl, renderer, original, draw } = fixture(); gl.available = false;
    const promise = observeWorldGpuTime(game, 'pending'); drive(draw);
    const rejection = expect(promise).rejects.toThrow('180 pending queries'); jest.advanceTimersByTime(45_000); await rejection;
    expect(gl.getQueryParameter.mock.calls.every(([, parameter]) => parameter === gl.QUERY_RESULT_AVAILABLE)).toBe(true);
    expect(gl.deleteQuery).toHaveBeenCalledTimes(180); expect(renderer.render).toBe(original); expect(jest.getTimerCount()).toBe(0);
});

test('an external elapsed query is preserved and profiling never interrupts original drawing', async () => {
    const { game, gl, original, draw } = fixture(); const promise = observeWorldGpuTime(game, 'conflict'); drive(draw, 60);
    const foreign = {}; gl.externalQuery(foreign); const rejection = expect(promise).rejects.toThrow('active elapsed query');
    expect(draw()).toBe('original-result'); await rejection;
    expect(original).toHaveBeenCalledTimes(61); expect(gl.getQuery()).toBe(foreign); expect(gl.endQuery).not.toHaveBeenCalled();
});

test.each(['scene', 'camera', 'renderer', 'destroyed', 'hook'])('changed %s ownership rejects without overwriting replacements', async field => {
    const { game, renderer, gl, original, draw } = fixture(); const promise = observeWorldGpuTime(game, 'ownership'); drive(draw, 65);
    const replacement = () => 'replacement';
    if (field === 'hook') renderer.render = replacement;
    else if (field === 'destroyed') game.isDestroyed = true;
    else game.renderSystem[field] = {};
    const rejection = expect(promise).rejects.toThrow('ownership'); jest.advanceTimersByTime(16); await rejection;
    expect(renderer.render).toBe(field === 'hook' ? replacement : original); expect(gl.deleteQuery).toHaveBeenCalledTimes(5);
});

test('a second observer rejects without disturbing the first; completed renderers can be reused', async () => {
    const { game, renderer, draw } = fixture(); const promise = observeWorldGpuTime(game, 'first'), hook = renderer.render;
    await expect(observeWorldGpuTime(game, 'second')).rejects.toThrow('already'); expect(renderer.render).toBe(hook);
    drive(draw); jest.advanceTimersByTime(16); await promise;
    const second = observeWorldGpuTime(game, 'again'); drive(draw); jest.advanceTimersByTime(16); await second;
});

test.each(['unsupported', 'readonly', 'active'])('%s setup rejects before taking renderer or query ownership', async mode => {
    const { game, renderer, gl, original } = fixture(); const foreign = {};
    if (mode === 'unsupported') gl.getExtension.mockReturnValue(null);
    if (mode === 'readonly') Object.defineProperty(renderer, 'render', { value: original, writable: false, configurable: true });
    if (mode === 'active') gl.externalQuery(foreign);
    await expect(observeWorldGpuTime(game, mode)).rejects.toThrow(); expect(renderer.render).toBe(original);
    expect(gl.createQuery).not.toHaveBeenCalled(); expect(gl.getQuery()).toBe(mode === 'active' ? foreign : null);
    expect(jest.getTimerCount()).toBe(0);
});

test.each([NaN, -1])('invalid elapsed result %s rejects with complete query cleanup', async elapsed => {
    const { game, gl, draw } = fixture(); const promise = observeWorldGpuTime(game, 'invalid'); drive(draw, 61);
    gl.getQueryParameter.mockImplementation((q, parameter) => parameter === gl.QUERY_RESULT_AVAILABLE ? true : elapsed);
    const rejection = expect(promise).rejects.toThrow('invalid elapsed'); jest.advanceTimersByTime(16); await rejection;
    expect(gl.deleteQuery).toHaveBeenCalledTimes(1);
});

test('a failed allocation rejects without replaying or preventing the ordinary draw', async () => {
    const { game, gl, original, draw } = fixture(); const promise = observeWorldGpuTime(game, 'allocation'); drive(draw, 60);
    gl.createQuery.mockReturnValue(null); const rejection = expect(promise).rejects.toThrow('allocate');
    expect(draw()).toBe('original-result'); await rejection;
    expect(original).toHaveBeenCalledTimes(61); expect(gl.beginQuery).not.toHaveBeenCalled(); expect(gl.deleteQuery).not.toHaveBeenCalled();
});

test('a foreign query installed inside rendering survives ownership failure and only the owned query is deleted', async () => {
    const { game, gl, original, draw } = fixture(); const promise = observeWorldGpuTime(game, 'query-owner'); drive(draw, 60);
    const foreign = {}; original.mockImplementation(() => { gl.externalQuery(foreign); return 'original-result'; });
    const rejection = expect(promise).rejects.toThrow('query ownership'); expect(draw()).toBe('original-result'); await rejection;
    expect(gl.getQuery()).toBe(foreign); expect(gl.endQuery).not.toHaveBeenCalled();
    expect(gl.deleteQuery).toHaveBeenCalledTimes(1); expect(gl.deleteQuery.mock.calls[0][0]).not.toBe(foreign);
});

test('no world draws time out and release the observer for a later attempt', async () => {
    const { game, renderer, original, draw } = fixture(); const promise = observeWorldGpuTime(game, 'inactive');
    const rejection = expect(promise).rejects.toThrow('0 calls'); jest.advanceTimersByTime(45_000); await rejection;
    expect(renderer.render).toBe(original); const next = observeWorldGpuTime(game, 'active'); drive(draw); jest.advanceTimersByTime(16); await next;
});
