import { jest } from '@jest/globals';
import { GroundInputUnavailableError } from './groundInputFailure.js';

const move = jest.fn(), read = jest.fn();
jest.unstable_mockModule('./e2e/helpers.js', () => ({ moveByGroundClick: move, readPlayerState: read }));
jest.unstable_mockModule('./e2e/earned-retreat-plan.js', () => ({
    planReachableWizardStep: async () => ({ action: 'retreat', x: -9, z: 0 })
}));
const { createEarnedWizardDefense } = await import('./e2e/earned-wizard-defense.js');
beforeEach(() => { jest.clearAllMocks(); read.mockResolvedValue({ state: 'IDLE' }); });

test('no clear ground falls back to combat without counting a successful retreat', async () => {
    const page = { evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({})
        .mockResolvedValue(undefined) };
    move.mockRejectedValue(new GroundInputUnavailableError('no input available'));
    const defend = await createEarnedWizardDefense(page);
    expect(await defend()).toBe(false);
    expect(move).toHaveBeenCalledWith(page, -9, 0, expect.objectContaining({ minimumDistance: 6 }));
    window.__freshWizardDefense = { counts: { retreats: 0 } };
    try {
        page.evaluate.mock.calls.at(-1)[0]();
        expect(window.__freshWizardDefense.counts).toEqual({ retreats: 0, blockedRetreats: 1 });
    } finally { delete window.__freshWizardDefense; }
});

test('an issued movement failure still fails the playtest', async () => {
    const page = { evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({}) };
    const error = new Error('click sent but no movement');
    move.mockRejectedValue(error);
    const defend = await createEarnedWizardDefense(page);
    await expect(defend()).rejects.toBe(error);
});
