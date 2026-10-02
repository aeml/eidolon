import { armManualLootClickObservation, readLootPointerTarget, readLootBlockingHostile } from './e2e/loot-pointer-observation.js';

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
afterEach(() => { window.game = previousGame; delete window.__qaManualLootClick; });

function prepareClickObservation() {
    const game = window.game;
    game.player = { state: 'IDLE' };
    game.renderSystem = { camera: { position: { toArray: () => [0, 20, 0] } } };
    game.inputManager.callbacks = { onClick: [] };
    return game;
}

test('click evidence binds to the actual front drop after hover order changes and retires itself', async () => {
    const game = prepareClickObservation(), aimed = game.hoveredEntity;
    await armManualLootClickObservation(page, aimed.id);
    const front = game.remotePlayers.get('covering');
    game.hoveredEntity = front; game.raycastHitEntities = [front, aimed];
    game.pendingInteraction = front;
    game.inputManager.callbacks.onClick[0]();
    expect(window.__qaManualLootClick).toMatchObject({ aimedId: aimed.id, selectedId: front.id,
        selectedItem: { id: 'item-covering' }, sameLootPile: true, selectedPending: true });
    expect(game.inputManager.callbacks.onClick).toHaveLength(0);
    expect(aimed.isActive).toBe(true); expect(front.isActive).toBe(true);
    expect(game.hoveredEntity).toBe(front);
});

test.each(['unrelated', 'hostile', 'inactive', 'stale-ray', 'off-canvas', 'wrong-pending'])(
    'actual-click evidence cannot accept %s as a successful selected pickup', async reason => {
        const game = prepareClickObservation(), aimed = game.hoveredEntity;
        const front = game.remotePlayers.get('covering');
        game.hoveredEntity = front; game.raycastHitEntities = [front, aimed]; game.pendingInteraction = front;
        if (reason === 'unrelated') game.raycastHitEntities = [front];
        if (reason === 'hostile') front.constructor = { name: 'Enemy' };
        if (reason === 'inactive') front.isActive = false;
        if (reason === 'stale-ray') game.needsRaycast = true;
        if (reason === 'off-canvas') game.inputManager.pointerOverCanvas = false;
        if (reason === 'wrong-pending') game.pendingInteraction = aimed;
        await armManualLootClickObservation(page, aimed.id);
        game.inputManager.callbacks.onClick[0]();
        const click = window.__qaManualLootClick;
        expect(click.sameLootPile && click.selectedPending).toBe(false);
        expect(game.inputManager.callbacks.onClick).toHaveLength(0);
    }
);

test('combat clearance identifies only a live hostile sharing the intended loot ray', async () => {
    const game = window.game, loot = game.hoveredEntity;
    const hostile = {id: 'blocker', isActive: true, state: 'IDLE', health: 30};
    game.isHostileActorTarget = entity => entity === hostile;
    game.hoveredEntity = hostile; game.raycastHitEntities = [hostile, loot];
    expect(await readLootBlockingHostile(page, loot.id)).toBe('blocker');
    expect(hostile.health).toBe(30); expect(game.hoveredEntity).toBe(hostile);
    game.raycastHitEntities = [hostile];
    expect(await readLootBlockingHostile(page, loot.id)).toBeNull();
    game.raycastHitEntities = [hostile, loot];
    hostile.state = 'DEAD';
    expect(await readLootBlockingHostile(page, loot.id)).toBeNull();
    hostile.state = 'IDLE'; game.isHostileActorTarget = () => false;
    expect(await readLootBlockingHostile(page, loot.id)).toBeNull();
    game.isHostileActorTarget = () => true; game.needsRaycast = true;
    expect(await readLootBlockingHostile(page, loot.id)).toBeNull();
    game.needsRaycast = false; game.inputManager.pointerOverCanvas = false;
    expect(await readLootBlockingHostile(page, loot.id)).toBeNull();
});

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
