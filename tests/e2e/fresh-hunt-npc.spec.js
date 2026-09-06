import { expect, test } from '@playwright/test';
import { discussHunt } from './fresh-hunt-route.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 15_000 });
test('ordinary town approach opens the daily Skeleton contract', async ({ page }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires disposable credentials');
    await loginAndEnterWorld(page, credentials);
    await discussHunt(page);
    await expect(page.getByRole('button', { name: 'Accept Quest', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.quests.find(q => q.id === 'daily_skeleton').accepted)).toBe(true);
    await page.locator('#btn-close-quest').click();
    await openDungeonGuide(page);
    await page.locator('#btn-close-dungeon-menu').click();
    await discussHunt(page);
    await expect(page.locator('#quest-window')).toContainText('Daily Hunt: Skeleton');
});
