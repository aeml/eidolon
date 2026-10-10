import { jest } from '@jest/globals';
const poll = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: { poll } }));
const { beginPersistentQABagRewards, waitForPersistentQABagGold, endPersistentQABagRewards } = await import('./e2e/persistent-qa-bag-rewards.js');
let priorGame;
beforeEach(() => {
    priorGame = window.game;
    poll.mockImplementation(observe => ({ toBe: async expected => expect(await observe()).toBe(expected) }));
});
afterEach(() => { window.game = priorGame; });
function harness() {
    const original = jest.fn(() => 'normally handled');
    const game = window.game = { player: { id: 'owner', gold: 1000, inventory: [{ id: 'keep' }], stash: [], equipment: {} }, handleServerMessage: original };
    const page = { evaluate: async (fn, arg) => JSON.parse(JSON.stringify(await fn(arg)) ?? 'null') };
    const reward = changes => game.handleServerMessage({ type: 'room_clear_reward', payload: { playerId: 'owner', gold: 175, roomIndex: 1, instanceType: 'verdant_bastion_catacombs', ...changes } });
    return { game, original, page, reward };
}
test('counts a separately handled room award and exact sale without changing balance or messages', async () => {
    const { game, original, page, reward } = harness();
    await beginPersistentQABagRewards(page);
    expect(reward()).toBe('normally handled');
    expect(original).toHaveBeenCalledTimes(1);
    expect(game.player.gold).toBe(1000);
    game.player.gold = 1178; // Ordinary state replication after sale3 + room175.
    const receipt = await waitForPersistentQABagGold(page, 3);
    expect(receipt.expectedGold).toBe(1178);
    expect(receipt.credits).toEqual([{ gold: 175, roomIndex: 1, instanceType: 'verdant_bastion_catacombs' }]);
    await endPersistentQABagRewards(page);
    expect(game.handleServerMessage).toBe(original);
    expect(game.__qaBagRewards).toBeUndefined();
});
test.each([1000, 1004, 1177, 1179])('an unexplained or incorrect balance %i still fails exact accounting', async gold => {
    const { game, page, reward } = harness();
    await beginPersistentQABagRewards(page); reward(); game.player.gold = gold;
    await expect(waitForPersistentQABagGold(page, 3)).rejects.toThrow();
    await endPersistentQABagRewards(page);
});
test('other owners and unrelated Gold controls never authorize extra Gold', async () => {
    const { game, page, reward, original } = harness();
    await beginPersistentQABagRewards(page);
    reward({ playerId: 'someone-else' });
    game.handleServerMessage({ type: 'other_balance_control', payload: { gold: 175 } });
    game.player.gold = 1178;
    await expect(waitForPersistentQABagGold(page, 3)).rejects.toThrow();
    expect(original).toHaveBeenCalledTimes(2);
    await endPersistentQABagRewards(page);
});
test.each([{ gold: -1 }, { gold: 0.5 }, { roomIndex: -1 }, { instanceType: '' }])('invalid award %j fails', async changes => {
    const { page, reward } = harness();
    await beginPersistentQABagRewards(page); reward(changes);
    await expect(waitForPersistentQABagGold(page, 0)).rejects.toThrow('Invalid or repeated');
    await endPersistentQABagRewards(page);
});
test('duplicate receipts cannot excuse a double credit', async () => {
    const { page, reward, game } = harness();
    await beginPersistentQABagRewards(page); reward(); reward(); game.player.gold = 1350;
    await expect(waitForPersistentQABagGold(page, 0)).rejects.toThrow('Invalid or repeated');
    await endPersistentQABagRewards(page);
});
test('a stash deposit with no award still requires unchanged Gold', async () => {
    const { page } = harness();
    await beginPersistentQABagRewards(page);
    expect((await waitForPersistentQABagGold(page, 0)).expectedGold).toBe(1000);
    await endPersistentQABagRewards(page);
});
