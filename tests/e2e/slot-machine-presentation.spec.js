import { expect, test } from '@playwright/test';

// Prepared presentation snapshots, not connected wagers or a physical-phone check.
test.use({ launchOptions: { args: ['--disable-gpu'] } });
test('phone slot controls explain wagers, retain free stakes and pause queued spins for bonus choices', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/src/main.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/src/analytics/game.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { SlotMachineUI } = await import('/src/ui/SlotMachineUI.js');
        document.getElementById('start-screen').style.display = 'none';
        const panel = document.createElement('section'); panel.className = 'casino-session has-slots';
        const title = document.createElement('h2'); title.textContent = "Orun's Living Vault"; panel.append(title);
        const sent = []; const ui = new SlotMachineUI(payload => sent.push(payload)); panel.append(ui.root);
        const leave = document.createElement('button'); leave.textContent = 'Leave machine'; leave.onclick = () => { ui.update(null); panel.hidden = true; }; panel.append(leave); document.body.append(panel);
        const machine = { theme: 'earth', lore: 'The Rootheart remembers doors opened in kindness. Follow its roots beneath the old road.', mechanic: 'During free spins, wilds on the middle reel remain rooted until the feature ends.', freeSpins: 5,
            symbols: ['Seed', 'Fern', 'Amber', 'Roadward', 'Rootheart', 'Orun', 'Living root', 'Vault key'], weights: [24, 20, 16, 12, 10, 8, 5, 5], pays: Array.from({ length: 6 }, () => [6, 16, 28]),
            bonusTitle: 'The buried archive', bonusChoices: ['Unseal the seed chest', 'Read the stone tablet', 'Follow the silver root'] };
        const view = { available: true, processing: false, gold: 500, minBet: 20, maxBet: 500, betStep: 20, machine, lines: Array.from({ length: 10 }, () => [1, 1, 1, 1, 1]), session: { revision: 1, bet: 20, freeSpins: 0, bonus: false } };
        ui.update(view); window.__slotQA = { ui, view, sent };
    });
    await page.getByRole('button', { name: 'Spin · 20 Gold', exact: true }).click();
    expect(await page.evaluate(() => window.__slotQA.sent[0])).toEqual({ action: 'slot_spin', bet: 20, roundRevision: 1 });
    await expect(page.locator('.slot-cell.rolling')).toHaveCount(15);
    const symbols = await page.locator('.slot-grid').textContent();
    await expect.poll(() => page.locator('.slot-grid').textContent()).not.toBe(symbols);
    await page.evaluate(() => {
        const { ui, view } = window.__slotQA;
        const grid = [[7, 0, 1], [2, 7, 3], [6, 4, 7], [1, 0, 2], [3, 5, 4]];
        ui.update({ ...view, gold: 480, session: { ...view.session, revision: 2, freeSpins: 5, bonus: true,
            last: { landed: grid, payout: 0, freeAwarded: 5, bonusPicked: -1, stages: [{ grid, wins: [], payout: 0 }] } } });
    });
    await expect(page.getByRole('button', { name: 'Read the stone tablet', exact: true })).toBeEnabled();
    expect(await page.locator('.slot-grid img').count()).toBe(15);
    expect(await page.locator('.casino-session').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('slots-bonus-phone.png') });
    await page.getByRole('button', { name: 'Read the stone tablet', exact: true }).click();
    expect(await page.evaluate(() => window.__slotQA.sent[1])).toEqual({ action: 'slot_bonus', choice: 1, roundRevision: 2 });
    await page.evaluate(() => {
        const { ui, view } = window.__slotQA;
        ui.update({ ...view, session: { ...view.session, revision: 3, freeSpins: 5 } });
    });
    await page.getByRole('button', { name: 'Auto', exact: true }).click();
    await expect(page.locator('.slot-auto-controls')).toBeVisible();
    await expect(page.locator('.slot-controls:not(.slot-auto-controls) .casino-primary')).toBeHidden();
    await page.getByRole('button', { name: '100', exact: true }).click();
    await page.getByRole('button', { name: 'Start 100 auto spins', exact: true }).click();
    await expect(page.locator('.slot-auto-status')).toContainText('99 spins left');
    await page.evaluate(() => {
        const { ui, view } = window.__slotQA;
        const grid = [[7, 0, 1], [2, 7, 3], [6, 4, 7], [1, 0, 2], [3, 5, 4]];
        ui.update({ ...view, session: { ...view.session, revision: 4, freeSpins: 9, bonus: true,
            last: { landed: grid, payout: 0, free: true, freeAwarded: 5, bonusPicked: -1, stages: [{ grid, wins: [], payout: 0 }] } } });
    });
    await expect(page.getByRole('button', { name: 'Read the stone tablet', exact: true })).toBeEnabled();
    await expect(page.locator('.slot-auto-status')).toContainText('paused for your bonus choice');
    await expect(page.locator('.slot-auto-status')).toContainText('99 spins left');
    await expect(page.getByRole('button', { name: 'Stop auto spins', exact: true })).toBeEnabled();
    // Starting auto spins scrolls the controls into view. A new bonus must bring
    // the required choice back into the visible phone area without user scrolling.
    await expect.poll(async () => {
        const bonus = await page.locator('.slot-bonus').boundingBox();
        const panel = await page.locator('.casino-session').boundingBox();
        return bonus.y >= panel.y && bonus.y + bonus.height <= panel.y + panel.height;
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('slots-auto-bonus-paused-phone.png') });
    await page.getByRole('button', { name: 'Read the stone tablet', exact: true }).click();
    expect(await page.evaluate(() => window.__slotQA.sent.at(-1))).toEqual({ action: 'slot_bonus', choice: 1, roundRevision: 4 });
    const beforeReveal = await page.evaluate(() => window.__slotQA.sent.length);
    await page.evaluate(() => {
        const { ui } = window.__slotQA;
        const picked = { ...ui.view, session: { ...ui.view.session, revision: 5, bonus: false,
            last: { ...ui.view.session.last, bonusPicked: 1, bonusPayout: 40 } } };
        window.__slotQA.picked = picked; ui.update({ ...picked, processing: true });
    });
    await expect(page.locator('.slot-game > .slot-sidebar')).toContainText('Saving settlement');
    expect(await page.evaluate(() => window.__slotQA.sent.length)).toBe(beforeReveal);
    await page.evaluate(() => window.__slotQA.ui.update(window.__slotQA.picked));
    await expect(page.locator('.slot-stage .casino-celebration')).toContainText('BONUS REVEALED');
    expect(await page.evaluate(() => window.__slotQA.sent.length)).toBe(beforeReveal);
    await expect.poll(() => page.evaluate(() => window.__slotQA.sent.length)).toBe(beforeReveal + 1);
    expect(await page.evaluate(() => window.__slotQA.sent.at(-1))).toEqual({ action: 'slot_spin', bet: 20, roundRevision: 5 });
    await expect(page.locator('.slot-auto-status')).toContainText('98 spins left');
    await page.getByRole('button', { name: 'Stop auto spins', exact: true }).click();
    await expect(page.locator('.slot-auto-status')).toContainText('stopped');
    await page.screenshot({ path: testInfo.outputPath('slots-auto-stopped-phone.png') });
    await page.evaluate(() => {
        const { ui, view } = window.__slotQA;
        ui.update({ ...view, session: { ...view.session, revision: 6 } });
    });
    await page.getByRole('button', { name: 'Manual', exact: true }).click();
    await expect(page.locator('.slot-auto-controls')).toBeHidden();
    await page.getByLabel('Bet amount · Gold', { exact: true }).fill('100');
    await page.getByRole('button', { name: '2×', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Spin · 200 Gold', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Spin · 200 Gold', exact: true }).click();
    expect(await page.evaluate(() => window.__slotQA.sent.at(-1))).toEqual({ action: 'slot_spin', bet: 200, roundRevision: 6 });
    await page.evaluate(() => { const { ui, view } = window.__slotQA; ui.update({ ...view, session: { ...view.session, bet: 200, revision: 7 } }); });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const panel = page.locator('.casino-session');
    expect((await panel.boundingBox()).width).toBeGreaterThan(1000);
    const sidebar = await page.locator('.slot-sidebar').boundingBox(), stage = await page.locator('.slot-stage').boundingBox();
    expect(stage.x).toBeGreaterThan(sidebar.x + sidebar.width);
    expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await panel.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath('slots-manual-desktop.png') });
    await page.evaluate(() => {
        const { ui, view } = window.__slotQA;
        const grid = Array.from({ length: 5 }, () => [5,5,5]);
        ui.update({ ...view, session: { ...view.session, bet: 200, revision: 8,
            last: { landed: grid, payout: 20000, bonusPicked: -1, stages: [{ grid, wins: [], payout: 20000, jackpot: true }] } } });
    });
    await expect(page.locator('.slot-stage .casino-celebration')).toContainText('GIGANTIC WIN');
    await expect(page.locator('.slot-stage .casino-celebration')).toHaveCSS('opacity', '1');
    await expect(page.getByRole('button', { name: 'Spin · 200 Gold', exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('slots-gigantic-win-desktop.png') });
    await page.getByRole('button', { name: 'Leave machine', exact: true }).click();
    await expect(page.locator('.slot-game')).toBeHidden();
});
