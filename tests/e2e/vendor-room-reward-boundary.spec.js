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
        await page.evaluate(() => {
            const game = window.game, handle = game.handleServerMessage, send = game.network.send;
            const observation = window.__roomGoldBoundary = { messages: [], commands: [] };
            const wrappedHandle = function (message) {
                const before = this.player.gold;
                const handled = handle.call(this, message);
                const type = message?.type, payload = message?.payload;
                const self = type === 'state' ? payload?.[this.player.id] : type === 'delta' ? payload?.u?.[this.player.id] : null;
                if (type === 'ep_wallet_result') observation.messages.push({ type, gold: payload.gold, ep: payload.ep, readID: payload.readID });
                if (type === 'room_clear_reward') observation.messages.push({ type, gold: payload.gold, roomIndex: payload.roomIndex });
                if (self?.gold !== undefined && (before !== this.player.gold || !observation.messages.length))
                    observation.messages.push({ type, beforeGold: before, gold: this.player.gold, wireGold: self.gold });
                return handled;
            };
            const wrappedSend = function (type, payload) {
                if (['sell', 'stash_deposit', 'get_ep_wallet'].includes(type)) observation.commands.push({ type,
                    itemId: payload.itemId, readID: payload.readID, beforeGold: game.player.gold });
                return send.call(this, type, payload);
            };
            game.handleServerMessage = wrappedHandle;
            game.network.send = wrappedSend;
            observation.restore = () => {
                if (game.handleServerMessage !== wrappedHandle || game.network.send !== wrappedSend)
                    throw Error('Gold diagnostic lost observer ownership');
                game.handleServerMessage = handle; game.network.send = send;
            };
        });
        let rejected;
        try {
            if (action === 'sale') await freePersistentQALootSlot(page);
            else await storePersistentQALootSpare(page);
        } catch (error) { rejected = error; }
        const expectedGoldWithoutAward = action === 'sale' ? 1003 : 1000;
        const finalGold = expectedGoldWithoutAward + 175;
        const plainError = rejected ? stripVTControlCharacters(rejected.message) : undefined;
        // Retain the existing strict assertion as the observed counterexample.
        // The diagnostic passes only if it rejects this exact uncounted award.
        expect(plainError).toContain(`Expected: ${expectedGoldWithoutAward}`);
        expect(plainError).toContain(`Received: ${finalGold}`);
        await expect.poll(async () => (await read()).gold).toBe(finalGold);
        const observation = await page.evaluate(() => {
            const record = window.__roomGoldBoundary;
            record.restore();
            return { messages: record.messages, commands: record.commands, observerRestored: true };
        });
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
            scope: 'Prepared saved account and immutable server-calculated room entitlement. Actual ordinary browser/server/Mongo delivery; no packets, balances or queues changed. Original public failure cause remains unproven.' };
        await testInfo.attach('earned-room-gold-boundary', { body: JSON.stringify(receipt, null, 2), contentType: 'application/json' });
        await writeFile(path.join(process.env.EIDOLON_E2E_ROOM_GOLD_EVIDENCE, `room-gold-${action}.json`), JSON.stringify(receipt, null, 2));
    });
}
