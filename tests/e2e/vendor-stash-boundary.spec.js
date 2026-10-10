import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { collectBrowserFailures, freePersistentQALootSlot, loginAndEnterWorld } from './helpers.js';
import { storePersistentQALootSpare } from './persistent-qa-stash.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const policy of ['baseline', 'current']) {
    test(`real vendor credit precedes stash snapshot with ${policy} helper`, async ({ page, baseURL }, testInfo) => {
        test.skip(process.env.EIDOLON_E2E_VENDOR_STASH_BOUNDARY !== '1', 'Explicit disposable database fixture only');
        const accounts = JSON.parse(process.env.EIDOLON_E2E_VENDOR_STASH_ACCOUNTS);
        const credentials = accounts[policy === 'baseline' ? 0 : 1];
        const baseline = process.env.EIDOLON_E2E_VENDOR_BASELINE_HELPERS;
        expect(createHash('sha256').update(readFileSync(baseline)).digest('hex')).toBe('f40a42973d548a59bef92e1cc3b8a87f0ca356b62d60b4730b58211ffd662f29');
        const freeSlot = policy === 'baseline'
            ? (await import(pathToFileURL(baseline).href)).freePersistentQALootSlot
            : freePersistentQALootSlot;
        // Preserve actual frame ordering. After the ordinary vendor bag JSON,
        // delay the next binary state and every subsequent message together.
        // This makes the existing split acknowledgement deterministic without
        // changing server balances, inventing packets or reordering delivery.
        let saleSeen = false, holding = false, delayed = false, timer;
        const pending = [];
        let saleCommands = 0;
        await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
            const server = socket.connectToServer();
            socket.onMessage(message => {
                if (typeof message === 'string' && JSON.parse(message).type === 'sell') {
                    saleSeen = true; saleCommands++;
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
            await freeSlot(page);
            const atReturn = await read();
            expect(atReturn.inventory).toEqual(initial.inventory.slice(1));
            expect(atReturn.gold).toBe(policy === 'baseline' ? 1000 : 1175);
            expect(saleCommands).toBe(1);
            // Both controls settle before the real stash action; the baseline
            // return above proves its missing barrier, not a server Gold bug.
            await expect.poll(async () => (await read()).gold).toBe(1175);
            const stored = await storePersistentQALootSpare(page);
            const after = await read();
            expect(after.gold).toBe(1175);
            expect(after.stash).toEqual([...initial.stash, stored]);
            expect(after.inventory).toEqual(initial.inventory.filter(item => item.id !== 'vendor-sale' && item.id !== stored.id));
            expect(after.equipment).toEqual(initial.equipment);
            await loginAndEnterWorld(page, credentials);
            expect(await read()).toEqual(after);
            expect(failures, failures.join('\n')).toEqual([]);
            await testInfo.attach('vendor-stash-boundary', { body: JSON.stringify({ policy, delayMs: 1000,
                saleCommands, delayed, initialGold: initial.gold, goldAtHelperReturn: atReturn.gold,
                finalGold: after.gold, finalInventory: after.inventory.length, finalStash: after.stash.length,
                freshLoginExact: true, scope: 'Prepared disposable full bag, real server and ordered delayed state. Original live175Gold failure cause remains unproven.' }), contentType: 'application/json' });
        } finally {
            clearTimeout(timer);
        }
    });
}
