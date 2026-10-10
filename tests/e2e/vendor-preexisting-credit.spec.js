import { expect, test } from '@playwright/test';
import { collectBrowserFailures, freePersistentQALootSlot, loginAndEnterWorld } from './helpers.js';
import { storePersistentQALootSpare } from './persistent-qa-stash.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const [index, action] of ['sale', 'stash'].entries()) {
    test(`synchronizes the ${action} baseline after a preceding real sale`, async ({ page, baseURL }, testInfo) => {
        test.skip(process.env.EIDOLON_E2E_VENDOR_PREEXISTING_CREDIT !== '1', 'Explicit disposable fixture only');
        const credentials = JSON.parse(process.env.EIDOLON_E2E_VENDOR_STASH_ACCOUNTS)[index];
        let holding = false, priorAcknowledged = false, released = false, saleCommands = 0;
        const pending = [], walletSnapshots = [];
        let walletCommands = 0;
        await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
            const server = socket.connectToServer();
            socket.onMessage(message => {
                const command = typeof message === 'string' ? JSON.parse(message) : {};
                if (command.type === 'sell') {
                    saleCommands++;
                    if (command.payload.itemId === 'prior-sale') holding = true;
                }
                if (command.type === 'get_ep_wallet') walletCommands++;
                server.send(message);
                if (holding && command.type === 'get_ep_wallet') {
                    holding = false; released = true;
                    for (const queued of pending.splice(0)) socket.send(queued);
                }
            });
            server.onMessage(message => {
                if (typeof message === 'string') {
                    const reply = JSON.parse(message);
                    if (reply.type === 'ep_wallet_result') walletSnapshots.push({ readID: reply.payload.readID, gold: reply.payload.gold, ep: reply.payload.ep });
                }
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
        if (action === 'sale') {
            await startPriorSale();
            await freePersistentQALootSlot(page);
        } else {
            // Finish actual recall/walking/opening first, then schedule the
            // preceding real sale immediately before the correlated read.
            const proxy = new Proxy(page, { get(target, property) {
                if (property !== 'evaluate') {
                    const value = Reflect.get(target, property);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
                return async (fn, arg) => {
                    if (!saleCommands && String(fn).includes('get_ep_wallet')) await startPriorSale();
                    return page.evaluate(fn, arg);
                };
            } });
            await storePersistentQALootSpare(proxy);
        }
        expect(released).toBe(true);
        expect(saleCommands).toBe(action === 'sale' ? 2 : 1);
        expect(walletCommands).toBe(1);
        expect(walletSnapshots).toEqual([{ readID: expect.any(String), gold: action === 'sale' ? 1242 : 1175, ep: 43 }]);
        await expect.poll(() => page.evaluate(() => window.game.player.inventory.some(item => item?.id === 'prior-sale'))).toBe(false);
        const after = await read();
        expect(after.gold).toBe(action === 'sale' ? 1417 : 1175);
        await loginAndEnterWorld(page, credentials);
        expect(await read()).toEqual(after);
        expect(failures, failures.join('\n')).toEqual([]);
        await testInfo.attach('preexisting-credit-counterexample', { body: JSON.stringify({ action, saleCommands,
            priorCredit: action === 'sale' ? 242 : 175, staleGold: 1000, finalGold: after.gold,
            correlatedBaselineGold: walletSnapshots[0].gold, walletCommands, freshLoginExact: true,
            scope: 'A correlated read synchronizes prior real vendor credits before unchanged exact sale/stash assertions. FIFO delivery, retained earned loot and fresh-login preservation. Original live root cause remains unproven.' }), contentType: 'application/json' });
    });
}
