import { jest, expect as jestExpect } from '@jest/globals';

const move = jest.fn(), jump = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: jestExpect }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ moveByGroundClick: move,
    jumpByGroundClick: jump, projectGroundOffset: jest.fn(), readPlayerState: jest.fn() }));
const { createEarnedRangedDefense } = await import('./e2e/earned-wizard-defense.js');
beforeEach(() => jest.clearAllMocks());

test('reinstalling ranged evidence resets the segment without counting each result twice', async () => {
    const original = jest.fn(function () { expect(this).toBe(window.game); return 'forwarded'; });
    window.game = { handleServerMessage: original };
    const page = { evaluate: jest.fn(callback => callback()) };
    try {
        await createEarnedRangedDefense(page);
        const accepted = { type: 'ability_result', payload: { skillName: 'Fireball', accepted: true } };
        window.game.handleServerMessage(accepted);
        await createEarnedRangedDefense(page);
        expect(window.__freshWizardDefense.counts.fireballs).toBe(0);
        expect(window.game.handleServerMessage(accepted)).toBe('forwarded');
        const rejected = { type: 'ability_result', payload: { skillName: 'Arcane Shield', accepted: false } };
        window.game.handleServerMessage(rejected);
        expect(window.__freshWizardDefense.counts.fireballs).toBe(1);
        expect(window.__freshWizardDefense.counts.rejectedShields).toBe(1);
        expect(window.__freshWizardDefense.lastAcceptedAt).toBeGreaterThan(0);
        expect(original).toHaveBeenCalledTimes(3);
        expect(original).toHaveBeenLastCalledWith(rejected);
    } finally {
        delete window.game;
        delete window.__freshWizardDefense;
    }
});

test.each([
    [1, { retreatBelowHealthRatio: .8 }, false],
    [.8, { retreatBelowHealthRatio: .8 }, false],
    [.79, { retreatBelowHealthRatio: .8 }, true],
    [1, undefined, true]
])('health %s with options %j preserves the intended ordinary retreat decision', async (healthRatio, options, retreat) => {
    const state = Object.freeze({ healthRatio, className: 'Wizard', x: 0, z: 0,
        threats: [{ x: 2, z: 0 }] });
    const page = { evaluate: jest.fn().mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(state)
        .mockImplementation(async (_, data) => data?.options?.map(() => true)) };
    const defend = await createEarnedRangedDefense(page, options);
    expect(await defend()).toBe(false);
    expect(move).toHaveBeenCalledTimes(retreat ? 1 : 0);
    expect(jump).not.toHaveBeenCalled();
    expect(state.healthRatio).toBe(healthRatio);
});
