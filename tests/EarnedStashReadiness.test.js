import { jest } from '@jest/globals';

let deliverStash;
const polls = [];
const pwExpect = value => ({ ...expect(value),
    toBeVisible: async () => expect(await value.isVisible()).toBe(true),
    toBeHidden: async () => expect(await value.isVisible()).toBe(false) });
pwExpect.poll = (callback, options) => ({ toBe: async expected => {
    polls.push(options);
    let value = await callback();
    if (value !== expected) { deliverStash?.(); value = await callback(); }
    expect(value).toBe(expected);
} });
const move = jest.fn(), project = jest.fn(), read = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: pwExpect }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ moveByGroundClick: move, projectEntity: project, readPlayerState: read }));
const { openEarnedStash } = await import('./e2e/earned-stash-storage.js');

beforeEach(() => {
    jest.resetAllMocks(); polls.length = 0;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    window.game = { remotePlayers: new Map(), player: { position: { x: 0, z: 200 }, state: 'IDLE' },
        renderSystem: { cameraTarget: { x: 0, z: 200 } } };
    deliverStash = () => window.game.remotePlayers.set('stash-1', { position: { x: 0, z: 200 } });
    project.mockResolvedValue({ x: 100, y: 100, visible: true });
    read.mockResolvedValue({ x: 0, z: 200 });
});
afterEach(() => { delete window.game; jest.restoreAllMocks(); });

function browser() {
    let visible = false;
    return { evaluate: async callback => callback(),
        locator: selector => ({ isVisible: async () => selector !== '#shop-screen' && visible }),
        mouse: { move: jest.fn(async () => { window.game.hoveredEntity = { id: 'stash-1' }; }),
            click: jest.fn(async () => { visible = true; }) } };
}

test('stash arriving after player login is awaited before ordinary interaction', async () => {
    const page = browser();
    await openEarnedStash(page);
    expect(page.mouse.click).toHaveBeenCalledWith(100, 100);
    expect(polls[0]).toMatchObject({ timeout: 10_000 });
    expect(move).not.toHaveBeenCalled();
});

test('missing stash remains a bounded failure without invented NPCs or clicks', async () => {
    deliverStash = undefined;
    const page = browser();
    await expect(openEarnedStash(page)).rejects.toThrow();
    expect(polls[0]).toMatchObject({ timeout: 10_000 });
    expect(page.mouse.click).not.toHaveBeenCalled();
    expect(window.game.remotePlayers.size).toBe(0);
});
