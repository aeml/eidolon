import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('phone Groups tab fits and requests a role without auto-inviting', async ({ page, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        document.getElementById('start-screen').style.display = 'none';
        document.body.classList.add('mobile-mode');
        const ui = new UIManager(true), sent = [];
        window.__groupFinder = { ui, sent };
        ui.social.onGroupFinder = payload => sent.push(payload);
        ui.social.onPartyInvite = name => sent.push({ unexpectedInvite: name });
        ui.social.toggleSocial(true);
        ui.social.groupFinder.update({ viewerId: 'viewer', activities: [{ id: 'world', name: 'Exploration', minLevel: 1 }],
            listings: [{ ownerId: 'owner', name: 'IlyraFan', mode: 'recruit', activity: 'world', role: 'healer', minLevel: 1,
                members: 2, capacity: 5, class: 'Fighter', level: 70, note: 'Exploring together', expiresAt: '2026-09-14T00:00:00Z' }] });
    });
    await page.getByRole('tab', { name: 'Groups', exact: true }).click();
    const panel = page.locator('#tab-panel-groups');
    await expect(panel).toBeVisible();
    await panel.getByLabel('Join as').selectOption('healer');
    await panel.getByRole('button', { name: 'Ask to join' }).click();
    expect(await page.evaluate(() => window.__groupFinder.sent.at(-1))).toEqual({ action: 'request', ownerId: 'owner', role: 'healer' });
    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const overflow = await panel.evaluate(node => node.scrollWidth - node.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        const button = await panel.getByRole('button', { name: 'Ask to join' }).boundingBox();
        expect(button.height).toBeGreaterThanOrEqual(44);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
