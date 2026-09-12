import { jest } from '@jest/globals';
import { tryUtilityApproachStep } from './e2e/rogue-utility-approach.js';
import { GroundInputUnavailableError, GroundPointerInterceptedError } from './groundInputFailure.js';

test('a successful issued movement is reported once', async () => {
    const action = jest.fn().mockResolvedValue(undefined);
    expect(await tryUtilityApproachStep(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
});

test('no-input planning failure requests a fresh observation, not a successful step or internal retry', async () => {
    const action = jest.fn().mockRejectedValue(new GroundInputUnavailableError('target moved'));
    expect(await tryUtilityApproachStep(action)).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
});

test.each([new Error('issued movement failed'), new Error('network disconnected'),
    new GroundPointerInterceptedError('actual click was intercepted'),
    Object.assign(new Error('not the recognized class'), { name: 'GroundInputUnavailableError' })])(
    'actual input and unrelated failures remain fatal (%#)', async error => {
        const action = jest.fn().mockRejectedValue(error);
        await expect(tryUtilityApproachStep(action)).rejects.toBe(error);
        expect(action).toHaveBeenCalledTimes(1);
    });
