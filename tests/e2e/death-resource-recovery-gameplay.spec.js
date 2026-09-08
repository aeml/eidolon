import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    projectGroundOffset, readPlayerState, returnToTown, useEncounterQAWaypoint } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 15_000 });

test('login preserves spent resources and death; only dead Respawn refills mana', async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable recovery QA');
    const failures = collectBrowserFailures(page, baseURL);
    const credentials = credentialsFromEnvironment();
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');
    let lastCommandAt = 0;
    async function command(value, confirmation) {
        await page.waitForTimeout(Math.max(0, 1100 - (Date.now() - lastCommandAt)));
        lastCommandAt = Date.now();
        const messages = page.locator('.chat-message__text').filter({ hasText: confirmation });
        const before = await messages.count();
        await page.locator('#chat-input').click();
        await page.locator('#chat-input').fill(value);
        await page.locator('#chat-input').press('Enter');
        await expect.poll(() => messages.count()).toBeGreaterThan(before);
        if (await page.locator('#chat-input').evaluate(node => node === document.activeElement)) {
            await page.keyboard.press('Escape');
        }
    }
    const installObserver = () => page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        window.__resourceRecovery = { casts: 0, armed: false, receipt: null, latestMana: null };
        game.handleServerMessage = message => {
            const evidence = window.__resourceRecovery;
            if (message.type === 'ability_result' && message.payload?.skillName === 'Fireball' && message.payload.accepted) evidence.casts++;
            const updates = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
            const player = updates?.[game.player.id];
            if (player?.mana !== undefined) evidence.latestMana = player.mana;
            if (evidence.armed && player?.health > 0 && player.mana !== undefined &&
                player.mana === (player.maxMana ?? game.player.stats.maxMana)) {
                evidence.receipt = { hp: player.health, maxHP: player.maxHealth ?? game.player.stats.maxHp,
                    mana: player.mana, maxMana: player.maxMana ?? game.player.stats.maxMana };
            }
            return original(message);
        };
    });
    await installObserver();
    async function spendMana() {
        const before = await page.evaluate(() => window.__resourceRecovery.casts);
        await expect.poll(() => page.evaluate(() => window.game.player.abilityCooldown)).toBeLessThanOrEqual(0);
        const away = await page.evaluate(() => {
            const game = window.game, p = game.player;
            const enemy = [...game.remotePlayers.values()].filter(e => game.isHostileActorTarget(e))
                .sort((a, b) => p.position.distanceTo(a.position) - p.position.distanceTo(b.position))[0];
            if (!enemy) return { x: 0, z: -12 };
            const dx = p.position.x - enemy.position.x, dz = p.position.z - enemy.position.z;
            const scale = 12 / Math.max(1, Math.hypot(dx, dz));
            return { x: dx * scale, z: dz * scale };
        });
        const point = await projectGroundOffset(page, away.x, away.z);
        expect(point?.canvas).toBe(true);
        await page.mouse.click(point.x, point.y, { button: 'right' });
        await expect.poll(() => page.evaluate(() => window.__resourceRecovery.casts)).toBeGreaterThan(before);
        await expect.poll(() => page.evaluate(() => window.__resourceRecovery.latestMana !== null &&
            window.__resourceRecovery.latestMana < window.game.player.stats.maxMana)).toBe(true);
    }
    const resources = () => page.evaluate(() => {
        const player = window.game.player;
        return { hp: player.stats.hp, maxHP: player.stats.maxHp, mana: player.stats.mana,
            maxMana: player.stats.maxMana, hpRegen: player.stats.hpRegen,
            manaRegen: player.stats.manaRegen, state: player.state };
    });
    async function verifyFreshLogin(label, dead) {
        const before = await resources(), started = Date.now();
        expect(before.mana).toBeLessThan(before.maxMana);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await loginAndEnterWorld(page, credentials);
        const after = await resources(), seconds = (Date.now() - started) / 1000;
        expect(after.maxHP).toBe(before.maxHP);
        expect(after.maxMana).toBe(before.maxMana);
        // Only elapsed online regeneration is allowed. An extra point covers
        // the existing fractional tick at the two observation boundaries.
        const hpAllowance = dead ? 0 : Math.ceil(before.hpRegen * seconds) + 1;
        const manaAllowance = dead ? 0 : Math.ceil(before.manaRegen * seconds) + 1;
        expect(after.hp).toBeGreaterThanOrEqual(before.hp);
        expect(after.hp).toBeLessThanOrEqual(Math.min(after.maxHP, before.hp + hpAllowance));
        expect(after.mana).toBeGreaterThanOrEqual(before.mana);
        expect(after.mana).toBeLessThanOrEqual(Math.min(after.maxMana, before.mana + manaAllowance));
        expect(after.mana).toBeLessThan(after.maxMana);
        if (dead) {
            expect(after.state).toBe('DEAD');
            expect(after.hp).toBe(0);
            await expect(page.locator('#death-screen')).toBeVisible();
        } else expect(after.state).not.toBe('DEAD');
        await expect.poll(() => page.evaluate(() => {
            const stats = window.game.player.stats;
            return document.getElementById('player-mana-text').textContent ===
                `${Math.floor(stats.mana)} / ${stats.maxMana}`;
        })).toBe(true);
        console.log('[resource-fresh-login]', JSON.stringify({ label, before, after, seconds, hpAllowance, manaAllowance }));
        await installObserver();
    }
    // This first cast/reload is in town, before any prepared death fixture.
    // It must not manufacture mana via ordinary credentialed login.
    await spendMana();
    await verifyFreshLogin('living-spent-mana', false);
    await useEncounterQAWaypoint(page);
    await command('/qa-animation-ready near-death', 'Animation QA readiness restored at one health for hostile death validation.');
    await spendMana();
    await command('/qa-protection off', 'QA waypoint protection disabled; hostile damage is authoritative.');
    await expect(page.locator('#death-screen')).toBeVisible({ timeout: 45_000 });
    expect((await readPlayerState(page)).state).toBe('DEAD');
    const depleted = await page.evaluate(() => window.game.player.stats.mana);
    expect(depleted).toBeLessThan(await page.evaluate(() => window.game.player.stats.maxMana));
    await verifyFreshLogin('hostile-death', true);
    await page.evaluate(() => { window.__resourceRecovery.armed = true; });
    await returnToTown(page);
    await expect.poll(() => page.evaluate(() => Boolean(window.__resourceRecovery.receipt))).toBe(true);
    const receipt = await page.evaluate(() => window.__resourceRecovery.receipt);
    expect(receipt.hp).toBe(receipt.maxHP);
    expect(receipt.mana).toBe(receipt.maxMana);
    await spendMana();
    await returnToTown(page);
    expect(await page.evaluate(() => window.game.player.stats.mana)).toBeLessThan(receipt.maxMana);
    await verifyFreshLogin('living-recall', false);
    console.log(`[death-resource-recovery] ${JSON.stringify({ depleted, receipt,
        fixture: 'allowlisted near-death readiness; ordinary cast, hostile hit, death button and Recall' })}`);
    expect(failures).toEqual([]);
});
