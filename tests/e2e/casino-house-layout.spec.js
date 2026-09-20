import { expect, test } from '@playwright/test';

// Presentation fixture only. Money and restart recovery use disposable Mongo;
// this fixture does not claim a connected, funded multiplayer session.
for (const width of [390, 1440]) for (const kind of ['roulette', 'baccarat']) {
    test(`${kind} shared table layout at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async ({ kind }) => {
            const { HouseTableUI } = await import('/src/ui/HouseTableUI.js');
            document.getElementById('start-screen').style.display = 'none';
            document.querySelectorAll('canvas').forEach(canvas => { canvas.hidden = true; });
            const panel = document.createElement('section'); panel.className = 'casino-session has-house';
            const header = document.createElement('header'); header.className = 'casino-session-header';
            const title = document.createElement('h2'); title.textContent = `Lanternhold ${kind}`;
            const leave = document.createElement('button'); leave.textContent = 'Leave table'; header.append(title, leave);
            const sent = [], ui = new HouseTableUI(payload => sent.push(payload));
            panel.append(header, ui.root); document.body.append(panel);
            const view = { game: kind, currency: kind === 'baccarat' ? 'ep' : 'gold', available: true, processing: false,
                phase: 'betting', roundId: 'layout-hand', balance: 100, minBet: 20, maxBet: kind === 'baccarat' ? 100 : 100000,
                betStep: 20, players: [], serverNow: new Date().toISOString(), dealAt: new Date(Date.now() + 30000).toISOString(),
                spots: ['red','black','odd','even','low','high','dozen-1','dozen-2','dozen-3','column-1','column-2','column-3']
                    .map(id => ({ id, label: id.replace('-', ' '), multiplier: 2 })) };
            view.spots.push({ id: 'split:1-2', label: 'Split 1/2', multiplier: 18 });
            const presence = { yourSeat: { seat: 0 }, occupants: ['You','Neris','Pyralis','Aeral','Orun','Mara Fen']
                .map((name, seat) => ({ playerId: seat === 0 ? 'hero' : `guest-${seat}`, name, seat, connected: true })) };
            ui.update(view, 'hero', presence); window.__houseLayout = { ui, view, presence, sent };
        }, { kind });
        const panel = page.locator('.casino-session.has-house');
        await expect(panel).toBeVisible(); await expect(panel.locator('.card-table-seat')).toHaveCount(6);
        await expect(panel.getByText('House dealer', { exact: true })).toBeVisible();
        for (const selector of ['.casino-session.has-house', '.house-game', '.card-table-controls']) {
            expect(await page.locator(selector).evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
        }
        await page.screenshot({ path: `/tmp/eidolon-${kind}-betting-${width}.png` });
        await panel.getByRole('button', { name: kind === 'roulette' ? 'Bet on 0' : 'Bet on Player · 1:1', exact: true }).click();
        expect(await page.evaluate(() => window.__houseLayout.sent.length)).toBe(1);
        await page.evaluate(() => {
            const f = window.__houseLayout;
            f.ui.update({ ...f.view, phase: 'revealing', revealAt: new Date(Date.now() + 6000).toISOString() }, 'hero', f.presence);
        });
        await expect(panel.locator('.house-result')).toHaveClass(/revealing/);
        await expect(panel.getByText('House dealer', { exact: true })).toBeVisible();
        await page.evaluate(() => {
            const f = window.__houseLayout, roulette = f.view.game === 'roulette';
            f.ui.update({ ...f.view, phase: 'complete', number: roulette ? 0 : undefined,
                baccarat: roulette ? undefined : { player: [2,3], banker: [3,3], playerTotal: 7, bankerTotal: 8, winner: 'banker' },
                nextRoundAt: new Date(Date.now() + 12000).toISOString(),
                players: [{ playerId: 'hero', name: 'You', seat: 0, wagers: [{ spot: roulette ? 'number:0' : 'banker', amount: 20 }], paid: true, payout: roulette ? 720 : 39 }] }, 'hero', f.presence);
        });
        await expect(panel.getByText('YOU WON', { exact: true })).toBeVisible();
        await expect(panel.locator('.card-table-clock')).toContainText('Next betting window');
        await page.screenshot({ path: `/tmp/eidolon-${kind}-result-${width}.png` });
    });
}
