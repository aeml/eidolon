import { jest } from '@jest/globals';
import { tryDungeonGroundStep } from './dungeonNavigationInput.js';
import { GroundInputUnavailableError, GroundPointerInterceptedError } from './groundInputFailure.js';

test('a successful ordinary movement step is reported exactly once', async () => {
    const action = jest.fn().mockResolvedValue({ x: 10 });
    expect(await tryDungeonGroundStep(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
});

test.each([GroundInputUnavailableError, GroundPointerInterceptedError])('covered/intercepted input does not count as a successful step (%#)', async ErrorType => {
    const action = jest.fn().mockRejectedValue(new ErrorType('target unavailable'));
    expect(await tryDungeonGroundStep(action)).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
});

test.each(['movement command ignored', 'network disconnected', 'character died'])('real failure stays fatal: %s', async message => {
    const error = new Error(message);
    const action = jest.fn().mockRejectedValue(error);
    await expect(tryDungeonGroundStep(action)).rejects.toBe(error);
    expect(action).toHaveBeenCalledTimes(1);
});
