import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) test(`casino hand labels and large win panels at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { BlackjackTableUI } = await import('/src/ui/BlackjackTableUI.js');
        const { PokerTableUI } = await import('/src/ui/PokerTableUI.js');
        document.getElementById('start-screen').style.display = 'none';
        const panel = document.createElement('section'); panel.className = 'casino-session has-blackjack';
        const header = document.createElement('header'); header.className = 'casino-session-header';
        const title = document.createElement('h2'); title.textContent = 'Lanternhold Blackjack';
        const leave = document.createElement('button'); leave.textContent = 'Leave table';
        header.append(title, leave); panel.append(header); document.body.append(panel);
        const blackjack = new BlackjackTableUI(() => {}), poker = new PokerTableUI(() => {});
        panel.append(blackjack.root, poker.root); poker.root.hidden = true;
        const view = { available: true, processing: false, phase: 'playing', roundId: 'visible-count', gold: 100000, maxBet: 100000,
            players: [{ playerId: 'A', name: 'Thorn', bet: 100, seat: 0 }, { playerId: 'B', name: 'Mira', bet: 100, seat: 1 }],
            round: { revision: 1, dealer: [9], dealerHidden: true, turnPlayerId: 'A', turnHand: 0, actions: ['hit', 'stand'], deadline: new Date(Date.now() + 30000).toISOString(),
                players: [{ playerId: 'A', seat: 0, hands: [{ cards: [10,3], bet: 100 }] }, { playerId: 'B', seat: 1, hands: [{ cards: [8,7], bet: 100 }] }] } };
        blackjack.update(view, 'A'); window.__celebrations = { panel, blackjack, poker, view, title };
        leave.onclick = () => { blackjack.update(null); poker.update(null); panel.hidden = true; };
    });
    await expect(page.locator('.blackjack-hands')).toContainText('Total: 14');
    await expect(page.locator('.blackjack-hands')).toContainText('Mira');
    await expect(page.locator('[aria-label="Dealer hidden card"]')).toHaveCount(1);
    await page.evaluate(() => {
        const { blackjack, view } = window.__celebrations;
        blackjack.update({ ...view, phase: 'complete', round: { ...view.round, dealer: [9,8], dealerHidden: false,
            players: [{ playerId: 'A', seat: 0, hands: [{ cards: [0,12], bet: 100, payout: 250, outcome: 'blackjack' }] }] } }, 'A');
    });
    await expect(page.locator('.blackjack-game .casino-celebration')).toContainText('+150 Gold');
    await expect(page.locator('.blackjack-game .casino-celebration')).toHaveCSS('opacity', '1');
    expect(await page.locator('.casino-session').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `/tmp/eidolon-blackjack-win-${width}.png` });
    await page.evaluate(() => {
        const { blackjack, poker, panel, title } = window.__celebrations;
        blackjack.update(null); panel.className = 'casino-session has-poker'; title.textContent = 'Fourfold Hold’em';
        poker.update({ available: true, processing: false, phase: 'complete', roundId: 'full-house', gold: 200000, maxBuyIn: 100000,
            players: [{ playerId: 'A', name: 'Thorn', buyIn: 100000, seat: 0 }], round: { revision: 2, phase: 'complete', showdown: true,
                board: [27,2,15,8,9], buttonSeat: 0, actions: [], pots: [{ amount: 200000, winners: ['A'] }],
                players: [{ playerId: 'A', seat: 0, cards: [1,14], payout: 200000, stack: 0, streetBet: 100000, committed: 100000, bestHand: 'Full house — 2s full of 3s' }] } }, 'A');
    });
    await expect(page.locator('.poker-game .casino-celebration')).toContainText('Full house — 2s full of 3s');
    await expect(page.locator('.poker-game .casino-celebration')).toContainText('Net +100,000 Gold');
    await expect(page.locator('.poker-game .casino-celebration')).toHaveCSS('opacity', '1');
    expect(await page.locator('.casino-session').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `/tmp/eidolon-poker-win-${width}.png` });
    await page.getByRole('button', { name: 'Leave table', exact: true }).click();
    await expect(page.locator('.casino-session')).toBeHidden();
});
