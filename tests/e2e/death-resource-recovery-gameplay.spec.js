import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    projectGroundOffset, readPlayerState, returnToTown, useEncounterQAWaypoint } from './helpers.js';
import { freshRestedResources, observeRestedResources } from './rested-resource-observation.js';
import { sanctuaryRecoveryBounds } from '../castResourceBounds.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 15_000 });

test('login preserves resources and death; town recovery and dead Respawn remain distinct', async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable recovery QA');
    const failures = collectBrowserFailures(page, baseURL);
    const credentials = credentialsFromEnvironment();
    await loginAndEnterWorld(page, credentials);
    await observeRestedResources(page);
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
            manaRegen: player.stats.manaRegen, state: player.state,
            bank: player.wellRestedSeconds, zone: player.safeZoneId,
            level: player.level, gear: Object.values(player.equipment).filter(item => item?.id).length };
    });
    async function verifyFreshLogin(label, dead) {
        const before = dead ? await resources() : await freshRestedResources(page), started = Date.now();
        expect(before.mana).toBeLessThan(before.maxMana);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await loginAndEnterWorld(page, credentials);
        await observeRestedResources(page);
        const after = dead ? await resources() : await freshRestedResources(page);
        const seconds = (Date.now() - started) / 1000;
        if (dead) {
            // This route never levels or equips the fresh Wizard. Rest expiry
            // may legitimately lower its100-point baseline pools from110.
            expect(before.level).toBe(1); expect(after.level).toBe(1);
            expect(before.gear).toBe(0); expect(after.gear).toBe(0);
            expect(after.maxHP).toBe(after.bank > 0 ? 110 : 100);
            expect(after.maxMana).toBe(after.bank > 0 ? 110 : 100);
            expect(after.mana).toBe(Math.min(before.mana, after.maxMana));
            expect(after.bank).toBeLessThanOrEqual(before.bank);
            expect(after.state).toBe('DEAD');
            expect(after.hp).toBe(0);
            await expect(page.locator('#death-screen')).toBeVisible();
        } else {
            expect(after.state).not.toBe('DEAD');
            expect(before.zone).toBe('lanternhold'); expect(after.zone).toBe(before.zone);
            expect(before.bank).toBeGreaterThan(0); expect(after.bank).toBeLessThan(7200);
            expect(after.maxHP).toBe(before.maxHP); expect(after.maxMana).toBe(before.maxMana);
            const earned = after.bank - before.bank;
            for (const [resource, maximum] of [['hp', 'maxHP'], ['mana', 'maxMana']]) {
                const bounds = sanctuaryRecoveryBounds(before[resource], before[maximum], earned, 1);
                expect(after[resource]).toBeGreaterThanOrEqual(bounds.minimum);
                expect(after[resource]).toBeLessThanOrEqual(bounds.maximum);
            }
        }
        await expect.poll(() => page.evaluate(() => {
            const stats = window.game.player.stats;
            return document.getElementById('player-mana-text').textContent ===
                `${Math.floor(stats.mana)} / ${stats.maxMana}`;
        })).toBe(true);
        console.log('[resource-fresh-login]', JSON.stringify({ label, before, after, seconds }));
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
    const beforeRecall = await freshRestedResources(page);
    await returnToTown(page);
    const afterRecall = await freshRestedResources(page);
    expect(afterRecall.zone).toBe(beforeRecall.zone);
    expect(afterRecall.maxMana).toBe(beforeRecall.maxMana);
    const recallBounds = sanctuaryRecoveryBounds(beforeRecall.mana, beforeRecall.maxMana,
        afterRecall.bank - beforeRecall.bank);
    expect(afterRecall.mana).toBeGreaterThanOrEqual(recallBounds.minimum);
    expect(afterRecall.mana).toBeLessThanOrEqual(recallBounds.maximum);
    // Spend again after normal town recovery during Recall. The next
    // login check must still start with a genuinely depleted resource pool.
    await spendMana();
    await verifyFreshLogin('living-recall', false);
    console.log(`[death-resource-recovery] ${JSON.stringify({ depleted, receipt,
        fixture: 'allowlisted near-death readiness; ordinary cast, hostile hit, death button and Recall' })}`);
    expect(failures).toEqual([]);
});
