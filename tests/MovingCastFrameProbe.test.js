import { jest } from '@jest/globals';
import { sampleMovingCastFrames } from './movingCastFrameProbe.js';

let now, callbacks;
beforeEach(() => {
    now = 0; callbacks = [];
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => callbacks.push(callback));
});
afterEach(() => { jest.restoreAllMocks(); delete window.game; });

function game() {
    return Object.assign(Object.create({
        update(delta) { now += 2; return this.player.position.x + delta; },
        render(alpha) { now += 3; return alpha; }
    }), { player: { position: { x: 4, z: 8 }, state: 'MOVING', targetPosition: { x: 20, z: 8 },
        currentAbilityAnimation: { skillName: 'Fireball' } },
    renderSystem: { renderer: { info: { render: { calls: 120, triangles: 5000 } } } } });
}

test('profiles real calls without changing returns, sampling deadline or prototype ownership', async () => {
    window.game = game();
    const probe = sampleMovingCastFrames(650);
    expect(window.game.update(.5)).toBe(4.5);
    expect(window.game.render(.25)).toBe(.25);
    now = 17; callbacks.shift()(16);
    now = 640; callbacks.shift()(639);
    expect(Object.hasOwn(window.game, 'update')).toBe(true);
    now = 652; callbacks.shift()(651);
    const frames = await probe;
    expect(frames).toHaveLength(3);
    expect(frames[0]).toMatchObject({ elapsedMs: 16, observedElapsedMs: 17, callbackLagMs: 1,
        x: 4, z: 8, state: 'MOVING', ability: 'Fireball', targetX: 20, targetZ: 8,
        updateMs: 2, updateCalls: 1, renderMs: 3, renderCalls: 1, drawCalls: 120, triangles: 5000 });
    expect(frames[1]).toMatchObject({ updateMs: 0, updateCalls: 0, renderMs: 0, renderCalls: 0 });
    expect(Object.hasOwn(window.game, 'update')).toBe(false);
    expect(Object.hasOwn(window.game, 'render')).toBe(false);
    expect(callbacks).toHaveLength(0);
});

test('a failed game update still throws and its time is counted; the original method is restored', async () => {
    window.game = game();
    const original = window.game.update = function () { now += 7; throw new Error('tick failed'); };
    const descriptor = Object.getOwnPropertyDescriptor(window.game, 'update');
    const probe = sampleMovingCastFrames(650);
    expect(() => window.game.update()).toThrow('tick failed');
    now = 651; callbacks.shift()(651);
    expect((await probe)[0]).toMatchObject({ updateMs: 7, updateCalls: 1 });
    expect(window.game.update).toBe(original);
    expect(Object.getOwnPropertyDescriptor(window.game, 'update')).toEqual(descriptor);
});

test('sampling failure rejects and restores instrumentation', async () => {
    window.game = game();
    const probe = sampleMovingCastFrames(650);
    Object.defineProperty(window.game.player, 'position', { get() { throw new Error('read failed'); } });
    callbacks.shift()(16);
    await expect(probe).rejects.toThrow('read failed');
    expect(Object.hasOwn(window.game, 'update')).toBe(false);
    expect(Object.hasOwn(window.game, 'render')).toBe(false);
});
