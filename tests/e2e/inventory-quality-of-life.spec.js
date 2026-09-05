import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, exerciseCombatAndLoot, loginAndEnterWorld, projectEntity, returnToTown, setAutoLootThroughSettings } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('bag drag-out creates recoverable ground loot and Journal tracking survives reload', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    // Earn an actual server loot item through the existing disposable QA
    // encounter route; starter models do not imply owned equipment.
    await exerciseCombatAndLoot(page);
    await returnToTown(page);
    await expect.poll(() => page.evaluate(() => window.game.player.state)).toBe('IDLE');
    const equipped = await page.evaluate(() => window.game.player.inventory.find(item => item?.id && !item.id.startsWith('chronicle-item-'))?.id);
    expect(equipped, 'QA character must own a regular loot item').toBeTruthy();
    await setAutoLootThroughSettings(page, true);
    await page.keyboard.press('i');
    await expect(page.locator('#inventory-screen')).toBeVisible();
    expect(await page.evaluate(() => window.game.autoLootEnabled)).toBe(true);
    const index = await page.evaluate(id => window.game.player.inventory.findIndex(item => item?.id === id), equipped);
    const slot = page.locator('#inventory-grid .inv-slot').nth(index);
    const worldPoint = await page.evaluate(() => {
        const canvas = window.game.renderSystem.renderer.domElement;
        for (const x of [window.innerWidth * 0.55, window.innerWidth * 0.7, window.innerWidth * 0.4]) {
            for (const y of [window.innerHeight * 0.55, window.innerHeight * 0.7]) {
                if (document.elementFromPoint(x, y) === canvas) return { x, y };
            }
        }
        return null;
    });
    expect(worldPoint, 'An unobstructed world drop target is required').not.toBeNull();
    const box = await slot.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 5 });
    await page.mouse.move(worldPoint.x, worldPoint.y, { steps: 15 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(id => window.game.player.inventory.some(item => item?.id === id), equipped)).toBe(false);
    let lootId;
    await expect.poll(async () => {
        lootId = await page.evaluate(id => [...window.game.remotePlayers.values()].find(actor => actor.item?.id === id)?.id, equipped);
        return Boolean(lootId);
    }).toBe(true);
    await page.waitForTimeout(1200); // several normal auto-loot cycles
    expect(await page.evaluate(id => window.game.player.inventory.some(item => item?.id === id), equipped)).toBe(false);
    await page.keyboard.press('i');
    const point = await projectEntity(page, lootId);
    expect(point?.visible).toBe(true);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate(id => window.game.player.inventory.some(item => item?.id === id), equipped)).toBe(true);

    await page.keyboard.press('j');
    const story = page.locator('[data-quest-track^="chronicle_"]').first();
    await expect(story).toBeVisible();
    await story.uncheck();
    await expect(page.locator('#objectives-list .objective-entry__badge').filter({ hasText: 'Story' })).toHaveCount(0);
    await page.reload();
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(id => window.game.player.inventory.some(item => item?.id === id), equipped)).toBe(true);
    await page.keyboard.press('j');
    await expect(page.locator('[data-quest-track^="chronicle_"]').first()).not.toBeChecked();
    await page.locator('[data-quest-track^="chronicle_"]').first().check();
    await expect(page.locator('#objectives-list .objective-entry__badge').filter({ hasText: 'Story' })).toHaveCount(1);
    expect(failures, failures.join('\n')).toEqual([]);
});
