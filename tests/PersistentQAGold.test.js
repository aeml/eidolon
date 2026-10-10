import { jest } from '@jest/globals';

const poll = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: { poll } }));
const { waitForPersistentQAGoldBaseline } = await import('./e2e/persistent-qa-gold.js');

let originalGame;
beforeEach(() => {
    originalGame = window.game;
    jest.useFakeTimers();
    poll.mockReset();
    poll.mockImplementation(observe => ({ toBe: async value => expect(await observe()).toBe(value) }));
});
afterEach(() => { window.game = originalGame; jest.useRealTimers(); });

function harness(send = true) {
    const original = jest.fn();
    const commands = [];
    window.game = { player: { id: 'current-player', gold: 1000 }, handleServerMessage: original,
        network: { send: jest.fn((type, payload) => { commands.push({ type, payload }); return send; }) } };
    const game = window.game;
    const page = { evaluate: async (fn, arg) => fn(arg) };
    const reply = changes => game.handleServerMessage({ type: 'ep_wallet_result', payload: {
        readID: commands.at(-1).payload.readID, playerID: 'current-player', success: true, pending: false, gold: 1242, ep: 43, ...changes
    } });
    return { page, game, commands, original, reply };
}

test('a correlated read waits for real replication without assigning Gold or suppressing the normal handler', async () => {
    const { page, game, commands, original, reply } = harness();
    const pending = waitForPersistentQAGoldBaseline(page);
    await jest.advanceTimersByTimeAsync(0);
    expect(commands).toEqual([{ type: 'get_ep_wallet', payload: { readID: expect.any(String) } }]);
    poll.mockImplementation(observe => ({ toBe: async expected => {
        expect(expected).toBe(1242);
        expect(await observe()).toBe(1000);
        game.player.gold = 1242; // Subsequent authoritative state application.
        expect(await observe()).toBe(expected);
    } }));
    reply({});
    expect(await pending).toEqual({ gold: 1242, ep: 43 });
    expect(original).toHaveBeenCalledTimes(1);
    expect(game.handleServerMessage).toBe(original);
    expect(jest.getTimerCount()).toBe(0);
});

test('old request IDs and other owners cannot satisfy the fresh read', async () => {
    const { page, game, original, reply } = harness();
    const pending = waitForPersistentQAGoldBaseline(page);
    await jest.advanceTimersByTimeAsync(0);
    reply({ readID: 'old-read' }); reply({ playerID: 'previous-player' });
    expect(poll).not.toHaveBeenCalled();
    game.player.gold = 1242; reply({});
    await pending;
    expect(original).toHaveBeenCalledTimes(3);
    expect(game.handleServerMessage).toBe(original);
});

test.each([{ success: false }, { pending: true }, { gold: -1 }, { gold: 1.5 }, { ep: -1 }, { ep: 0.5 }])(
    'a matching rejected or invalid snapshot fails: %j', async invalid => {
        const { page, game, original, reply } = harness();
        const pending = waitForPersistentQAGoldBaseline(page);
        const rejected = expect(pending).rejects.toThrow('rejected, changed owner or returned invalid balances');
        await jest.advanceTimersByTimeAsync(0);
        reply(invalid); await rejected;
        expect(game.player.gold).toBe(1000);
        expect(game.handleServerMessage).toBe(original);
        expect(poll).not.toHaveBeenCalled();
    }
);

test('a lost reply has a bounded failure and restores its observer', async () => {
    const { page, game, original } = harness();
    const pending = waitForPersistentQAGoldBaseline(page);
    const rejected = expect(pending).rejects.toThrow('did not arrive');
    await jest.advanceTimersByTimeAsync(15_000); await rejected;
    expect(game.handleServerMessage).toBe(original);
    expect(jest.getTimerCount()).toBe(0);
});

test('a failed send fails immediately and restores its observer', async () => {
    const { page, game, original } = harness(false);
    await expect(waitForPersistentQAGoldBaseline(page)).rejects.toThrow('was not sent');
    expect(game.handleServerMessage).toBe(original);
    expect(jest.getTimerCount()).toBe(0);
});

test.each([1000, 1243])('a replicated balance of %i cannot satisfy the exact1242 snapshot', async gold => {
    const { page, game, original, reply } = harness();
    const pending = waitForPersistentQAGoldBaseline(page);
    const rejected = expect(pending).rejects.toThrow();
    await jest.advanceTimersByTimeAsync(0);
    game.player.gold = gold; reply({}); await rejected;
    expect(game.player.gold).toBe(gold);
    expect(game.handleServerMessage).toBe(original);
});

test('a replaced character cannot receive the previous owner baseline', async () => {
    const { page, game, original, reply } = harness();
    const pending = waitForPersistentQAGoldBaseline(page);
    const rejected = expect(pending).rejects.toThrow('changed owner');
    await jest.advanceTimersByTimeAsync(0);
    game.player = { id: 'replacement-player', gold: 7 };
    reply({}); await rejected;
    expect(game.player.gold).toBe(7);
    expect(game.handleServerMessage).toBe(original);
});

test('observer cleanup preserves a handler installed by another owner', async () => {
    const { page, game, reply } = harness();
    const pending = waitForPersistentQAGoldBaseline(page);
    await jest.advanceTimersByTimeAsync(0);
    const observed = game.handleServerMessage;
    const replacement = message => observed.call(game, message);
    game.handleServerMessage = replacement;
    game.player.gold = 1242; reply({}); await pending;
    expect(game.handleServerMessage).toBe(replacement);
    expect(jest.getTimerCount()).toBe(0);
});

test('the sixth read respects the unchanged five-per-ten-second server allowance', async () => {
    const { page, game, commands, reply } = harness();
    for (let index = 0; index < 5; index++) {
        const pending = waitForPersistentQAGoldBaseline(page);
        await jest.advanceTimersByTimeAsync(0);
        game.player.gold = 1242; reply({}); await pending;
    }
    const pending = waitForPersistentQAGoldBaseline(page);
    await jest.advanceTimersByTimeAsync(10_099);
    expect(commands).toHaveLength(5);
    await jest.advanceTimersByTimeAsync(1);
    expect(commands).toHaveLength(6);
    reply({}); await pending;
    expect(jest.getTimerCount()).toBe(0);
});
