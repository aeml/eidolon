import { hasFreshEntranceHover } from './e2e/entrance-pointer.js';

const dungeonType = 'verdant_bastion_catacombs';
const readyGame = () => ({ needsRaycast: false, inputManager: { pointerOverCanvas: true },
    hoveredEntity: { name: 'DungeonEntrance', userData: { dungeonType } } });
const page = { evaluate: (callback, argument) => callback(argument) };
let previousGame;

beforeEach(() => { previousGame = window.game; window.game = readyGame(); });
afterEach(() => { window.game = previousGame; });

test('accepts the completed ordinary entrance hover without mutating the game', async () => {
    const before = JSON.stringify(window.game);
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(true);
    expect(JSON.stringify(window.game)).toBe(before);
});

test('rejects the previous entrance hover while the new pointer raycast is deferred', async () => {
    window.game.needsRaycast = true;
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(false);
    // The ordinary game loop completes the new ray, which now hits a titan.
    window.game.needsRaycast = false;
    window.game.hoveredEntity = { name: 'InfernoTitan' };
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(false);
});

test('accepts only after the deferred sample genuinely selects the entrance', async () => {
    window.game.needsRaycast = true;
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(false);
    window.game.needsRaycast = false;
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(true);
});

test('rejects a retained hover after the pointer leaves the canvas', async () => {
    window.game.inputManager.pointerOverCanvas = false;
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(false);
});

test('does not assume an uninitialized pointer is fresh', async () => {
    delete window.game.needsRaycast;
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(false);
});

test('rejects another region or missing target', async () => {
    window.game.hoveredEntity.userData.dungeonType = 'molten_core';
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(false);
    window.game.hoveredEntity = null;
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(false);
    window.game = null;
    expect(await hasFreshEntranceHover(page, dungeonType)).toBe(false);
});
