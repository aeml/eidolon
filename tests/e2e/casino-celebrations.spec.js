import { expect, test } from '@playwright/test';

for (const [width, height] of [[390, 844], [1280, 720], [1440, 1000], [844, 390]]) test(`casino hand labels and large win panels at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
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
        const status = document.createElement('p'); status.className = 'casino-session-status';
        status.textContent = 'Public floor · Gold blackjack. Leaving restores world controls; confirmed wagers continue and payouts are saved.';
        panel.append(status);
        const blackjack = new BlackjackTableUI(() => {}), poker = new PokerTableUI(() => {});
        panel.append(blackjack.root, poker.root); poker.root.hidden = true;
        const view = { available: true, processing: false, phase: 'playing', roundId: 'visible-count', gold: 100000, maxBet: 100000,
            players: [{ playerId: 'A', name: 'Thorn of the Rootheart Sanctum', bet: 100, seat: 0 }, { playerId: 'B', name: 'Mira of the Tidebound Confluence', bet: 100, seat: 1 }],
            round: { revision: 1, dealer: [9], dealerHidden: true, turnPlayerId: 'A', turnHand: 0, actions: ['hit', 'stand'], deadline: new Date(Date.now() + 30000).toISOString(),
                players: [{ playerId: 'A', seat: 0, hands: [{ cards: [10,3], bet: 100 }] }, { playerId: 'B', seat: 1, hands: [{ cards: [8,7], bet: 100 }] }] } };
        blackjack.update(view, 'A'); window.__celebrations = { panel, blackjack, poker, view, title };
        leave.onclick = () => { blackjack.update(null); poker.update(null); panel.hidden = true; };
    });
    await expect(page.locator('.blackjack-hands')).toContainText('Total: 14');
    await expect(page.locator('.blackjack-hands')).toContainText('Mira');
    await expect(page.locator('[aria-label="Dealer hidden card"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Stand', exact: true }).click();
    // Input auto-scroll must not move the dealer/upper seats out of the panel.
    const clipped = await page.evaluate(() => {
        const failures = [], header = document.querySelector('.casino-session-header').getBoundingClientRect();
        for (const element of document.querySelectorAll('.blackjack-scene .card-table-seat, .blackjack-scene .card-table-dealer')) {
            const r = element.getBoundingClientRect();
            if (r.top < header.bottom - 1 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth)
                failures.push({ name: element.className, top: r.top, bottom: r.bottom, header: header.bottom });
        }
        for (const value of document.querySelectorAll('.card-table-seat .casino-hand-value')) {
            const r = value.getBoundingClientRect(), clip = value.closest('.card-table-seat-hands').getBoundingClientRect();
            if (r.top < clip.top - 1 || r.bottom > clip.bottom + 1) failures.push({ name: value.textContent, bottom: r.bottom, clip: clip.bottom });
        }
        return failures;
    });
    expect(clipped).toEqual([]);
    await page.evaluate(() => {
        const { blackjack, view } = window.__celebrations;
        blackjack.update({ ...view, phase: 'complete', round: { ...view.round, dealer: [9,8], dealerHidden: false,
            players: [{ playerId: 'A', seat: 0, hands: [{ cards: [0,12], bet: 100, payout: 250, outcome: 'blackjack' }] }] } }, 'A');
    });
    await expect(page.locator('.blackjack-game .casino-celebration')).toContainText('+150 Gold');
    await expect(page.locator('.blackjack-game .casino-celebration')).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => {
        const value = document.querySelector('.blackjack-scene .card-table-seat .casino-hand-value');
        const clip = value.closest('.card-table-seat-hands').getBoundingClientRect();
        const r = value.getBoundingClientRect();
        const win = document.querySelector('.blackjack-scene .casino-celebration').getBoundingClientRect();
        const clock = document.querySelector('.blackjack-scene .card-table-clock').getBoundingClientRect();
        return { totalVisible: r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1,
            clockClear: win.bottom <= clock.top + 1 || win.top >= clock.bottom - 1 };
    })).toEqual({ totalVisible: true, clockClear: true });
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
    const pokerOverlayBounds = await page.evaluate(() => {
        const win = document.querySelector('.poker-scene .casino-celebration').getBoundingClientRect();
        const clock = document.querySelector('.poker-scene .card-table-clock').getBoundingClientRect();
        return { clear: win.bottom <= clock.top + 1 || win.top >= clock.bottom - 1,
            win: { top: win.top, bottom: win.bottom, height: win.height }, clock: { top: clock.top, bottom: clock.bottom } };
    });
    expect(pokerOverlayBounds.clear, JSON.stringify(pokerOverlayBounds)).toBe(true);
    expect(await page.locator('.poker-board').evaluate(board => {
        const bounds = board.getBoundingClientRect();
        return [...board.children].every(card => {
            const r = card.getBoundingClientRect();
            return r.left >= bounds.left - 1 && r.right <= bounds.right + 1;
        });
    })).toBe(true);
    expect(await page.locator('.casino-session').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `/tmp/eidolon-poker-win-${width}.png` });
    await page.getByRole('button', { name: 'Leave table', exact: true }).click();
    await expect(page.locator('.casino-session')).toBeHidden();
});
