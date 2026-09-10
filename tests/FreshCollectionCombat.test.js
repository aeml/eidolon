import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';

const createDefense = jest.fn();
jest.unstable_mockModule('./e2e/earned-class-combat.js', () => ({ createEarnedClassCombat: createDefense }));
const { createFreshCollectionCombat, readFreshCollectionCombat, readSelectedCollectionTarget,
    readCollectionTarget, selectCollectionTargetThroughInput,
    reacquireDisengagedCollectionTarget } = await import('./e2e/fresh-collection-combat.js');

beforeEach(() => jest.resetAllMocks());

test('reacquisition preserves missing-target evidence and does not invent a nearby enemy', async () => {
    const target = { id: 'old' }, findNearby = jest.fn().mockResolvedValue(null);
    window.game = { remotePlayers: new Map(), player: { position: { distanceTo: () => 47 } },
        isHostileActorTarget: () => false, getBasicAttackRangeForEntity: () => 16 };
    const page = { evaluate: (fn, arg) => fn(arg) };
    try {
        expect(await reacquireDisengagedCollectionTarget(page, target, findNearby)).toBe(target);
        expect(findNearby).not.toHaveBeenCalled();
        window.game.remotePlayers.set(target.id, { health: 28, state: 'IDLE', position: {} });
        expect(await reacquireDisengagedCollectionTarget(page, target, findNearby)).toBe(target);
        expect(findNearby).toHaveBeenCalledTimes(1);
    } finally { delete window.game; }
});

test.each([
    { distance: 47, selected: false, state: 'IDLE', expected: true },
    { distance: 47, selected: true, state: 'MOVING', expected: false },
    { distance: 12, selected: false, state: 'IDLE', expected: false },
    { distance: 47, selected: false, state: 'DEAD', expected: false }
])('only a living distant disengaged target can be replaced: %j', async scenario => {
    const target = { id: 'old' }, nearby = { id: 'nearby' };
    const enemy = Object.freeze({ state: scenario.state, health: 28, position: {} });
    window.game = { remotePlayers: new Map([[target.id, enemy]]),
        player: { position: { distanceTo: () => scenario.distance } },
        isHostileActorTarget: () => scenario.selected, getBasicAttackRangeForEntity: () => 16 };
    const findNearby = jest.fn().mockResolvedValue(nearby);
    try {
        const result = await reacquireDisengagedCollectionTarget({ evaluate: (fn, arg) => fn(arg) }, target, findNearby);
        expect(result).toBe(scenario.expected ? nearby : target);
        expect(findNearby).toHaveBeenCalledTimes(scenario.expected ? 1 : 0);
        expect(enemy.health).toBe(28);
    } finally { delete window.game; }
});

test.each(['Wizard', 'Fighter', 'Rogue', 'Cleric'])('%s collection uses its earned class driver with healthy combat preserved', async className => {
    const page = { evaluate: jest.fn().mockResolvedValue(className) }, defend = jest.fn();
    createDefense.mockResolvedValue(defend);
    expect(await createFreshCollectionCombat(page)).toBe(defend);
    expect(createDefense).toHaveBeenCalledWith(page, className, { retreatBelowHealthRatio: .8 });
});

test('follows only the actual hostile selected by normal input, without mutating it', async () => {
    const enemy = Object.freeze({ id: 'front-skeleton', password: 'not-copied' });
    const game = { pendingInteraction: enemy, isHostileActorTarget: target => target === enemy };
    window.game = game;
    const page = { evaluate: fn => fn() };
    try {
        expect(await readSelectedCollectionTarget(page)).toEqual({ id: 'front-skeleton' });
        expect(game.pendingInteraction).toBe(enemy);
        game.pendingInteraction = { id: 'loot' };
        expect(await readSelectedCollectionTarget(page)).toBeNull();
        game.pendingInteraction = null;
        expect(await readSelectedCollectionTarget(page)).toBeNull();
    } finally { delete window.game; }
});

test('driver setup failure is propagated instead of silently disabling class actions', async () => {
    const failure = new Error('class driver unavailable');
    createDefense.mockRejectedValue(failure);
    await expect(createFreshCollectionCombat({ evaluate: async () => 'Unknown' })).rejects.toBe(failure);
});

test('opening and seed encounters pass the live page and current target to class input', () => {
    const opening = readFileSync('tests/e2e/fresh-opening-gameplay.spec.js', 'utf8');
    const collection = readFileSync('tests/e2e/fresh-collection-route.js', 'utf8');
    expect(opening).toContain('if (await beforeOpeningCombat(page, target)) continue;');
    expect(collection).toContain('if (await beforeCombat(page, target)) continue;');
    expect(opening).not.toContain('await beforeOpeningCombat()');
    expect(collection).not.toContain('await beforeCombat()');
});

test('a valid auto-attack target is retained without another click', async () => {
    const target = Object.freeze({ id: 'skeleton' });
    window.game = { pendingInteraction: target, isHostileActorTarget: () => true };
    const page = { evaluate: fn => fn(), mouse: { click: jest.fn() } };
    try {
        expect(await selectCollectionTargetThroughInput(page, target, { x: 12, y: 34 })).toBe(target);
        expect(page.mouse.click).not.toHaveBeenCalled();
        expect(window.game.pendingInteraction).toBe(target);
    } finally { delete window.game; }
});

test('a canceled attack is reacquired through input and follows its actual selection', async () => {
    const target = { id: 'skeleton' }, front = { id: 'front-skeleton' };
    window.game = { pendingInteraction: null, isHostileActorTarget: () => true };
    const page = { evaluate: fn => fn(), mouse: { click: jest.fn(async () => { window.game.pendingInteraction = front; }) } };
    try {
        expect(await selectCollectionTargetThroughInput(page, target, { x: 12, y: 34 })).toEqual(front);
        expect(page.mouse.click).toHaveBeenCalledTimes(1);
        expect(page.mouse.click).toHaveBeenCalledWith(12, 34);
    } finally { delete window.game; }
});

test('death observations preserve the actual drop position without inventing missing targets', async () => {
    const enemy = Object.freeze({ state: 'DEAD', health: 0, position: Object.freeze({ x: 7, z: 9 }) });
    window.game = { remotePlayers: new Map([['skeleton', enemy]]) };
    const page = { evaluate: (fn, arg) => fn(arg) };
    try {
        expect(await readCollectionTarget(page, 'skeleton')).toEqual({ hp: 0, state: 'DEAD', x: 7, z: 9 });
        expect(await readCollectionTarget(page, 'missing')).toBeNull();
        expect(window.game.remotePlayers.get('skeleton')).toBe(enemy);
    } finally { delete window.game; }
});

test('diagnostics record dead/empty resources without granting recovery or serializing account data', async () => {
    const enemy = { subType: 'Skeleton', level: 6, state: 'ATTACK', health: 200, position: {} };
    const stats = Object.freeze({ hp: 0, maxHp: 175, mana: 0, maxMana: 160 });
    const player = Object.freeze({ level: 6, state: 'DEAD', stats,
        position: { x: 140, z: 200, distanceTo: () => 3 }, password: 'must-not-be-included' });
    window.game = { player, remotePlayers: new Map([['enemy', enemy]]), isHostileActorTarget: () => true };
    const page = { evaluate: (fn, value) => fn(value) };
    try {
        const state = await readFreshCollectionCombat(page, 'enemy');
        expect(state).toMatchObject({ state: 'DEAD', hp: 0, mana: 0,
            target: { hp: 200, distance: 3 }, nearby: [{ type: 'Skeleton', level: 6, distance: 3 }] });
        expect(state).not.toHaveProperty('password');
        expect(player.stats).toBe(stats);
        expect((await readFreshCollectionCombat(page, 'missing')).target).toBeNull();
    } finally { delete window.game; }
});
