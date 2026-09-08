import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, projectEntity } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function openPvP(page) {
    if (!await page.locator('#pvp-window').isVisible()) await page.locator('#btn-menu-pvp').click();
    await expect(page.locator('#pvp-window')).toBeVisible();
}

const snapshot = page => page.evaluate(() => {
    const game = window.game, p = game.player, profile = game.uiManager.pvp.state.profile || {};
    return { hp: p.stats.hp, mana: p.stats.mana, interval: p.stats.attackSpeed,
        level: p.level, xp: p.xp, gold: p.gold, instance: game.currentInstanceId || '',
        profile: Object.fromEntries(['rating', 'wins', 'losses', 'honor', 'seasonPoints']
            .map(key => [key, profile[key] ?? (key === 'rating' ? 1000 : 0)])) };
});

async function observeBasicReceipts(page) {
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        const receipts = { attacks: [], hits: [] };
        window.__duelCadence = receipts;
        game.handleServerMessage = message => {
            const payload = message.payload;
            if (payload?.sourceId === game.player.id) {
                if (message.type === 'attack') receipts.attacks.push(performance.now());
                if (message.type === 'damage' && payload.amount > 0) receipts.hits.push(payload.amount);
            }
            return original(message);
        };
    });
}

for (const className of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
    test(`${className}: a normal practice duel admits sustained basic attacks without ranked rewards`, async ({ page, browser, baseURL }, testInfo) => {
        test.setTimeout(150_000);
        const base = credentialsFromEnvironment();
        test.skip(!base.username || !base.password, 'Requires disposable isolated accounts');
        expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
        const suffix = `-duel-${className.toLowerCase()}-${testInfo.retry}`;
        const primary = { ...base, username: base.username + suffix, characterClass: className };
        const secondary = { ...primary, username: base.username + '-other' + suffix };
        const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } });
        const opponent = await context.newPage();
        const failures = [collectBrowserFailures(page, baseURL), collectBrowserFailures(opponent, baseURL)];
        try {
            await loginAndEnterWorld(page, primary);
            await loginAndEnterWorld(opponent, secondary);
            for (const actorPage of [page, opponent]) await actorPage.evaluate(() => {
                const game = window.game, handle = game.handleServerMessage.bind(game);
                window.__duelScene = { enterMessages: 0, ownPvPState: false, ownPvPDelta: false };
                game.handleServerMessage = message => {
                    const diagnostic = window.__duelScene;
                    if (message.type === 'enter_instance') diagnostic.enterMessages++;
                    if (message.type === 'state' || message.type === 'delta') {
                        const updates = message.type === 'state' ? message.payload : message.payload.u;
                        const self = Object.values(updates || {}).find(entity => entity.id === game.player.id);
                        if (self?.instanceId?.startsWith('pvp-')) {
                            diagnostic[message.type === 'state' ? 'ownPvPState' : 'ownPvPDelta'] = true;
                        }
                    }
                    return handle(message);
                };
            });
            for (const actorPage of [page, opponent]) {
                await openPvP(actorPage);
                await actorPage.getByRole('button', { name: 'Close PvP window', exact: true }).click();
            }
            const before = await Promise.all([snapshot(page), snapshot(opponent)]);
            expect(before.every(p => p.level === 1 && p.instance === '')).toBe(true);
            await page.keyboard.press('o');
            await page.getByRole('button', { name: `Challenge ${secondary.username} to a duel`, exact: true }).click();
            await page.keyboard.press('Escape');
            await openPvP(opponent);
            await opponent.locator('#pvp-window').getByRole('button', { name: 'Accept', exact: true }).click();
            await opponent.getByRole('button', { name: 'Close PvP window', exact: true }).click();
            try {
                await expect.poll(async () => {
                    const state = await Promise.all([snapshot(page), snapshot(opponent)]);
                    return state[0].instance.startsWith('pvp-') && state[0].instance === state[1].instance;
                }).toBe(true);
            } catch (error) {
                const scenes = await Promise.all([page, opponent].map(p => p.evaluate(() => ({
                    ...window.__duelScene, clientInPvP: Boolean(window.game.currentInstanceId?.startsWith('pvp-')),
                    matchStatus: window.game.uiManager.pvp.state.match?.status || null,
                    matchMode: window.game.uiManager.pvp.state.match?.mode || null,
                    opponents: window.game.uiManager.pvp.state.opponents?.length || 0
                }))));
                console.log('[duel-scene]', JSON.stringify({ className, scenes }));
                throw error;
            }
            const ids = await Promise.all([page, opponent].map(p => p.evaluate(() => window.game.player.id)));
            await observeBasicReceipts(page); await observeBasicReceipts(opponent);
            for (const [actorPage, targetId] of [[page, ids[1]], [opponent, ids[0]]]) {
                let point;
                await expect.poll(async () => {
                    point = await projectEntity(actorPage, targetId);
                    return Boolean(point?.visible);
                }).toBe(true);
                await actorPage.mouse.click(point.x, point.y);
            }
            await expect.poll(async () => Math.min(...await Promise.all([page, opponent].map(p =>
                p.evaluate(() => window.__duelCadence.hits.length)))), { timeout: 35_000 }).toBeGreaterThanOrEqual(5);
            const during = await Promise.all([snapshot(page), snapshot(opponent)]);
            for (const [i, actorPage] of [page, opponent].entries()) {
                const receipts = await actorPage.evaluate(() => window.__duelCadence);
                expect(receipts.attacks.length).toBeGreaterThanOrEqual(5);
                const meanInterval = (receipts.attacks.at(-1) - receipts.attacks[0]) / (receipts.attacks.length - 1) / 1000;
                expect(meanInterval).toBeGreaterThan(during[i].interval - .25);
                expect(meanInterval).toBeLessThan(during[i].interval + .75);
                expect(receipts.hits.every(amount => amount === 1)).toBe(true);
                expect(during[i].hp).toBeLessThan(before[i].hp);
                expect(during[i].mana).toBe(before[i].mana);
                console.log('[duel-cadence]', JSON.stringify({ className, side: i, interval: during[i].interval,
                    meanInterval, attacks: receipts.attacks.length, hits: receipts.hits.length, hp: during[i].hp }));
            }
            await openPvP(page);
            await page.locator('#pvp-window').getByRole('button', { name: 'Forfeit', exact: true }).click();
            await expect.poll(async () => (await Promise.all([snapshot(page), snapshot(opponent)]))
                .every(p => p.instance === '')).toBe(true);
            const after = await Promise.all([snapshot(page), snapshot(opponent)]);
            for (let i = 0; i < 2; i++) for (const field of ['profile', 'level', 'xp', 'gold']) {
                expect(after[i][field]).toEqual(before[i][field]);
            }
            expect(failures.flat(), failures.flat().join('\n')).toEqual([]);
        } finally { await context.close(); }
    });
}
