import { jest } from '@jest/globals';
import { findHuntTargetWithRecovery } from './huntTargetRecovery.js';

test('returns an ordinary live target without recovery', async () => {
    const recover = jest.fn();
    expect(await findHuntTargetWithRecovery({ findTarget: async () => ({ id: 'target' }), isDead: async () => false, recover }))
        .toEqual({ id: 'target' });
    expect(recover).not.toHaveBeenCalled();
});
test('a death before searching uses recovery exactly once without movement', async () => {
    const findTarget = jest.fn(), recover = jest.fn();
    expect(await findHuntTargetWithRecovery({ findTarget, isDead: async () => true, recover })).toBeNull();
    expect(findTarget).not.toHaveBeenCalled(); expect(recover).toHaveBeenCalledTimes(1);
});
test('a death during search uses the same counted recovery', async () => {
    const recover = jest.fn();
    const isDead = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await findHuntTargetWithRecovery({ findTarget: async () => { throw Error('movement interrupted'); }, isDead, recover })).toBeNull();
    expect(recover).toHaveBeenCalledTimes(1);
});
test('a living-character navigation failure is not swallowed', async () => {
    const error = Error('blocked route'), recover = jest.fn();
    await expect(findHuntTargetWithRecovery({ findTarget: async () => { throw error; }, isDead: async () => false, recover })).rejects.toBe(error);
    expect(recover).not.toHaveBeenCalled();
});
test('the existing death-limit failure still stops the route', async () => {
    const error = Error('death bound exceeded');
    await expect(findHuntTargetWithRecovery({ findTarget: jest.fn(), isDead: async () => true,
        recover: async () => { throw error; } })).rejects.toBe(error);
});
