import { expect, test } from '@playwright/test';

test('phone slot controls explain wagers, retain free stakes and show lore bonus choices', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
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
    await page.screenshot({ path: '/tmp/eidolon-slot-phone-20260913.png' });
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
    await page.getByRole('button', { name: 'Stop auto spins', exact: true }).click();
    await expect(page.locator('.slot-auto-status')).toContainText('stopped');
    await page.screenshot({ path: '/tmp/eidolon-casino-roomy-phone.png' });
    await page.evaluate(() => {
        const { ui, view } = window.__slotQA;
        ui.update({ ...view, session: { ...view.session, revision: 4 } });
    });
    await page.getByRole('button', { name: 'Manual', exact: true }).click();
    await expect(page.locator('.slot-auto-controls')).toBeHidden();
    await page.getByLabel('Bet amount · Gold', { exact: true }).fill('100');
    await page.getByRole('button', { name: '2×', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Spin · 200 Gold', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Spin · 200 Gold', exact: true }).click();
    expect(await page.evaluate(() => window.__slotQA.sent.at(-1))).toEqual({ action: 'slot_spin', bet: 200, roundRevision: 4 });
    await page.evaluate(() => { const { ui, view } = window.__slotQA; ui.update({ ...view, session: { ...view.session, bet: 200, revision: 5 } }); });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const panel = page.locator('.casino-session');
    expect((await panel.boundingBox()).width).toBeGreaterThan(1000);
    const sidebar = await page.locator('.slot-sidebar').boundingBox(), stage = await page.locator('.slot-stage').boundingBox();
    expect(stage.x).toBeGreaterThan(sidebar.x + sidebar.width);
    expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await panel.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: '/tmp/eidolon-casino-roomy-desktop.png' });
    await page.getByRole('button', { name: 'Leave machine', exact: true }).click();
    await expect(page.locator('.slot-game')).toBeHidden();
});
