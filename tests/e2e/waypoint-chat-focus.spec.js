import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    useVerdantQAWaypoint } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const mode of ['focused-input', 'game-tab', 'closed-skills', 'body-hotkey']) {
    test(`waypoint chat uses ordinary controls after ${mode}`, async ({ page, baseURL }) => {
        test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable QA');
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentialsFromEnvironment());
        const input = page.locator('#chat-input');
        if (mode === 'focused-input') {
            await input.click(); await expect(input).toBeFocused();
        } else if (mode === 'game-tab') {
            await page.locator('#chat-tab-game').click();
            await expect(input).toBeHidden();
        } else if (mode === 'closed-skills') {
            await page.keyboard.press('k');
            await expect(page.locator('#skill-tree-window')).toBeVisible();
            await page.locator('#btn-close-skills').click();
            await expect(page.locator('#skill-tree-window')).toBeHidden();
        } else {
            await input.click(); await input.press('Escape');
            await page.keyboard.press('Enter');
            await expect(input).toBeFocused();
        }
        await useVerdantQAWaypoint(page);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
