import { expect, test } from '@playwright/test';

// Presentation and public-projection fixtures; durable outcomes/settlement are
// covered by the Go tests against disposable Mongo, never earned by this setup.
for (const width of [390, 844, 1440]) test(`roulette ball launch, close-up and exact landing at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await page.route('**/src/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/src/analytics/game.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { HouseTableUI } = await import('/src/ui/HouseTableUI.js');
        document.getElementById('start-screen').style.display = 'none';
        const panel = document.createElement('section'); panel.className = 'casino-session has-house';
        const header = document.createElement('header'); header.className = 'casino-session-header';
        const title = document.createElement('h2'); title.textContent = 'The Lantern Wheel';
        const leave = document.createElement('button'); leave.textContent = 'Leave table'; header.append(title, leave);
        const sent = [], ui = new HouseTableUI(p => sent.push(p)); panel.append(header, ui.root); document.body.append(panel);
        const v = { tableId: 'public-roulette', tableVersion: '1', game: 'roulette', currency: 'gold', available: true,
            phase: 'betting', roundId: 'r1', balance: 1000, minBet: 20, maxBet: 100000, betStep: 20, players: [],
            serverNow: new Date().toISOString(), dealAt: new Date(Date.now() + 30000).toISOString(),
            history: [0,32,15,19,4,21,2,25].map((number, i) => ({ roundId: String(i), number })), spots: [] };
        ui.update(v, 'hero'); leave.onclick = () => ui.update(null); window.__round = { ui, v, sent };
    });
    const bowl = page.locator('.roulette-bowl'), initial = await bowl.boundingBox();
    await page.evaluate(() => {
        const f = window.__round; f.ui.update({ ...f.v, tableVersion: '2', phase: 'revealing', revealAt: new Date(Date.now() + 6000).toISOString() }, 'hero');
    });
    await expect(page.locator('.roulette-theatre')).toHaveClass(/close-up/);
    await expect.poll(async () => (await bowl.boundingBox()).width).toBeGreaterThan(initial.width);
    await expect(page.locator('.roulette-ball-track')).toBeVisible();
    const angle = await page.locator('.roulette-ball-track').getAttribute('style');
    await expect.poll(() => page.locator('.roulette-ball-track').getAttribute('style')).not.toBe(angle);
    await page.screenshot({ path: testInfo.outputPath(`roulette-launch-${width}.png`) });
    expect(await page.locator('.casino-session').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
    const ballBox = await page.locator('.roulette-ball-track i').boundingBox();
    expect(ballBox.width).toBeGreaterThanOrEqual(5);
    await page.evaluate(() => { const f = window.__round; f.ui.update({ ...f.v, tableVersion: '3', phase: 'settling', number: 32 }, 'hero'); });
    await expect(page.locator('.roulette-theatre')).not.toHaveClass(/close-up/);
    await expect(page.locator('.roulette-outcome')).toHaveText('32 · Red');
    expect(await page.evaluate(() => {
        const p = window.__round.ui.presentation;
        return Math.abs(((p.ballAngle - p.wheelAngle - 360 / 37) % 360 + 360) % 360);
    })).toBeLessThan(.001);
    await page.screenshot({ path: testInfo.outputPath(`roulette-landed-${width}.png`) });
    await page.getByRole('button', { name: 'Leave table', exact: true }).click();
    expect(await page.evaluate(() => window.__round.sent)).toEqual([]);
    await page.evaluate(() => window.__round.ui.dispose());
});

for (const width of [390, 1440]) test(`baccarat deals visible cards with live scores and a bead history at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/src/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/src/analytics/game.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { HouseTableUI } = await import('/src/ui/HouseTableUI.js');
        document.getElementById('start-screen').style.display = 'none';
        const panel = document.createElement('section'); panel.className = 'casino-session has-house';
        const header = document.createElement('header'); header.className = 'casino-session-header'; header.textContent = 'The Fourfold Baccarat';
        const ui = new HouseTableUI(() => {}); panel.append(header, ui.root); document.body.append(panel);
        const v = { tableId: 'vip-baccarat', tableVersion: '2', game: 'baccarat', currency: 'ep', available: true,
            phase: 'revealing', roundId: 'r1', balance: 100, minBet: 20, maxBet: 100, betStep: 20, players: [],
            serverNow: new Date().toISOString(), revealAt: new Date(Date.now() + 6000).toISOString(),
            history: Array.from({ length: 24 }, (_, i) => ({ roundId: String(i), baccarat: { playerTotal: [8,4,6][i % 3], bankerTotal: 6, winner: ['player','banker','tie'][i % 3] } })) };
        window.__baccarat = { ui, v }; ui.update(v, 'hero');
    });
    for (let count = 1; count <= 6; count++) {
        await page.evaluate(count => {
            const f = window.__baccarat, player = [0,3,1].slice(0, Math.ceil(count / 2)), banker = [12,2,4].slice(0, Math.floor(count / 2));
            f.ui.update({ ...f.v, dealt: { player, banker } }, 'hero');
        }, count);
        await expect(page.locator('.baccarat-theatre [data-card]')).toHaveCount(count);
        await expect(page.locator('.baccarat-outcome')).not.toContainText('wins');
    }
    await expect(page.locator('.baccarat-result-hand.player > strong')).toHaveText('Player · 7');
    await expect(page.locator('.baccarat-result-hand.banker > strong')).toHaveText('Banker · 8');
    await page.screenshot({ path: testInfo.outputPath(`baccarat-cards-${width}.png`) });
    await page.locator('.casino-history').scrollIntoViewIfNeeded();
    await expect(page.locator('.casino-history li')).toHaveCount(24);
    await page.screenshot({ path: testInfo.outputPath(`baccarat-history-${width}.png`) });
    expect(await page.locator('.casino-session').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.__baccarat.ui.dispose());
});

for (const width of [390, 1440]) for (const theme of ['earth', 'water', 'fire', 'air']) test(`${theme} slots show a skippable saved spin and inspectable paylines at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/src/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/src/analytics/game.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async theme => {
        const { SlotMachineUI } = await import('/src/ui/SlotMachineUI.js');
        document.getElementById('start-screen').style.display = 'none';
        const panel = document.createElement('section'); panel.className = 'casino-session has-slots';
        const header = document.createElement('header'); header.className = 'casino-session-header';
        const title = document.createElement('h2'); title.textContent = 'Fourfold Reels';
        const leave = document.createElement('button'); leave.textContent = 'Leave table'; header.append(title, leave);
        const sent = [], ui = new SlotMachineUI(p => sent.push(p)); panel.append(header, ui.root); document.body.append(panel);
        const v = { available: true, currency: 'gold', balance: 1000, processing: false, minBet: 20, maxBet: 100000, betStep: 20,
            machine: { theme, name: `${theme[0].toUpperCase()}${theme.slice(1)} Reels`, lore: 'The four realms turn beneath the lanterns.', mechanic: 'Prepared saved spin for interface review.',
                symbols: ['Seed','Fern','Amber','Roadward','Rootheart','Orun','Living root','Vault key'],
                bonusTitle: 'The archive', bonusChoices: ['Chest','Tablet','Root'], weights: [24,20,16,12,10,8,5,5], pays: Array.from({ length: 6 }, () => [6,16,28]) },
            lines: Array.from({ length: 10 }, () => [1,1,1,1,1]), session: { revision: 1, bet: 20, freeSpins: 0, bonus: false } };
        ui.update(v); leave.onclick = () => ui.update(null); window.__slotReview = { ui, v, sent };
    }, theme);
    await page.getByRole('button', { name: 'Spin · 20 Gold', exact: true }).click();
    await page.evaluate(() => {
        const f = window.__slotReview, grid = Array.from({ length: 5 }, () => [0,2,3]);
        f.ui.update({ ...f.v, balance: 1140, session: { ...f.v.session, revision: 2, last: {
            landed: grid, payout: 160, freeAwarded: 0, bonusPicked: -1, stages: [{ grid, payout: 160, wins: [{ line: 0, count: 5, symbol: 2, payout: 160 }] }] } } });
    });
    await page.getByRole('button', { name: 'Skip reel animation', exact: true }).click();
    await page.evaluate(() => { const f = window.__slotReview; f.ui.update(f.v); });
    expect(await page.evaluate(() => window.__slotReview.ui.view.session.revision)).toBe(2);
    await expect(page.locator('.slot-result')).toContainText('160 Gold returned');
    await expect(page.locator('.slot-result')).toContainText('Net profit: +140');
    await page.screenshot({ path: testInfo.outputPath(`${theme}-slot-result-${width}.png`) });
    await expect(page.locator('.slot-game .casino-celebration')).toBeHidden();
    await page.getByText('Spin breakdown', { exact: true }).click();
    await page.getByRole('button', { name: 'Line 1 · 5 matching · 160 Gold', exact: true }).click();
    await expect(page.locator('.slot-cell.win')).toHaveCount(5);
    expect(await page.locator('.casino-session').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => window.__slotReview.sent)).toEqual([{ action: 'slot_spin', bet: 20, roundRevision: 1 }]);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-slot-lines-${width}.png`) });
    await page.getByRole('button', { name: 'Leave table', exact: true }).click();
    await page.evaluate(() => window.__slotReview.ui.dispose());
});
