import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { approachEncounter, selectLiveTarget } from './mobile-helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: devices['Pixel 7'].userAgent,
    actionTimeout: 12_000, trace: 'off', screenshot: 'off', video: 'off' });

test('phone bag equips, unequips and confirms a recoverable server-owned item drop', async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated disposable QA character');
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.isMobile)).toBe(true);
    // Explicit QA character precondition: the nearby combat population starts
    // above level one. This route tests owned-item actions, not first-hour balance.
    await page.locator('#chat-mobile-toggle').tap();
    await page.locator('#chat-input').tap();
    await page.locator('#chat-input').fill('/level 30');
    await page.locator('#chat-input').press('Enter');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(30);
    await page.locator('#chat-mobile-toggle').tap();
    const points = await page.evaluate(() => window.game.player.statPoints);
    if (points > 0) {
        await page.locator('#btn-mobile-char').tap();
        await page.getByRole('button', { name: 'Increase strength', exact: true }).tap();
        await expect.poll(() => page.evaluate(() => window.game.player.statPoints)).toBe(points - 1);
        await page.locator('#btn-close-character').tap();
    }
    await page.locator('#btn-mobile-menu').tap();
    await page.locator('#btn-settings').tap();
    const autoLoot = page.locator('#auto-loot-enabled');
    if (!await autoLoot.isChecked()) await autoLoot.tap();
    await page.locator('#btn-close-settings-header').tap();
    if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-resume').tap();

    const findItem = () => page.evaluate(() => {
        const game = window.game;
        return game.player.inventory.find(item => item?.id && !item.id.startsWith('chronicle-item-')
            && game.uiManager.inventory._isEquippableItem(item) && item.level <= game.player.level)?.id;
    });
    let itemId = await findItem();
    const combatSnapshot = id => page.evaluate(id => {
        const game = window.game;
        const enemy = game.chunkManager.getActiveEntities().find(e => e.id === id);
        return {
            player: { state: game.player.state, level: game.player.level, damage: game.player.stats.damage,
                position: game.player.position.toArray(), target: game.player.targetPosition?.toArray() },
            enemy: enemy ? { id: enemy.id, state: enemy.state, level: enemy.level, hp: enemy.stats?.hp,
                position: enemy.position.toArray(), range: game.getBasicAttackRangeForEntity(enemy) } : null,
            pending: game.pendingInteraction?.id, selected: game.getMobileCombatTarget()?.id,
            joystick: game.inputManager.joystickVector.toArray(), keys: Object.keys(game.inputManager.keys).filter(k => game.inputManager.keys[k])
        };
    }, id);
    // Setup uses the level-prepared character and existing allowlisted waypoint,
    // not granted items, a forced kill or a guaranteed-loot command.
    for (let attempt = 0; !itemId && attempt < 8; attempt++) {
        await approachEncounter(page);
        const target = await selectLiveTarget(page);
        console.log('[phone-inventory] ordinary combat setup', JSON.stringify(await combatSnapshot(target.id)));
        await page.locator('#btn-mobile-attack').tap();
        try {
            await expect.poll(() => page.evaluate(id => {
                const target = window.game.chunkManager.getActiveEntities().find(e => e.id === id);
                return !target || target.state === 'DEAD';
            }, target.id), { timeout: 40_000 }).toBe(true);
        } catch (error) {
            console.log('[phone-inventory] ordinary combat failed', JSON.stringify(await combatSnapshot(target.id)));
            throw error;
        }
        await page.waitForTimeout(1_100);
        itemId = await findItem();
    }
    expect(itemId, 'Normal combat must yield a usable owned item for the bag route').toBeTruthy();
    const ownsItem = () => page.evaluate(id => window.game.player.inventory.some(item => item?.id === id), itemId);
    await page.locator('#btn-mobile-menu').tap();
    await page.locator('#btn-recall').tap();
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        return !game.currentInstanceId && Math.hypot(game.player.position.x + 1.25, game.player.position.z - 200) < 3;
    }), { timeout: 30_000 }).toBe(true);

    for (const [width, height] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width, height });
        await page.locator('#btn-mobile-inv').tap();
        const index = await page.evaluate(id => window.game.player.inventory.findIndex(item => item?.id === id), itemId);
        expect(index).toBeGreaterThanOrEqual(0);
        await page.locator('#inventory-grid .inv-slot').nth(index).tap();
        await expect(page.locator('#phone-item-details')).toBeVisible();
        expect(await ownsItem()).toBe(true);
        await page.locator('#phone-item-equip').tap();
        let equippedSlot;
        await expect.poll(async () => {
            equippedSlot = await page.evaluate(id => Object.keys(window.game.player.equipment).find(slot => window.game.player.equipment[slot]?.id === id), itemId);
            return Boolean(equippedSlot);
        }).toBe(true);
        await page.locator('#btn-close-inventory').tap();
        await page.locator('#btn-mobile-char').tap();
        await page.locator(`#slot-${equippedSlot.toLowerCase()}`).tap();
        await expect(page.locator('#phone-item-details')).toBeVisible();
        expect(await page.evaluate(slot => window.game.player.equipment[slot]?.id, equippedSlot)).toBe(itemId);
        await page.locator('#phone-item-unequip').tap();
        await expect.poll(ownsItem).toBe(true);
        await page.locator('#btn-close-character').tap();

        await page.locator('#btn-mobile-inv').tap();
        const returnedIndex = await page.evaluate(id => window.game.player.inventory.findIndex(item => item?.id === id), itemId);
        await page.locator('#inventory-grid .inv-slot').nth(returnedIndex).tap();
        await page.locator('#phone-item-drop').tap();
        expect(await ownsItem()).toBe(true);
        await page.locator('#phone-item-back').tap();
        expect(await ownsItem()).toBe(true);
        await page.locator('#inventory-grid .inv-slot').nth(returnedIndex).tap();
        await page.locator('#phone-item-drop').tap();
        await page.locator('#phone-item-drop').tap();
        await expect.poll(() => page.evaluate(id => window.game.player.inventory.some(item => item?.id === id), itemId)).toBe(false);
        await expect.poll(() => page.evaluate(id => [...window.game.remotePlayers.values()].some(entity => entity.item?.id === id), itemId)).toBe(true);
        await page.waitForTimeout(1_100);
        expect(await page.evaluate(id => window.game.player.inventory.some(item => item?.id === id), itemId)).toBe(false);
        await page.locator('#btn-close-inventory').tap();
        await page.locator('#btn-mobile-interact').tap();
        await expect.poll(ownsItem).toBe(true);
        console.log(`[phone-inventory] ${width}x${height}: authoritative equip, unequip, cancelled drop, confirmed drop and manual recovery passed`);
    }
    await page.reload();
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(id => window.game.player.inventory.some(item => item?.id === id), itemId)).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
