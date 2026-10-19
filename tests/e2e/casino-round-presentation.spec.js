import { expect, test } from '@playwright/test';
import { prepareCasinoReview } from './casinoPreparedController.js';

// Presentation and public-projection fixtures; durable outcomes/settlement are
// covered by the Go tests against disposable Mongo, never earned by this setup.
for (const [width,height,textScale] of [[320,740,125],[390,844,125],[844,390,125],[1440,900,100]]) for (const currency of ['gold','ep']) {
    test(`poker separates side-pot returns from net results at ${width}px (${currency}, ${textScale}%)`, async ({ page }, testInfo) => {
        const failures = []; page.on('pageerror', error => failures.push(error.message));
        await page.setViewportSize({ width, height });
        await page.route('**/src/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.route('**/src/analytics/game.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(prepareCasinoReview, { game:'poker', phone:width < 1000, textScale });
        const summary = page.locator('.poker-game .card-table-controls > p[role="status"]');
        for (const multiple of [1,2,3]) {
            const outcome = await page.evaluate(({currency,multiple}) => {
                const f = window.__controllerReview, { c, payload } = f;
                const unit = currency === 'ep' ? 2 : 100, buyIn = unit * 2, payout = unit * multiple;
                const shortContribution = buyIn - payout / 2, tableId = `${currency === 'ep' ? 'vip' : 'public'}-poker`;
                payload.tables[0] = { ...payload.tables[0], id:tableId, currency, floor:currency === 'ep' ? 'vip' : 'public' };
                payload.floor = payload.tables[0].floor; payload.yourSeat.tableId = tableId;
                payload.occupants.forEach(p => { p.tableId = tableId; });
                const members = payload.occupants.slice(0,3).map(p => ({ ...p, buyIn }));
                payload.poker = { ...payload.poker, tableId, currency, tableVersion:String(multiple), phase:'complete',
                    roundId:`side-${currency}-${multiple}`, players:members, balance:1000, minBuyIn:unit, buyInStep:unit,
                    serverNow:new Date().toISOString(), nextRoundAt:new Date(Date.now()+30000).toISOString(),
                    round:{ phase:'complete', revision:10, street:'river', board:[4,17,30,8,9], buttonSeat:0, actions:[], showdown:true,
                        pots:[{amount:shortContribution*3,winners:['guest-2']},{amount:payout,winners:['hero']}],
                        players:members.map((p,i) => ({ ...p, cards:i === 0 ? [13,14] : i === 1 ? [-1,-1] : [15,16],
                            stack:i === 2 ? payout/2 : 0, committed:i === 2 ? shortContribution : buyIn,
                            payout:i === 0 ? payout : i === 1 ? 0 : shortContribution*3+payout/2 })) } };
                f.sounds = []; c.poker.sound = cue => f.sounds.push(cue); c.updateState(payload);
                return { payout, buyIn, unit, currency:currency === 'ep' ? 'EP' : 'Gold' };
            }, {currency,multiple});
            await summary.scrollIntoViewIfNeeded();
            await expect(summary).toBeInViewport({ratio:1});
            await expect(summary).toContainText(`${outcome.payout} ${outcome.currency} returned from your ${outcome.buyIn} ${outcome.currency} buy-in`);
            await expect(summary).toContainText(multiple === 1 ? `Net loss: ${outcome.unit}` : multiple === 2 ? 'No net profit or loss' : `Net profit: +${outcome.unit}`);
            expect(await page.locator('.casino-session').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
            expect(await page.evaluate(() => window.__controllerReview.c.poker.celebration.active)).toBe(multiple === 3);
            expect(await page.evaluate(() => window.__controllerReview.sounds.includes('win'))).toBe(multiple === 3);
            await page.screenshot({path:testInfo.outputPath(`poker-${currency}-return-${multiple}-${width}.png`)});
        }
        expect(await page.evaluate(() => window.__controllerReview.sent)).toEqual([]);
        await page.evaluate(() => { const f=window.__controllerReview; f.c.dispose(); f.ui?.dispose(); });
        expect(failures).toEqual([]);
    });
}

for (const [width,textScale] of [[390,100],[844,100],[1440,100],[390,125],[844,125]]) test(`roulette ball launch, close-up and exact landing at ${width}px (${textScale}%)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await page.route('**/src/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/src/analytics/game.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    // Project the phone preference; actual UIManager loading is covered separately.
    if(textScale>100) await page.evaluate(scale=>{document.body.classList.add('mobile-mode');document.documentElement.style.setProperty('--phone-menu-text-size',`${16*scale/100}px`);},textScale);
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

for (const [width,textScale] of [[390,100],[1440,100],[390,125]]) test(`baccarat deals visible cards with live scores and a bead history at ${width}px (${textScale}%)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/src/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/src/analytics/game.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    // Project the phone preference; actual UIManager loading is covered separately.
    if(textScale>100) await page.evaluate(scale=>{document.body.classList.add('mobile-mode');document.documentElement.style.setProperty('--phone-menu-text-size',`${16*scale/100}px`);},textScale);
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

for (const [width,textScale] of [[390,100],[1440,100],[390,125]]) for (const theme of ['earth', 'water', 'fire', 'air']) test(`${theme} slots show a skippable saved spin and inspectable paylines at ${width}px (${textScale}%)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/src/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/src/analytics/game.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    // Project the phone preference; actual UIManager loading is covered separately.
    if(textScale>100) await page.evaluate(scale=>{document.body.classList.add('mobile-mode');document.documentElement.style.setProperty('--phone-menu-text-size',`${16*scale/100}px`);},textScale);
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
