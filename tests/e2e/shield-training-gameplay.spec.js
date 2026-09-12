import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    moveByGroundClick, returnToTown } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('Shield mastery increases actual saved absorption, renders and expires through normal play', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable Shield QA');
    const credentials = credentialsFromEnvironment();
    expect(testInfo.retry).toBeLessThanOrEqual(1);
    if (testInfo.retry) credentials.username += `-retry${testInfo.retry}`;
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    let lastCommandAt = 0;
    async function command(value) {
        await page.waitForTimeout(Math.max(0, 1100 - (Date.now() - lastCommandAt)));
        lastCommandAt = Date.now();
        await page.locator('#chat-mobile-toggle').tap();
        await page.locator('#chat-input').fill(value);
        await page.locator('#chat-input').press('Enter');
        await page.locator('#chat-mobile-toggle').tap();
    }
    // Existing allowlisted preparation only; never inject ranks, shields or hits.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    async function openBuild(tab) {
        await page.locator('#btn-mobile-menu').tap();
        await page.locator('#btn-phone-skills').tap();
        await page.locator('.phone-build-tabs').getByRole('button', { name: tab, exact: true }).tap();
    }
    await openBuild('Skills');
    const branch = page.locator('[data-build-action="branch:C"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar?.[1])).toBe('Arcane Shield');
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();

    async function observe() {
        await page.evaluate(() => {
            const game = window.game;
            window.__shieldQA = { results: [], snapshots: [], ranks: { ...game.player.talentRanks } };
            const handle = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                const qa = window.__shieldQA;
                if (message.type === 'ability_result' && message.payload?.skillName === 'Arcane Shield') {
                    qa.results.push(message.payload);
                }
                const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
                for (const state of Object.values(states || {})) {
                    if (state.id !== game.player.id) continue;
                    if (state.talentRanks) qa.ranks = { ...state.talentRanks };
                    if (state.arcaneShieldActive !== undefined) qa.snapshots.push({ at: performance.now(),
                        active: state.arcaneShieldActive, hp: state.arcaneShieldHp, health: state.health,
                        duration: state.arcaneShieldDuration });
                }
                return handle(message);
            };
        });
    }
    await observe();
    async function cast(rank, label, expiry = false) {
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await command('/qa-animation-ready');
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
        expect(await page.evaluate(() => window.__shieldQA.ranks.WIZ_21 || 0)).toBe(rank);
        const expected = await page.evaluate(rank => Math.floor((100 + 5 * window.game.player.stats.intelligence) * (1 + .04 * rank) + 1e-9), rank);
        await page.evaluate(() => { window.__shieldQA.results = []; window.__shieldQA.snapshots = []; });
        await page.locator('#hotbar-container .hotbar-slot').nth(1).tap();
        await expect.poll(() => page.evaluate(() => window.__shieldQA.results.length)).toBe(1);
        expect(await page.evaluate(() => window.__shieldQA.results[0])).toMatchObject({ accepted: true });
        await expect.poll(() => page.evaluate(expected => window.__shieldQA.snapshots.some(s => s.active && s.hp === expected), expected)).toBe(true);
        await expect.poll(() => page.evaluate(expected => {
            const p = window.game.player;
            return p.arcaneShieldActive && p.shieldHP === expected && p.attachedStatusEffects.has('arcane_shield');
        }, expected)).toBe(true);
        await page.locator('#btn-phone-status').tap();
        const badge = page.locator('#phone-status-panel [data-buff-id="arcane_shield"]');
        await expect(badge).toBeVisible();
        await expect(badge.locator('h3')).toHaveText('Arcane Shield');
        await expect(badge.locator('.phone-status-remaining')).toHaveText(/^\d+\.\ds left$/);
        await page.screenshot({ path: testInfo.outputPath(`shield-${label}.png`) });
        await page.locator('#btn-close-phone-status').tap();
        await expect(page.locator('#phone-status-panel')).toBeHidden();
        await page.screenshot({ path: testInfo.outputPath(`shield-model-${label}.png`) });
        if (expiry) {
            await expect.poll(() => page.evaluate(() => window.game.player.arcaneShieldActive), { timeout: 23_000 }).toBe(false);
            expect(await page.evaluate(() => window.game.player.shieldHP)).toBe(0);
            await expect.poll(() => page.evaluate(() => window.game.player.attachedStatusEffects.has('arcane_shield'))).toBe(false);
            const elapsed = await page.evaluate(() => {
                const samples = window.__shieldQA.snapshots, first = samples.find(s => s.active);
                return (samples.find(s => s.at > first.at && s.active === false).at - first.at) / 1000;
            });
            expect(elapsed).toBeGreaterThan(19);
            expect(elapsed).toBeLessThan(21);
        }
        console.log(`[shield-training] ${label}: rank=${rank} capacity=${expected} expiry=${expiry}`);
        return expected;
    }
    const baseline = await cast(0, 'portrait-baseline');
    await openBuild('Talents');
    for (let rank = 1; rank <= 5; rank++) {
        const buy = page.locator('[data-build-action="talent:WIZ_21"]');
        await buy.scrollIntoViewIfNeeded(); await buy.tap();
        await expect.poll(() => page.evaluate(() => window.__shieldQA.ranks.WIZ_21)).toBe(rank);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    }
    await page.locator('#btn-close-skills').tap();
    const trained = await cast(5, 'portrait-trained');
    expect(trained).toBe(Math.floor(baseline * 1.2 + 1e-9));
    await loginAndEnterWorld(page, credentials);
    await page.setViewportSize({ width: 844, height: 390 });
    await observe();
    expect(await cast(5, 'landscape-saved', true)).toBe(trained);

    // Approach ordinary overworld enemies while protected, then explicitly
    // remove waypoint protection so a real hostile attack consumes the shield.
    await command('/qa-waypoint verdant');
    await expect.poll(() => page.evaluate(() => {
        const p = window.game.player.position;
        return Math.hypot(p.x - 800, p.z - 250);
    }), { timeout: 30_000 }).toBeLessThan(3);
    if (process.env.EIDOLON_E2E_SCENERY_VISIBILITY === '1') {
        await expect.poll(() => page.evaluate(() => [...window.game.renderSystem.sceneryVisibility.entries.values()]
            .some(entry => entry.opacity < .005))).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('entrance-live-cutaway.png') });
        console.log('[entrance-live] normal rendered hero receives a cutaway at the existing protected waypoint');
    }
    const observeTarget = () => page.evaluate(async () => {
        const { nearestObservedHostile } = await import('/tests/observedHostileApproach.js');
        const game = window.game, p = game.player.position;
        return nearestObservedHostile(p, [...game.remotePlayers.values()].map(enemy => ({
            id: enemy.id, subtype: enemy.subType || enemy.constructor?.name,
            active: enemy.isActive && game.isHostileActorTarget(enemy),
            alive: enemy.state !== 'DEAD' && (enemy.health ?? enemy.stats?.hp) > 0,
            x: enemy.position.x, z: enemy.position.z
        })), 'InfernoTitan');
    });
    await expect.poll(observeTarget, { message: 'Observe a real Inferno Titan before approaching it' }).not.toBeNull();
    const target = await observeTarget();
    expect(target).not.toBeNull();
    console.log('[shield-approach]', JSON.stringify({ target: target.id, initialDistance: target.distance }));
    for (let step = 0; step < 15; step++) {
        const offset = await page.evaluate(id => {
            const enemy = window.game.remotePlayers.get(id), p = window.game.player;
            return enemy ? { x: enemy.position.x - p.position.x, z: enemy.position.z - p.position.z } : null;
        }, target.id);
        expect(offset).not.toBeNull();
        const distance = Math.hypot(offset.x, offset.z);
        if (distance < 3) break;
        const scale = Math.min(7, distance - 2) / distance;
        // The generic helper normally returns after just one unit. Here each
        // planned seven-unit step must substantially finish before replanning.
        await moveByGroundClick(page, offset.x * scale, offset.z * scale,
            { minimumDistance: Math.min(6, Math.max(1, (distance - 3) * 0.5)) });
    }
    expect(await page.evaluate(id => {
        const game = window.game, enemy = game.remotePlayers.get(id);
        return enemy ? game.player.position.distanceTo(enemy.position) : Infinity;
    }, target.id), 'Ordinary movement must reach the observed enemy before removing protection').toBeLessThan(3);
    const capacity = await cast(5, 'before-hostile-hit');
    await command('/qa-protection off');
    await expect.poll(() => page.evaluate(capacity => window.__shieldQA.snapshots.some(s => s.active && s.hp > 0 && s.hp < capacity), capacity), { timeout: 12_000 }).toBe(true);
    const absorbed = await page.evaluate(capacity => {
        const first = window.__shieldQA.snapshots.find(s => s.active && s.hp > 0 && s.hp < capacity);
        return { remaining: first.hp, absorbed: capacity - first.hp };
    }, capacity);
    expect(await page.evaluate(() => window.game.player.attachedStatusEffects.has('arcane_shield'))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('shield-hostile-absorption.png') });
    console.log(`[shield-absorption] ${JSON.stringify(absorbed)}`);
    await returnToTown(page);
    if (process.env.EIDOLON_E2E_SCENERY_VISIBILITY === '1') {
        await expect.poll(() => page.evaluate(() => [...window.game.renderSystem.sceneryVisibility.entries.values()]
            .every(entry => entry.opacity === 1 && entry.parts.every(part => part.mesh.material === part.material)))).toBe(true);
        console.log('[entrance-live] ordinary town recall restores the original landmark materials');
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
