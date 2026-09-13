import { expect, test } from '@playwright/test';

test('phone poker presents private cards, clear reserved-stack raises and safe leave', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { PokerTableUI } = await import('/src/ui/PokerTableUI.js');
        document.getElementById('start-screen').style.display = 'none';
        const panel = document.createElement('section'); panel.className = 'casino-session has-poker';
        const title = document.createElement('h2'); title.textContent = 'Fourfold Hold’em'; panel.append(title);
        const sent = []; const ui = new PokerTableUI(payload => sent.push(payload)); panel.append(ui.root);
        const leave = document.createElement('button'); leave.textContent = 'Leave table'; leave.onclick = () => { ui.update(null); panel.hidden = true; }; panel.append(leave); document.body.append(panel);
        ui.update({ available: true, processing: false, roundId: 'phone-hand', phase: 'betting', gold: 300, players: [] }, 'A');
        window.__pokerQA = { ui, sent };
    });
    await page.getByRole('button', { name: 'Review buy-in', exact: true }).click();
    await expect(page.locator('.poker-confirm')).toContainText('Reserve 100 Gold');
    expect(await page.evaluate(() => window.__pokerQA.sent.length)).toBe(0);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    expect(await page.evaluate(() => window.__pokerQA.sent[0])).toEqual({ action: 'poker_buy_in', roundId: 'phone-hand', bet: 100 });
    await page.evaluate(() => {
        window.__pokerQA.ui.update({ available: true, processing: false, roundId: 'phone-hand', phase: 'playing', gold: 200,
            players: [{ playerId: 'A', name: 'Thorn', seat: 0, buyIn: 100 }, { playerId: 'B', name: 'Mira of the Tides', seat: 1, buyIn: 200 }],
            round: { revision: 4, phase: 'playing', street: 'flop', board: [0, 9, 10], buttonSeat: 0, turnPlayerId: 'A', deadline: new Date(Date.now() + 30000).toISOString(),
                actions: ['fold', 'call', 'raise', 'all_in'], callAmount: 10, minimumRaiseTo: 30, maximumRaiseTo: 100, pots: [{ amount: 30 }],
                players: [{ playerId: 'A', seat: 0, stack: 90, streetBet: 10, committed: 10, cards: [13, 14] }, { playerId: 'B', seat: 1, stack: 180, streetBet: 20, committed: 20, cards: [-1, -1] }] }
        }, 'A');
    });
    await expect(page.locator('.poker-players [aria-label="Hidden card"]')).toHaveCount(2);
    expect(await page.locator('.casino-session').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.getByLabel('Total Gold bet on this street').fill('50');
    await page.getByRole('button', { name: 'Review raise', exact: true }).click();
    await expect(page.locator('.poker-confirm')).toContainText('50 Gold from your reserved stack');
    await page.screenshot({ path: '/tmp/eidolon-poker-phone-20260913.png' });
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    expect(await page.evaluate(() => window.__pokerQA.sent[1])).toEqual({ action: 'poker_play', roundId: 'phone-hand', roundRevision: 4, gameAction: 'raise', bet: 50 });
    await page.getByRole('button', { name: 'Leave table', exact: true }).click();
    await expect(page.locator('.poker-game')).toBeHidden();
});
