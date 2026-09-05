import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    exerciseReconnect, loginAndEnterWorld, moveByGroundClick, projectEntity, projectGroundOffset,
    readPlayerState, returnToTown, zoomOutForPortal
} from './helpers.js';

const credentials = credentialsFromEnvironment();
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function openDungeonGuide(page) {
    await zoomOutForPortal(page);
    let guide;
    // The guide is forty meters south of recall, beyond the usable canvas at
    // some camera/aspect combinations. Approach through normal movement first.
    for (let step = 0; step < 4; step++) {
        guide = await projectEntity(page, 'dungeon-npc-1');
        if (guide?.visible) break;
        const player = await readPlayerState(page);
        const dx = -player.x;
        const dz = 240 - player.z;
        const scale = Math.min(1, 16 / Math.hypot(dx, dz));
        await moveByGroundClick(page, dx * scale, dz * scale, { allowJumpFallback: false });
    }
    await expect.poll(async () => {
        guide = await projectEntity(page, 'dungeon-npc-1');
        return Boolean(guide?.visible);
    }, { timeout: 20_000 }).toBe(true);
    // Reproject as the camera finishes following the walking approach.
    await expect.poll(async () => {
        guide = await projectEntity(page, 'dungeon-npc-1');
        if (!guide?.visible) return null;
        await page.mouse.move(guide.x, guide.y);
        return page.evaluate(() => window.game?.hoveredEntity?.id);
    }, { timeout: 10_000 }).toBe('dungeon-npc-1');
    await page.mouse.click(guide.x, guide.y);
    await expect(page.locator('#dungeon-menu')).toBeVisible({ timeout: 30_000 });
}

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
    await page.locator('#btn-enter-dungeon').click();
    await expect.poll(() => page.evaluate(() => window.game?.currentInstanceType)).toBe('abyssal_well');
    await expect.poll(() => page.evaluate(() => ({ id: window.game.currentInstanceId, seed: window.game.currentDungeonLayout?.generationSeed }))).toEqual(identity);
    await returnToTown(page);
    expect(failures, failures.join('\n')).toEqual([]);
});
