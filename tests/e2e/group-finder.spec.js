import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const phone of [false, true]) test(`${phone ? 'phone' : 'desktop'} Groups plans preserve listing and invitation consent`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: phone ? 390 : 1280, height: 844 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async phone => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        document.getElementById('start-screen').style.display = 'none';
        document.body.classList.toggle('mobile-mode', phone);
        const ui = new UIManager(phone), sent = [];
        window.__groupFinder = { ui, sent };
        ui.social.onGroupFinder = payload => sent.push(payload);
        ui.social.onPartyInvite = name => sent.push({ unexpectedInvite: name });
        ui.social.onPartyResponse = (name, accepted, invitationId) => sent.push({ response: name, accepted, invitationId });
        ui.social.toggleSocial(true);
        const data = { viewerId: 'viewer', activities: [{ id: 'world', name: 'Exploration', minLevel: 1 }],
            meetingPoints: [{ id: 'dungeon-guide', name: 'Dungeon Guide', x: 0, z: 240 }],
            listings: [{ id: 'listing-current', ownerId: 'owner', name: 'IlyraFan', mode: 'recruit', activity: 'world', role: 'healer', minLevel: 1,
                plan: { meetingPointId: 'dungeon-guide' }, roles: { tank: 1, damage: 1 }, ready: 0,
                members: 2, capacity: 5, class: 'Fighter', level: 70, note: 'Exploring together', expiresAt: new Date(Date.now() + 600000).toISOString() }] };
        window.__groupFinder.data = data;
        ui.social.groupFinder.update(data);
        ui.social.guild.onEvent = payload => sent.push({ unexpectedCalendarWrite: payload });
        ui.social.guild.update({ guild: { id: 'guild', name: 'Lantern Wardens', tag: 'LW', members: [], activities: data.activities,
            events: [{ id: 'event', revision: 1, title: 'Evening exploration', activity: 'world',
                startsAt: new Date(Date.now() + 1800000).toISOString(), durationMinutes: 120, capacity: 4, rsvps: [] }] } });
    }, phone);
    await page.getByRole('tab', { name: 'Guild', exact: true }).click();
    const calendar = page.locator('#tab-panel-guild');
    const handoff = calendar.getByRole('button', { name: 'Find companions for this activity' });
    await expect(handoff).toBeVisible();
    await handoff.scrollIntoViewIfNeeded();
    await expect(handoff).toBeInViewport();
    await expect(calendar).toContainText('Listings last 20 minutes');
    expect((await handoff.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await calendar.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('calendar-recruitment.png') });
    await handoff.click();
    expect(await page.evaluate(() => window.__groupFinder.sent.every(payload => payload.action === 'list'))).toBe(true);
    const panel = page.locator('#tab-panel-groups');
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel('Activity filter')).toHaveValue('world');
    await panel.getByLabel('Join as').selectOption('healer');
    await panel.getByRole('button', { name: 'Ask to join' }).click();
    expect(await page.evaluate(() => window.__groupFinder.sent.at(-1))).toEqual({ action: 'request', ownerId: 'owner', listingId: 'listing-current', role: 'healer' });
    await expect(panel).toContainText('Dungeon Guide, Lanternhold (0, 240)');
    await expect(panel).toContainText('1 tank · 0 healer · 1 damage');
    for (const width of phone ? [390, 320] : [1280]) {
        await page.setViewportSize({ width, height: 844 });
        const overflow = await panel.evaluate(node => node.scrollWidth - node.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        const button = await panel.getByRole('button', { name: 'Ask to join' }).boundingBox();
        expect(button.height).toBeGreaterThanOrEqual(44);
    }
    await panel.getByText('Post or update my listing', { exact: true }).click();
    await expect(panel.getByLabel('Meet in Lanternhold')).toBeVisible();
    await expect(panel.getByLabel('Planned start (local time, optional)')).toBeVisible();
    await panel.getByRole('button', { name: 'Publish for 20 minutes' }).click();
    expect(await page.evaluate(() => window.__groupFinder.sent.at(-1))).toMatchObject({ action: 'post', plan: { meetingPointId: 'dungeon-guide' } });
    await page.screenshot({ path: testInfo.outputPath('group-preparation.png') });
    await page.evaluate(() => {
        const { ui, data } = window.__groupFinder;
        const old = [...ui.social.groupFinder.list.querySelectorAll('button')].find(button => button.textContent === 'Ask to join');
        ui.social.groupFinder.update({ ...data, listings: [{ ...data.listings[0], id: 'listing-replacement' }] });
        old.click();
    });
    expect(await page.evaluate(() => window.__groupFinder.sent.at(-1))).toEqual({ action: 'list' });
    await expect(panel).toContainText('plan or application changed');
    await page.evaluate(() => {
        const { ui } = window.__groupFinder;
        ui.showPartyRequest('IlyraFan', 'invitation-old', 'Meet at Dungeon Guide.');
        ui.showPartyRequest('IlyraFan', 'invitation-current', 'Current plan: meet at Archmage Ilyra.');
    });
    await expect(page.locator('#party-request-benefits')).toContainText('Archmage Ilyra');
    await page.locator('#btn-accept-party').click();
    expect(await page.evaluate(() => window.__groupFinder.sent.at(-1))).toEqual({ response: 'IlyraFan', accepted: true, invitationId: 'invitation-current' });
    await page.evaluate(() => window.__groupFinder.ui.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
