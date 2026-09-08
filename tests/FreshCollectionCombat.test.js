import { jest } from '@jest/globals';

const createDefense = jest.fn();
jest.unstable_mockModule('./e2e/earned-wizard-defense.js', () => ({ createEarnedWizardDefense: createDefense }));
const { createFreshCollectionCombat, readFreshCollectionCombat, readSelectedCollectionTarget } = await import('./e2e/fresh-collection-combat.js');

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
