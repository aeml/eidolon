import { jest } from '@jest/globals';

const browserExpect = jest.fn(value => expect(value));
browserExpect.poll = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: browserExpect }));
const { holdGroundOffsetAndSample, sampleMovementFrames, waitForArrival } =
    await import('./e2e/movement-input-observation.js');

beforeEach(() => {
    browserExpect.mockClear();
    browserExpect.poll.mockReset().mockReturnValue({ toBe: jest.fn().mockResolvedValue(undefined) });
});
afterEach(() => { jest.restoreAllMocks(); delete window.game; });

function pointerPage(hovered = null) {
    return { evaluate: jest.fn().mockResolvedValueOnce({ canvas: true, x: 400, y: 300 })
        .mockResolvedValueOnce(hovered),
    mouse: { move: jest.fn(), down: jest.fn(), up: jest.fn() }, waitForTimeout: jest.fn() };
}

test('a crossing hostile can be reselected only before clicking or starting a sampler', async () => {
    const page = pointerPage('Skeleton-lanternhold-1');
    expect(await holdGroundOffsetAndSample(page, 8, 0, { reselectBlocked: true })).toBeNull();
    expect(page.evaluate).toHaveBeenCalledTimes(2);
    expect(page.mouse.down).not.toHaveBeenCalled();
    expect(page.waitForTimeout).not.toHaveBeenCalled();
});

test('without explicit pre-input reselection an obstructed ground ray still fails', async () => {
    const page = pointerPage('Skeleton-lanternhold-1');
    await expect(holdGroundOffsetAndSample(page, 8, 0)).rejects.toThrow();
    expect(page.evaluate).toHaveBeenCalledTimes(2);
    expect(page.mouse.down).not.toHaveBeenCalled();
});

test('a non-canvas target cannot be clicked or reselected as a successful sample', async () => {
    const page = pointerPage();
    page.evaluate.mockReset().mockResolvedValue({ canvas: false });
    await expect(holdGroundOffsetAndSample(page, 8, 0, { reselectBlocked: true })).rejects.toThrow();
    expect(page.mouse.move).not.toHaveBeenCalled();
    expect(page.mouse.down).not.toHaveBeenCalled();
});

test('valid input retains the real held-button receipt and complete frames', async () => {
    const page = pointerPage();
    const aimed = { groundDistance: 8 }, frames = [{ x: 0 }, { x: 8 }];
    page.evaluate.mockResolvedValueOnce(aimed).mockResolvedValueOnce(frames).mockResolvedValueOnce(true);
    const result = await holdGroundOffsetAndSample(page, 8, 0, { holdMs: 90, sampleMs: 2500 });
    expect(result).toMatchObject({ aimed, frames, pointerObservedDown: true });
    expect(page.mouse.down).toHaveBeenCalledTimes(1);
    expect(page.mouse.up).toHaveBeenCalledTimes(1);
    expect(page.waitForTimeout).toHaveBeenCalledWith(90);
    expect(page.evaluate.mock.invocationCallOrder[3]).toBeLessThan(page.mouse.down.mock.invocationCallOrder[0]);
});

test('an actual input failure releases the mouse and is not converted into a reselection', async () => {
    const page = pointerPage();
    page.evaluate.mockResolvedValueOnce({}).mockResolvedValueOnce([]);
    const failure = new Error('physical input failed');
    page.mouse.down.mockRejectedValue(failure);
    await expect(holdGroundOffsetAndSample(page, 8, 0, { reselectBlocked: true })).rejects.toBe(failure);
    expect(page.mouse.up).toHaveBeenCalledTimes(1);
});

test('sampling captures the pre-input position synchronously before the first animation frame', async () => {
    window.game = { player: { position: { x: 0, y: 0, z: 0 },
        mesh: { position: { x: 0, z: 0 } }, state: 'IDLE', currentAnimationName: 'Idle' } };
    let nextFrame;
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { nextFrame = callback; return 1; });
    const page = { evaluate: jest.fn((fn, arg) => fn(arg)) };
    const sampling = sampleMovementFrames(page, 100);
    expect(nextFrame).toEqual(expect.any(Function));
    window.game.player.position.x = 8;
    window.game.player.mesh.position.x = 8;
    nextFrame(performance.now() + 1000);
    const frames = await sampling;
    expect(frames.map(frame => frame.x)).toEqual([0, 8]);
    expect(frames[0].t).toBe(0);
});

test('arrival requires logical idle, no target and the actual Idle animation within a bounded wait', async () => {
    window.game = { player: { state: 'IDLE', targetPosition: null, currentAnimationName: 'Run' } };
    const page = { evaluate: jest.fn(fn => fn()) };
    const equal = jest.fn(async expected => {
        const observe = browserExpect.poll.mock.calls[0][0];
        expect(await observe()).not.toEqual(expected);
        window.game.player.currentAnimationName = 'Idle';
        expect(await observe()).toEqual(expected);
    });
    browserExpect.poll.mockReturnValue({ toEqual: equal });
    await waitForArrival(page);
    expect(browserExpect.poll).toHaveBeenCalledWith(expect.any(Function), { timeout: 8000 });
    expect(equal).toHaveBeenCalledWith({ state: 'IDLE', hasTarget: false, animation: 'Idle' });
});
