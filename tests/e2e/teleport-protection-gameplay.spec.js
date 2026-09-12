import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { aimAtGroundPoint } from './ground-aim.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';
import { selectPreparedRune } from './prepared-rune-input.js';
import { installTeleportNativeObserver } from './teleport-native-observer.js';
import { teleportNativeDestination } from './teleport-native-route.js';

test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false,
    trace: 'off', screenshot: 'off', video: 'off' });

test('paid Teleport training has matching endpoint boundaries and finite Phase protection on both clients', async ({ page, browser, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable allowlisted native actors');
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');
    let lastCommandAt = 0;
    async function command(value) {
        await page.waitForTimeout(Math.max(0, 1100 - (Date.now() - lastCommandAt)));
        lastCommandAt = Date.now();
        await page.locator('#chat-input').click(); await page.locator('#chat-input').fill(value);
        await page.locator('#chat-input').press('Enter');
        if (await page.locator('#chat-input').evaluate(node => node === document.activeElement)) await page.keyboard.press('Escape');
    }
    // Functional level/readiness setup only. Purchases, rune choices, movement,
    // casts and fresh-login persistence use normal player controls.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    const skills = page.locator('#skill-tree-window');
    await page.keyboard.press('k'); await expect(skills).toBeVisible();
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    await skills.locator('.skill-branch').filter({ hasText: 'Control & Utility' })
        .getByRole('button', { name: 'Select Spec' }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.indexOf('Teleport'))).toBeGreaterThanOrEqual(0);
    await page.locator('#btn-close-skills').click();
    const otherBrowser = await browser.browserType().launch({ executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
        headless: true, args: hardwareWebGLBrowserArgs() });
    try {
        const peer = await (await otherBrowser.newContext({ ...devices['Desktop Chrome'], baseURL })).newPage();
        const peerFailures = collectBrowserFailures(peer, baseURL);
        await loginAndEnterWorld(peer, { ...credentials, username: `${credentials.username}-observer`, characterClass: 'Fighter' });
        let sourceId = await page.evaluate(() => window.game.player.id);
        await expect.poll(() => peer.evaluate(id => window.game.remotePlayers.has(id), sourceId)).toBe(true);
        let home;
        async function observe() {
            for (const actor of [page, peer]) await actor.evaluate(installTeleportNativeObserver, sourceId);
        }
        async function rune(id, name) {
            await page.keyboard.press('k'); await expect(skills).toBeVisible();
            await selectPreparedRune(page, skills, { skill: 'Teleport', id, name });
            await expect.poll(() => page.evaluate(() => window.game.player.skillRunes?.Teleport)).toBe(id);
            await page.locator('#btn-close-skills').click();
        }
        async function quality(value) {
            for (const actor of [page, peer]) {
                await actor.keyboard.press('Escape'); await actor.locator('#btn-settings').click();
                await actor.locator('#graphics-quality').selectOption(value);
                await actor.locator('#btn-close-settings').click();
                if (await actor.locator('#esc-menu').isVisible()) await actor.keyboard.press('Escape');
            }
        }
        async function buy(id, name) {
            await page.keyboard.press('k'); await skills.getByRole('button', { name: 'Talents', exact: true }).click();
            for (let rank = 1; rank <= 5; rank++) {
                const node = skills.locator('.skill-node').filter({ has: page.locator('.skill-node-title', { hasText: name }) });
                await expect(node).toHaveCount(1); await node.scrollIntoViewIfNeeded(); await node.click();
                await expect.poll(() => page.evaluate(id => window.game.player.talentRanks?.[id], id)).toBe(rank);
            }
            await page.locator('#btn-close-skills').click();
        }
        async function cast(label, radius, duration, mode) {
            await quality(mode);
            const ready = await page.evaluate(() => window.game.animationQAReadySequence || 0);
            await command('/qa-animation-ready');
            await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(ready);
            await expect.poll(() => page.evaluate(() => {
                const p = window.game.player;
                return p.wellRestedSeconds > 0 && p.stats.mana === p.stats.maxMana;
            })).toBe(true);
            for (const actor of [page, peer]) await expect.poll(() => actor.evaluate(id => {
                const g = window.game, p = g.player.id === id ? g.player : g.remotePlayers.get(id);
                return !p?.attachedStatusEffects.has('invulnerable') && !(g.effects || []).some(e =>
                    e.isActive && e.abilityShape?.sourceId === id && e.abilityShape.skillName === 'Teleport');
            }, sourceId)).toBe(true);
            const before = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
            home ||= before;
            const destination = teleportNativeDestination(home, before);
            await aimAtGroundPoint(page, destination);
            await observe();
            const maxMana = await page.evaluate(() => window.game.player.stats.maxMana);
            const slot = await page.evaluate(() => window.game.player.hotbar.indexOf('Teleport'));
            await page.keyboard.press(String(slot + 1));
            await expect.poll(() => page.evaluate(() => window.__teleportNative.results.length)).toBe(1);
            const receipt = await page.evaluate(() => window.__teleportNative.results[0]);
            expect(receipt).toMatchObject({ accepted: true, mana: maxMana - 40 });
            expect(receipt.cooldownRemaining).toBeGreaterThan(0);
            for (const actor of [page, peer]) {
                await expect.poll(() => actor.evaluate(() => window.__teleportNative.casts.length)).toBe(1);
                const event = await actor.evaluate(() => window.__teleportNative.casts[0]);
                expect(event.origin.x).toBeCloseTo(before.x, 1); expect(event.origin.z).toBeCloseTo(before.z, 1);
                expect(Math.hypot(event.targetX - before.x, event.targetZ - before.z)).toBeGreaterThan(.5);
                expect(event.radius || 0).toBe(radius);
                expect(event.boundaries).toHaveLength(radius ? 2 : 0);
                if (radius) for (const [i, ring] of event.boundaries.entries()) {
                    const anchor = i ? { x: event.targetX, z: event.targetZ } : event.origin;
                    expect(ring).toMatchObject({ radius, visibleRadius: radius, attached: true });
                    expect(ring.x).toBeCloseTo(anchor.x, 3); expect(ring.z).toBeCloseTo(anchor.z, 3);
                }
                if (duration) {
                    await expect.poll(() => actor.evaluate(() => Boolean(window.__teleportNative.bestProtection))).toBe(true);
                    const sample = await actor.evaluate(() => window.__teleportNative.bestProtection);
                    expect(sample.duration).toBeGreaterThan(duration - .5); expect(sample.duration).toBeLessThanOrEqual(duration + .1);
                    expect(sample).toMatchObject({ solidShells: 0, quality: mode, active: true, attached: true });
                    if (actor === page) expect(sample.buff).toBe('Protected');
                }
                await actor.screenshot({ path: testInfo.outputPath(`teleport-${label}-${actor === page ? 'owner' : 'peer'}.png`) });
            }
            for (const actor of [page, peer]) await expect.poll(() => actor.evaluate(id => {
                const g = window.game, p = g.player.id === id ? g.player : g.remotePlayers.get(id);
                return !p.invulnerableActive && !p.attachedStatusEffects.has('invulnerable') &&
                    !(g.effects || []).some(e => e.isActive && e.abilityShape?.sourceId === id && e.abilityShape.skillName === 'Teleport');
            }, sourceId), { timeout: 5000 }).toBe(true);
            console.log('[teleport-native]', JSON.stringify({ label, radius, duration, quality: mode, bothClientsExpired: true }));
        }
        await rune('teleport_warp', 'Warp');
        await cast('warp-untrained-high', 4, 0, 'high');
        await buy('WIZ_38', 'Mana Geometry');
        await buy('WIZ_36', 'Volatile Insight');
        await cast('warp-trained-low', 5, 0, 'low');
        await rune('teleport_phase', 'Phase');
        await cast('phase-untrained-high', 0, 1, 'high');
        await buy('WIZ_34', 'Prismatic Control');
        await loginAndEnterWorld(page, credentials);
        sourceId = await page.evaluate(() => window.game.player.id);
        await expect.poll(() => peer.evaluate(id => window.game.remotePlayers.has(id), sourceId)).toBe(true);
        for (const id of ['WIZ_38', 'WIZ_36', 'WIZ_34']) expect(await page.evaluate(id => window.game.player.talentRanks[id], id)).toBe(5);
        expect(await page.evaluate(() => window.game.player.skillRunes.Teleport)).toBe('teleport_phase');
        await cast('phase-saved-low', 0, 1.2, 'low');
        expect(failures).toEqual([]); expect(peerFailures).toEqual([]);
    } finally { await otherBrowser.close(); }
});
