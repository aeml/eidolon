import { jest } from '@jest/globals';

const plan = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect }));
jest.unstable_mockModule('./e2e/earned-retreat-plan.js', () => ({ planReachableWizardStep: plan }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ jumpByGroundClick: jest.fn(), moveByGroundClick: jest.fn(),
    projectGroundOffset: jest.fn(), readPlayerState: jest.fn() }));
const { createEarnedRangedDefense } = await import('./e2e/earned-wizard-defense.js');
beforeEach(() => { jest.resetAllMocks(); plan.mockResolvedValue(null); });

test.each(['Wizard', 'Rogue'])('%s receives dungeon encounter context from (page, target)', async className => {
    const state = { className, healthRatio: 1, x: 0, z: 0 };
    const page = { evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValue(state) };
    const encounter = { x: 0, z: 0, width: 120, height: 120 };
    const driver = await createEarnedRangedDefense(page);
    expect(await driver(page, { id: 'boss', encounter })).toBe(false);
    expect(plan).toHaveBeenCalledWith(page, expect.objectContaining({ ...state, encounter }));
});
test('direct circular encounter callers remain supported', async () => {
    const page = { evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValue({ healthRatio: 1 }) };
    const encounter = { x: 0, z: 0, radius: 40 };
    const driver = await createEarnedRangedDefense(page);
    await driver({ encounter });
    expect(plan).toHaveBeenCalledWith(page, expect.objectContaining({ encounter }));
});
