import { jest } from '@jest/globals';
import { observeProgramFeatures } from './e2e/program-feature-observation.js';

function fixture() {
    const states = new WeakMap(), regular = {}, skinned = {}, material = { type: 'MeshStandardMaterial', version: 1 };
    states.set(material, { __version: 1, skinning: false, instancing: false, batching: false,
        currentProgram: regular, programs: new Map([['regular', regular], ['skinned', skinned]]) });
    const objects = [{ isSkinnedMesh: true, name: 'private-account-name' }, { isSkinnedMesh: false }];
    const direct = jest.fn(function (camera, scene, geometry, value, object) {
        expect(this).toBe(renderer);
        if (object.fail) throw new Error('original draw failed');
        if (object.skip) return 'skipped';
        const properties = states.get(value);
        if (object.versionChange) { value.version++; properties.__version = value.version; }
        properties.skinning = object.isSkinnedMesh === true;
        properties.currentProgram = properties.skinning ? skinned : regular;
        renderer.info.render.calls++; return 'drawn';
    });
    const render = jest.fn(function (scene, camera) {
        expect(this).toBe(renderer);
        for (const object of objects) renderer.renderBufferDirect(camera, scene, object.geometry || {}, material, object, null);
        return 'rendered';
    });
    const renderer = Object.assign(Object.create({ render, renderBufferDirect: direct }), {
        properties: { get: value => states.get(value) }, info: { render: { calls: 0 } }
    });
    const game = { renderSystem: { renderer, scene: {}, camera: {} } };
    const draw = () => renderer.render(game.renderSystem.scene, game.renderSystem.camera);
    return { game, renderer, render, direct, objects, draw };
}
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test('counts actual shared-material variant transitions, retains calls and restores inherited hooks', async () => {
    const { game, renderer, render, direct, draw } = fixture();
    const pending = observeProgramFeatures(game, { frames: 2 });
    expect(draw()).toBe('rendered'); expect(draw()).toBe('rendered');
    const report = await pending;
    expect(report).toMatchObject({ frames: 2, visibleFrames: 2, submitted: 4, skipped: 0, restored: true,
        changes: { skinning: 4 }, mismatches: { skinning: 4 } });
    expect(report.materials[0]).toMatchObject({ draws: 4, changedDraws: 4, programTransitions: 4, cacheEntriesMin: 2, cacheEntriesMax: 2 });
    expect(JSON.stringify(report)).not.toContain('private-account-name');
    expect(renderer.render).toBe(render); expect(renderer.renderBufferDirect).toBe(direct);
    expect(Object.hasOwn(renderer, 'render')).toBe(false); expect(Object.hasOwn(renderer, 'renderBufferDirect')).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
});

test('ignores other scene/camera calls and existing batch skips', async () => {
    const { game, renderer, objects, draw } = fixture(); objects[0].skip = true;
    const pending = observeProgramFeatures(game, { frames: 1 });
    expect(renderer.render({}, game.renderSystem.camera)).toBe('rendered');
    expect(renderer.render(game.renderSystem.scene, {})).toBe('rendered');
    draw(); const report = await pending;
    expect(report).toMatchObject({ frames: 1, directCalls: 2, submitted: 1, skipped: 1, changes: {}, mismatches: {} });
});

test('original rendering errors propagate and restore both methods', async () => {
    const { game, renderer, render, direct, objects, draw } = fixture(); objects[0].fail = true;
    const pending = observeProgramFeatures(game, { frames: 1 });
    const rejection = expect(pending).rejects.toThrow('original draw failed');
    expect(draw).toThrow('original draw failed'); await rejection;
    expect(renderer.render).toBe(render); expect(renderer.renderBufferDirect).toBe(direct);
    expect(jest.getTimerCount()).toBe(0);
});

test('does not overwrite an external replacement on ownership loss', async () => {
    const { game, renderer, render, draw } = fixture();
    const pending = observeProgramFeatures(game, { frames: 1 });
    const replacement = jest.fn(); renderer.renderBufferDirect = replacement;
    const rejection = expect(pending).rejects.toThrow('ownership');
    expect(draw).toThrow('ownership'); await rejection;
    expect(renderer.render).toBe(render); expect(renderer.renderBufferDirect).toBe(replacement);
    expect(jest.getTimerCount()).toBe(0);
});

test('bounded idle timeout restores hooks and allows a later observer', async () => {
    const { game, renderer, render, direct, draw } = fixture();
    const pending = observeProgramFeatures(game, { frames: 1 });
    const rejection = expect(pending).rejects.toThrow('deadline');
    jest.advanceTimersByTime(20_000); await rejection;
    expect(renderer.render).toBe(render); expect(renderer.renderBufferDirect).toBe(direct);
    const later = observeProgramFeatures(game, { frames: 1 }); draw(); expect((await later).frames).toBe(1);
});

test('describes repeated version-changing geometry once without altering source attributes', async () => {
    const { game, objects, draw } = fixture();
    const positions = Object.freeze([Object.freeze([-1, -1, 0]), Object.freeze([1, -1, 0]),
        Object.freeze([-1, 1, 0]), Object.freeze([1, 1, 0])]);
    const position = { count: 4, getX: jest.fn(i => positions[i][0]), getY: i => positions[i][1], getZ: i => positions[i][2] };
    const geometry = { type: 'PlaneGeometry', attributes: { position }, index: { count: 6 } };
    objects[0].geometry = geometry; objects[0].versionChange = true;
    const pending = observeProgramFeatures(game, { frames: 3 }); draw(); draw(); draw();
    const report = await pending;
    expect(report.materials[0].versionChangingShapes).toEqual([expect.objectContaining({
        type: 'PlaneGeometry', vertices: 4, indices: 6, bounds: { min: [-1, -1, 0], max: [1, 1, 0] }, flatAxes: [2]
    })]);
    expect(position.getX).toHaveBeenCalledTimes(4); expect(objects[0].geometry).toBe(geometry);
    expect(positions[0]).toEqual([-1, -1, 0]);
});
