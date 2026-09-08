import { jest } from '@jest/globals';
import { GroundInputUnavailableError } from './groundInputFailure.js';

const move = jest.fn(), read = jest.fn();
jest.unstable_mockModule('./e2e/helpers.js', () => ({ moveByGroundClick: move, readPlayerState: read }));
const { createEarnedWizardDefense } = await import('./e2e/earned-wizard-defense.js');
beforeEach(() => { jest.clearAllMocks(); read.mockResolvedValue({ state: 'IDLE' }); });

const pageForRetreat = () => ({ evaluate: jest.fn().mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce({ className: 'Wizard', x: 0, z: 0, healthRatio: 1,
        threats: [{ x: 2, z: 0 }] })
    .mockImplementation(async (_, data) => data?.options?.map(() => true)) });

test('unavailable ground selects combat without claiming successful movement', async () => {
    const page = pageForRetreat();
    move.mockRejectedValue(new GroundInputUnavailableError('no input available'));
    const defend = await createEarnedWizardDefense(page);
    expect(await defend()).toBe(false);
    expect(move).toHaveBeenCalledWith(page, -9, expect.any(Number), expect.objectContaining({ minimumDistance: 6 }));
    window.__freshWizardDefense = { counts: { retreats: 0 } };
    try {
        page.evaluate.mock.calls.at(-1)[0]();
        expect(window.__freshWizardDefense.counts).toEqual({ retreats: 0, blockedRetreats: 1 });
    } finally { delete window.__freshWizardDefense; }
});

test('an issued movement failure still fails the playtest', async () => {
    const page = pageForRetreat();
    const error = new Error('click sent but no movement');
    move.mockRejectedValue(error);
    const defend = await createEarnedWizardDefense(page);
    await expect(defend()).rejects.toBe(error);
});
