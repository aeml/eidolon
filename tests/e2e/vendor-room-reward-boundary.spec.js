import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { collectBrowserFailures, freePersistentQALootSlot, loginAndEnterWorld } from './helpers.js';
import { storePersistentQALootSpare } from './persistent-qa-stash.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const [index, action] of ['sale', 'stash'].entries()) {
    test(`fresh ${action} baseline can precede separately earned room Gold`, async ({ page, baseURL }, testInfo) => {
        test.skip(process.env.EIDOLON_E2E_ROOM_GOLD_BOUNDARY !== '1', 'Explicit disposable retained-room fixture only');
        const credentials = JSON.parse(process.env.EIDOLON_E2E_ROOM_GOLD_ACCOUNTS)[index];
        const observation = { messages: [], commands: [], forwardsOriginalMessages: true };
        let recording = false;
        await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
            const server = socket.connectToServer();
            socket.onMessage(message => {
                if (recording && typeof message === 'string') {
                    const command = JSON.parse(message);
                    if (['sell', 'stash_deposit', 'get_ep_wallet'].includes(command.type))
                        observation.commands.push({ type: command.type, itemId: command.payload?.itemId, readID: command.payload?.readID });
                }
                server.send(message);
            });
            server.onMessage(message => {
                if (recording && typeof message === 'string') {
                    const reply = JSON.parse(message);
                    if (reply.type === 'ep_wallet_result' && reply.payload.readID)
                        observation.messages.push({ type: reply.type, gold: reply.payload.gold, ep: reply.payload.ep, readID: reply.payload.readID });
                    if (reply.type === 'room_clear_reward')
                        observation.messages.push({ type: reply.type, gold: reply.payload.gold, roomIndex: reply.payload.roomIndex });
                }
                socket.send(message);
            });
        });
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        const read = () => page.evaluate(() => {
            const p = window.game.player;
            return { gold: p.gold, inventory: p.inventory.filter(item => item?.id),
                stash: p.stash.filter(item => item?.id), equipment: p.equipment };
        });
        const before = await read();
        expect(before.gold).toBe(1000);
        expect(before.inventory).toHaveLength(25);
        recording = true;
        const expectedGoldWithoutAward = action === 'sale' ? 1003 : 1000;
        const finalGold = expectedGoldWithoutAward + 175;
        // Select the post-award host-read schedule explicitly. The client
        // loop and every original socket message proceed normally. Only the
        // diagnostic's balance-containing reads wait for ordinary replication;
        // the existing helpers still receive real values and keep exact checks.
        const postAwardPage = new Proxy(page, { get(target, property) {
            if (property !== 'evaluate') {
                const value = Reflect.get(target, property);
                return typeof value === 'function' ? value.bind(target) : value;
            }
            return async (fn, argument) => {
                if (observation.commands.some(command => ['sell', 'stash_deposit'].includes(command.type)) &&
                    String(fn).includes('gold')) {
                    await page.waitForFunction(gold => window.game?.player?.gold === gold, finalGold, { timeout: 15_000 });
                }
                return page.evaluate(fn, argument);
            };
        } });
        let rejected;
        try {
            if (action === 'sale') await freePersistentQALootSlot(postAwardPage);
            else await storePersistentQALootSpare(postAwardPage);
        } catch (error) { rejected = error; }
        const plainError = rejected ? stripVTControlCharacters(rejected.message) : undefined;
        // Retain the existing strict assertion as the observed counterexample.
        // The diagnostic passes only if it rejects this exact uncounted award.
        expect(plainError).toContain(`Expected: ${expectedGoldWithoutAward}`);
        expect(plainError).toContain(`Received: ${finalGold}`);
        await expect.poll(async () => (await read()).gold).toBe(finalGold);
        recording = false;
        expect(observation.commands.filter(command => command.type === 'sell')).toHaveLength(action === 'sale' ? 1 : 0);
        expect(observation.commands.filter(command => command.type === 'stash_deposit')).toHaveLength(action === 'stash' ? 1 : 0);
        expect(observation.messages.filter(message => message.type === 'ep_wallet_result'))
            .toEqual([{ type: 'ep_wallet_result', gold: 1000, ep: 43, readID: expect.any(String) }]);
        expect(observation.messages.filter(message => message.type === 'room_clear_reward'))
            .toEqual([{ type: 'room_clear_reward', gold: 175, roomIndex: 1 }]);
        const after = await read();
        expect(after.equipment).toEqual(before.equipment);
        expect(after.inventory).toHaveLength(25);
        const removedId = action === 'sale' ? 'room-gold-sale' : before.inventory[0].id;
        expect(after.inventory).toEqual(expect.arrayContaining(before.inventory.filter(item => item.id !== removedId)));
        expect(after.stash).toEqual(action === 'sale' ? before.stash : [...before.stash, before.inventory[0]]);
        await loginAndEnterWorld(page, credentials);
        expect(await read()).toEqual(after);
        expect(failures, failures.join('\n')).toEqual([]);
        const receipt = { action, expectedGoldWithoutAward, observedFreshWallet: 1000,
            earnedRoomGold: 175, finalGold, strictHelperRejected: true, error: plainError,
            observation, freshLoginExact: true,
            hostReadSchedule: 'After bag command, balance-containing host evaluations wait for ordinarily replicated earned Gold. No client loop, packet, balance, predicate or FIFO change.',
            scope: 'Prepared saved account and immutable server-calculated room entitlement. Actual ordinary browser/server/Mongo delivery; no packets, balances or queues changed. Original public failure cause remains unproven.' };
        await testInfo.attach('earned-room-gold-boundary', { body: JSON.stringify(receipt, null, 2), contentType: 'application/json' });
        await writeFile(path.join(process.env.EIDOLON_E2E_ROOM_GOLD_EVIDENCE, `room-gold-${action}.json`), JSON.stringify(receipt, null, 2));
    });
}
