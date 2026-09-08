import { jest } from '@jest/globals';

const createDefense = jest.fn();
jest.unstable_mockModule('./e2e/earned-wizard-defense.js', () => ({ createEarnedWizardDefense: createDefense }));
const { createFreshCollectionCombat, readFreshCollectionCombat, readSelectedCollectionTarget,
    readCollectionTarget, selectCollectionTargetThroughInput } = await import('./e2e/fresh-collection-combat.js');

beforeEach(() => jest.resetAllMocks());

test('Wizard collection retains defense but allows healthy ordinary combat', async () => {
    const page = { evaluate: jest.fn().mockResolvedValue('Wizard') }, defend = jest.fn();
    createDefense.mockResolvedValue(defend);
    expect(await createFreshCollectionCombat(page)).toBe(defend);
    expect(createDefense).toHaveBeenCalledWith(page, { retreatBelowHealthRatio: .8 });
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

test.each(['Fighter', 'Rogue', 'Cleric'])('%s keeps its existing collection input', async className => {
    const page = { evaluate: jest.fn().mockResolvedValue(className) };
    expect(await (await createFreshCollectionCombat(page))()).toBe(false);
    expect(createDefense).not.toHaveBeenCalled();
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
