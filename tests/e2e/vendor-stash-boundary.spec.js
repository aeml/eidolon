import { expect, test } from '@playwright/test';
import { collectBrowserFailures, freePersistentQALootSlot, loginAndEnterWorld } from './helpers.js';
import { storePersistentQALootSpare } from './persistent-qa-stash.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const delivery of ['ordinary', 'delayed']) {
    test(`real vendor credit and stash persist with ${delivery} delivery`, async ({ page, baseURL }, testInfo) => {
        test.skip(process.env.EIDOLON_E2E_VENDOR_STASH_BOUNDARY !== '1', 'Explicit disposable database fixture only');
        const accounts = JSON.parse(process.env.EIDOLON_E2E_VENDOR_STASH_ACCOUNTS);
        const credentials = accounts[delivery === 'ordinary' ? 0 : 1];
        // Delay the next state and all subsequent messages together. Preserve
        // actual ordering: the state may precede the vendor bag acknowledgement.
        // The controlled unit test separately exercises bag-before-Gold order.
        let saleSeen = false, holding = false, delayed = false, timer, pendingSale;
        const pending = [];
        let saleCommands = 0;
        await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
            const server = socket.connectToServer();
            socket.onMessage(message => {
                if (typeof message === 'string' && JSON.parse(message).type === 'sell') {
                    saleCommands++;
                    if (delivery === 'delayed') {
                        pendingSale = message;
                        return;
                    }
                }
                server.send(message);
            });
            server.onMessage(message => {
                if (saleSeen && !delayed && typeof message !== 'string') {
                    holding = true; delayed = true;
                    timer = setTimeout(() => {
                        holding = false;
                        for (const queued of pending.splice(0)) socket.send(queued);
                    }, 1000);
                }
                if (holding) pending.push(message);
                else socket.send(message);
                if (pendingSale && typeof message !== 'string') {
                    server.send(pendingSale);
                    pendingSale = null; saleSeen = true;
                }
            });
        });
        const failures = collectBrowserFailures(page, baseURL);
        try {
            await loginAndEnterWorld(page, credentials);
            const read = () => page.evaluate(() => {
                const p = window.game.player;
                return { gold: p.gold, equipment: p.equipment,
                    inventory: p.inventory.filter(item => item?.id), stash: p.stash.filter(item => item?.id) };
            });
            const initial = await read();
            expect(initial.gold).toBe(1000);
            expect(initial.inventory).toHaveLength(25);
            await freePersistentQALootSlot(page);
            const atReturn = await read();
            expect(atReturn.inventory).toEqual(initial.inventory.slice(1));
            expect(atReturn.gold).toBe(1175);
            expect(saleCommands).toBe(1);
            expect(delayed).toBe(delivery === 'delayed');
            const stored = await storePersistentQALootSpare(page);
            const after = await read();
            expect(after.gold).toBe(1175);
            expect(after.stash).toEqual([...initial.stash, stored]);
            expect(after.inventory).toEqual(initial.inventory.filter(item => item.id !== 'vendor-sale' && item.id !== stored.id));
            expect(after.equipment).toEqual(initial.equipment);
            await loginAndEnterWorld(page, credentials);
            expect(await read()).toEqual(after);
            expect(failures, failures.join('\n')).toEqual([]);
            await testInfo.attach('vendor-stash-boundary', { body: JSON.stringify({ delivery, delayMs: delivery === 'delayed' ? 1000 : 0,
                saleCommands, delayed, initialGold: initial.gold, goldAtHelperReturn: atReturn.gold,
                finalGold: after.gold, finalInventory: after.inventory.length, finalStash: after.stash.length,
                freshLoginExact: true, scope: 'Prepared disposable full bag, real server and ordered delayed state. Original live175Gold failure cause remains unproven.' }), contentType: 'application/json' });
        } finally {
            clearTimeout(timer);
        }
    });
}
