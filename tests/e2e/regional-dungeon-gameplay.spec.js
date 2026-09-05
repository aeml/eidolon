import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    exerciseReconnect, loginAndEnterWorld, projectGroundOffset,
    readPlayerState, returnToTown
} from './helpers.js';
import { openDungeonGuide } from './dungeon-guide.js';

const credentials = credentialsFromEnvironment();
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('Water dungeon accepts eastward movement, reconnect, town recall and re-entry', async ({ page, baseURL }) => {
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.setTimeout(300_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await returnToTown(page);
    await openDungeonGuide(page);
    if (!(await page.locator('#dungeon-party-state-box').innerText()).includes('No active party instance')) {
        // Use the normal leader-only reset control on this dedicated solo QA run.
        await expect(page.locator('#btn-reset-dungeon')).toBeVisible();
        await page.locator('#btn-reset-dungeon').click();
        await expect(page.locator('#dungeon-menu')).toBeHidden();
        await openDungeonGuide(page);
        await expect(page.locator('#dungeon-party-state-box')).toContainText('No active party instance');
    }
    await page.locator('#dungeon-type-select').selectOption('abyssal_well');
    await page.locator('#diff-btn-normal').click();
    await page.locator('#dungeon-run-level-select').selectOption('60');
    await page.locator('#btn-enter-dungeon').click();
    await expect(page.locator('#dungeon-menu')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.game?.currentInstanceType)).toBe('abyssal_well');
    await expect.poll(() => page.evaluate(() => window.game?.currentDungeonLayout?.generationSeed || '')).not.toBe('');
    const identity = await page.evaluate(() => ({ id: window.game.currentInstanceId, seed: window.game.currentDungeonLayout.generationSeed }));
    let target;
    await expect.poll(async () => {
        target = await projectGroundOffset(page, 15, 0);
        return Boolean(target?.canvas);
    }, { timeout: 15_000 }).toBe(true);
    await page.mouse.move(target.x, target.y);
    await page.mouse.click(target.x, target.y);
    // The old x=50000 envelope pinned the character west of this point.
    // A generic "moved somewhere" check could wrongly accept that correction.
    await expect.poll(async () => (await readPlayerState(page)).x, { timeout: 10_000 }).toBeGreaterThan(50005);
    await page.waitForTimeout(1_200);
    expect((await readPlayerState(page)).x).toBeGreaterThan(50005);
    await exerciseReconnect(page);
    await expect.poll(() => page.evaluate(() => ({ id: window.game.currentInstanceId, seed: window.game.currentDungeonLayout?.generationSeed })), { timeout: 20_000 }).toEqual(identity);
    await page.keyboard.press('Escape');
    await page.locator('#btn-recall').click();
    await expect.poll(() => page.evaluate(() => window.game?.currentInstanceType)).toBe('overworld');
    await returnToTown(page);
    await openDungeonGuide(page);
    await expect(page.locator('#dungeon-active-run-summary')).toContainText('Abyssal Well · Normal · Level 60');
    await expect(page.locator('#dungeon-run-level-select')).toBeDisabled();
    await page.locator('#btn-enter-dungeon').click();
    await expect.poll(() => page.evaluate(() => window.game?.currentInstanceType)).toBe('abyssal_well');
    await expect.poll(() => page.evaluate(() => ({ id: window.game.currentInstanceId, seed: window.game.currentDungeonLayout?.generationSeed }))).toEqual(identity);
    await returnToTown(page);
    expect(failures, failures.join('\n')).toEqual([]);
});
