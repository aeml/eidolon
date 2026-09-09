import { readLootPointerTarget } from './e2e/loot-pointer-observation.js';

const drop = id => ({ id, constructor: { name: 'LootDrop' }, isActive: true,
    item: { id: `item-${id}`, name: id } });
const page = { evaluate: (callback, argument) => callback(argument) };
let previousGame;

beforeEach(() => {
    previousGame = window.game;
    const intended = drop('intended'), covering = drop('covering');
    window.game = { needsRaycast: false, inputManager: { pointerOverCanvas: true },
        hoveredEntity: intended, raycastHitEntities: [intended],
        remotePlayers: new Map([['intended', intended], ['covering', covering]]) };
});
afterEach(() => { window.game = previousGame; });

test('strict selection returns the intended item and leaves observations unchanged', async () => {
    const before = JSON.stringify(window.game);
    expect(await readLootPointerTarget(page, 'intended')).toBe('intended');
    expect(JSON.stringify(window.game)).toBe(before);
});

test('a shared ray may select its actual front item only through explicit opt-in', async () => {
    const game = window.game;
    const covering = game.remotePlayers.get('covering');
    game.raycastHitEntities.unshift(covering);
    game.hoveredEntity = covering;
    expect(await readLootPointerTarget(page, 'intended')).toBeNull();
    expect(await readLootPointerTarget(page, 'intended', { allowOverlappingLoot: true })).toBe('covering');
});

test('overlap permission never accepts an unrelated hovered drop', async () => {
    const game = window.game;
    game.hoveredEntity = game.remotePlayers.get('covering');
    game.raycastHitEntities = [game.hoveredEntity];
    expect(await readLootPointerTarget(page, 'intended', { allowOverlappingLoot: true })).toBeNull();
});

test('does not accept a stale hover while the next pointer sample is pending', async () => {
    window.game.needsRaycast = true;
    expect(await readLootPointerTarget(page, 'intended', { allowOverlappingLoot: true })).toBeNull();
});

test('retained off-canvas hover cannot become a pickup target', async () => {
    window.game.inputManager.pointerOverCanvas = false;
    expect(await readLootPointerTarget(page, 'intended')).toBeNull();
});

test.each(['inactive', 'no-item', 'hostile'])('rejects %s pointer results', async reason => {
    const target = window.game.hoveredEntity;
    if (reason === 'inactive') target.isActive = false;
    if (reason === 'no-item') target.item = null;
    if (reason === 'hostile') target.constructor = { name: 'InfernoTitan' };
    expect(await readLootPointerTarget(page, 'intended', { allowOverlappingLoot: true })).toBeNull();
});

test('missing game is not a selectable drop', async () => {
    window.game = null;
    expect(await readLootPointerTarget(page, 'intended')).toBeNull();
});
