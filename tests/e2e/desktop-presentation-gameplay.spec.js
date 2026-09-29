import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    projectNearestHostile, useEncounterQAWaypoint } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 }, trace: 'off', screenshot: 'off', video: 'off' });

test('desktop presentation review retains the real HUD and server-backed basic attack', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_DESKTOP_PRESENTATION !== '1', 'Explicit disposable presentation check');
    test.setTimeout(120_000);
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
    expect(process.env.EIDOLON_E2E_WS_URL).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/ws$/);
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL), views = [];
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.isMobile)).toBe(false);
    async function capture(stage) {
        await expect(page.locator('#start-screen')).toBeHidden();
        await expect(page.locator('#auth-password')).toBeHidden();
        const state = await page.evaluate(() => {
            const g = window.game, tag = g.player.nameTag;
            const mask = tag?.layers.mask;
            if (tag) tag.layers.mask = 0;
            return { mask, position: g.player.position.toArray(), zoom: g.renderSystem.currentZoom,
                quality: g.renderSystem.graphicsQuality, hp: g.player.stats.hp,
                attackClip: g.player.currentAction?.getClip().name };
        });
        try {
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.screenshot({ path: testInfo.outputPath(stage + '.png'),
                style: '#perf-overlay, #chat-messages > * { visibility: hidden !important; }',
                mask: [page.getByText(credentials.username, { exact: false })] });
            const { mask: _private, ...view } = state;
            views.push({ stage, ...view });
        } finally {
            await page.evaluate(mask => {
                if (mask !== undefined && window.game.player.nameTag) window.game.player.nameTag.layers.mask = mask;
            }, state.mask);
        }
    }
    await expect(page.locator('#chat-box')).toBeVisible();
    await expect(page.locator('#hotbar-container')).toBeVisible();
    await capture('town-hud');
    // Existing allowlisted waypoint only approaches a live enemy. Protection
    // makes this presentation/input coverage, not survival or progression QA.
    await useEncounterQAWaypoint(page);
    await capture('encounter-hud');
    let target;
    await expect.poll(async () => { target = await projectNearestHostile(page); return Boolean(target); }).toBe(true);
    await page.evaluate(() => {
        const network = window.game.network, send = network.send.bind(network);
        window.__presentationAttacks = [];
        network.send = (type, payload) => {
            if (type === 'attack') window.__presentationAttacks.push(payload.targetId);
            return send(type, payload);
        };
    });
    await page.mouse.click(target.x, target.y);
    await expect.poll(() => page.evaluate(id => window.__presentationAttacks.includes(id), target.id)).toBe(true);
    await expect.poll(() => page.evaluate(id => {
        const g = window.game;
        const enemy = g.activeEntitiesCache.find(e => e.id === id) || g.remotePlayers.get(id);
        return enemy?.state === 'DEAD' ? 0 : enemy?.stats.hp ?? Infinity;
    }, target.id), { timeout: 20_000 }).toBeLessThan(target.health);
    await capture('attack-hud');
    await testInfo.attach('presentation-views', { body: JSON.stringify(views), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
