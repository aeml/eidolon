import { stripVTControlCharacters } from 'node:util';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures, freePersistentQALootSlot, loginAndEnterWorld } from './helpers.js';
import { storePersistentQALootSpare } from './persistent-qa-stash.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const [index, action] of ['sale', 'stash'].entries()) {
    test(`retains the ${action} failure when a preceding real sale is unobserved`, async ({ page, baseURL }, testInfo) => {
        test.skip(process.env.EIDOLON_E2E_VENDOR_PREEXISTING_CREDIT !== '1', 'Explicit disposable fixture only');
        const credentials = JSON.parse(process.env.EIDOLON_E2E_VENDOR_STASH_ACCOUNTS)[index];
        let holding = false, priorAcknowledged = false, released = false, saleCommands = 0;
        const pending = [];
        await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
            const server = socket.connectToServer();
            socket.onMessage(message => {
                const command = typeof message === 'string' ? JSON.parse(message) : {};
                if (command.type === 'sell') {
                    saleCommands++;
                    if (command.payload.itemId === 'prior-sale') holding = true;
                }
                server.send(message);
                if (holding && ((action === 'sale' && command.type === 'sell' && command.payload.itemId === 'current-sale') ||
                    (action === 'stash' && command.type === 'stash_deposit'))) {
                    holding = false; released = true;
                    for (const queued of pending.splice(0)) socket.send(queued);
                }
            });
            server.onMessage(message => {
                if (holding) {
                    pending.push(message);
                    if (typeof message === 'string') {
                        const reply = JSON.parse(message);
                        if (reply.type === 'inventory' && reply.payload.some(item => item.id === 'pending-original') &&
                            !reply.payload.some(item => item.id === 'prior-sale')) priorAcknowledged = true;
                    }
                } else socket.send(message);
            });
        });
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        const read = () => page.evaluate(() => {
            const p = window.game.player;
            return { gold: p.gold, inventory: p.inventory.filter(item => item?.id),
                stash: p.stash.filter(item => item?.id), equipment: p.equipment };
        });
        expect((await read()).gold).toBe(1000);
        const startPriorSale = async () => {
            await page.evaluate(() => {
                const game = window.game;
                const slot = game.player.inventory.findIndex(item => item?.id === 'prior-sale');
                if (slot < 0) throw new Error('Prepared prior sale item missing');
                game.uiManager.inventory.onSellItem(slot);
            });
            await expect.poll(() => priorAcknowledged, { timeout: 10_000 }).toBe(true);
            expect((await read()).gold).toBe(1000);
        };
        let failure;
        try {
            if (action === 'sale') {
                await startPriorSale();
                await freePersistentQALootSlot(page);
            } else {
                // Let ordinary recall/walking/opening finish first. Delay the
                // preceding sale immediately before the helper's real snapshot.
                // Actual server packets stay FIFO; no balance or item is edited.
                const proxy = new Proxy(page, { get(target, property) {
                    if (property !== 'evaluate') {
                        const value = Reflect.get(target, property);
                        return typeof value === 'function' ? value.bind(target) : value;
                    }
                    return async (fn, arg) => {
                        if (!saleCommands && String(fn).includes('player.equipment') && String(fn).includes('player.stash') && String(fn).includes('player.gold')) await startPriorSale();
                        return page.evaluate(fn, arg);
                    };
                } });
                await storePersistentQALootSpare(proxy);
            }
        } catch (error) { failure = stripVTControlCharacters(error.message); }
        await testInfo.attach('observed-helper-outcome', { body: JSON.stringify({ action, failure, released, saleCommands, priorAcknowledged }), contentType: 'application/json' });
        expect(released).toBe(true);
        expect(saleCommands).toBe(action === 'sale' ? 2 : 1);
        expect(failure).toBeTruthy();
        expect(failure).toContain(action === 'sale' ? 'The exact vendor Gold credit' : 'toBe(expected)');
        expect(failure).toContain(action === 'sale' ? 'Expected: 1175' : 'Expected: 1000');
        expect(failure).toContain(action === 'sale' ? 'Received: 1417' : 'Received: 1175');
        await expect.poll(() => page.evaluate(() => window.game.player.inventory.some(item => item?.id === 'prior-sale'))).toBe(false);
        const after = await read();
        expect(after.gold).toBe(action === 'sale' ? 1417 : 1175);
        await loginAndEnterWorld(page, credentials);
        expect(await read()).toEqual(after);
        expect(failures, failures.join('\n')).toEqual([]);
        await testInfo.attach('preexisting-credit-counterexample', { body: JSON.stringify({ action, saleCommands,
            priorCredit: action === 'sale' ? 242 : 175, staleGold: 1000, finalGold: after.gold,
            originalHelperFailure: failure, freshLoginExact: true,
            scope: 'Controlled preceding real vendor transaction with FIFO delayed delivery and retained earned loot. Does not establish the cause of the original live failure.' }), contentType: 'application/json' });
    });
}
