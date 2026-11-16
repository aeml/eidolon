import { jest } from '@jest/globals';

const readPlayerState = jest.fn();
const returnToTown = jest.fn();
const freePersistentQALootSlot = jest.fn();
jest.unstable_mockModule('../../../e2e/support/browser/helpers.js', () => ({
    readPlayerState, returnToTown, freePersistentQALootSlot
}));
const { preparePersistentQALootSlot } = await import('../../../e2e/support/economy/prepare-persistent-qa-bag.js');

beforeEach(() => jest.resetAllMocks());

test('a free bag needs no recall or economy action', async () => {
    readPlayerState.mockResolvedValue({ inventoryCount: 24 });
    expect(await preparePersistentQALootSlot({})).toEqual([]);
    expect(returnToTown).not.toHaveBeenCalled();
    expect(freePersistentQALootSlot).not.toHaveBeenCalled();
});

test('a full bag cannot start a transaction until normal town recovery completes', async () => {
    const page = {}, options = { storeSpare: jest.fn() }, retained = [{ id: 'retained' }];
    readPlayerState.mockResolvedValue({ inventoryCount: 25 });
    let arrived;
    returnToTown.mockImplementation(() => new Promise(resolve => { arrived = resolve; }));
    freePersistentQALootSlot.mockResolvedValue(retained);
    const preparation = preparePersistentQALootSlot(page, options);
    await Promise.resolve();
    expect(returnToTown).toHaveBeenCalledWith(page, { allowRespawn: false });
    expect(freePersistentQALootSlot).not.toHaveBeenCalled();
    arrived();
    expect(await preparation).toBe(retained);
    expect(freePersistentQALootSlot).toHaveBeenCalledWith(page, options);
});

test('death or failed recall cannot be hidden by a sale or stash deposit', async () => {
    readPlayerState.mockResolvedValue({ inventoryCount: 25 });
    returnToTown.mockRejectedValue(Error('unfinished encounter'));
    await expect(preparePersistentQALootSlot({})).rejects.toThrow('unfinished encounter');
    expect(freePersistentQALootSlot).not.toHaveBeenCalled();
});

test('strict transaction failures remain failures after town recovery', async () => {
    readPlayerState.mockResolvedValue({ inventoryCount: 25 });
    freePersistentQALootSlot.mockRejectedValue(Error('unexpected Gold'));
    await expect(preparePersistentQALootSlot({})).rejects.toThrow('unexpected Gold');
    expect(freePersistentQALootSlot).toHaveBeenCalledTimes(1);
});
