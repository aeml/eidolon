import { jest, expect as jestExpect } from '@jest/globals';

const move = jest.fn(), jump = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: jestExpect }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ moveByGroundClick: move,
    jumpByGroundClick: jump, projectGroundOffset: jest.fn(), readPlayerState: jest.fn() }));
const { createEarnedRangedDefense } = await import('./e2e/earned-wizard-defense.js');
beforeEach(() => jest.clearAllMocks());

test.each([
    [1, { retreatBelowHealthRatio: .8 }, false],
    [.8, { retreatBelowHealthRatio: .8 }, false],
    [.79, { retreatBelowHealthRatio: .8 }, true],
    [1, undefined, true]
])('health %s with options %j preserves the intended ordinary retreat decision', async (healthRatio, options, retreat) => {
    const state = Object.freeze({ healthRatio, className: 'Wizard' });
    const page = { evaluate: jest.fn().mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(state).mockResolvedValueOnce({ action: 'retreat', x: 9, z: 0 })
        .mockResolvedValue(undefined) };
    const defend = await createEarnedRangedDefense(page, options);
    expect(await defend()).toBe(false);
    expect(move).toHaveBeenCalledTimes(retreat ? 1 : 0);
    expect(jump).not.toHaveBeenCalled();
    expect(state.healthRatio).toBe(healthRatio);
});
