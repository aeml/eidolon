import { expect, test } from '@playwright/test';
import { prepareCasinoReview } from './casinoPreparedController.js';

// The whole message remains readable in its owned controls scroller.
async function expectHouseWinReadable(page, testInfo, label) {
    const win=page.locator('.house-game .casino-celebration');
    await expect(win).toBeVisible(); await expect(win).toHaveCSS('opacity','1');
    await win.scrollIntoViewIfNeeded();
    await testInfo.attach(`${label}-win-bounds`,{body:Buffer.from(JSON.stringify(await win.evaluate(n=>{
        const r=n.getBoundingClientRect(),parent=n.parentElement,p=parent.getBoundingClientRect();
        return {win:{top:r.top,bottom:r.bottom,height:r.height},controls:{top:p.top,bottom:p.bottom,clientHeight:parent.clientHeight,scrollHeight:parent.scrollHeight,scrollTop:parent.scrollTop}};
    }))),contentType:'application/json'});
    await expect(win).toBeInViewport({ratio:1});
    const geometry=await win.evaluate(n=>{
        const bounds=n.getBoundingClientRect(),regions=[...n.querySelectorAll('h3,strong,p')].map(e=>{
            const r=e.getBoundingClientRect();return {text:e.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
                horizontalOverflow:e.scrollWidth-e.clientWidth,verticalOverflow:e.scrollHeight-e.clientHeight};
        }),clipped=[],overlaps=[],blocked=[];
        for(const r of regions) {
            if(r.left < bounds.left-1 || r.right > bounds.right+1 || r.top < bounds.top-1 || r.bottom > bounds.bottom+1 ||
                r.horizontalOverflow > 1 || r.verticalOverflow > 1) clipped.push(r);
            for(const x of [.2,.5,.8]) for(const y of [.2,.5,.8]) {
                const hit=document.elementFromPoint(r.left+(r.right-r.left)*x,r.top+(r.bottom-r.top)*y);
                if(!n.contains(hit)) blocked.push({text:r.text,element:hit?.className});
            }
        }
        for(let i=0;i<regions.length;i++) for(let j=i+1;j<regions.length;j++) {
            const a=regions[i],b=regions[j];
            if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1) overlaps.push([a,b]);
        }
        return {regions,clipped,overlaps,blocked};
    });
    await testInfo.attach(`${label}-win-geometry`,{body:Buffer.from(JSON.stringify(geometry)),contentType:'application/json'});
    expect(geometry.clipped).toEqual([]); expect(geometry.overlaps).toEqual([]); expect(geometry.blocked).toEqual([]);
    return win;
}

// Presentation and public-projection fixtures; durable outcomes/settlement are
// covered by the Go tests against disposable Mongo, never earned by this setup.
for (const [width,height,textScale] of [[320,740,125],[390,844,125],[844,390,125],[1440,900,100]]) {
    test(`roulette clock stays uncovered and its spin fills the table at ${width}px (${textScale}%)`,async({page},testInfo)=>{
        const failures=[];page.on('pageerror',error=>failures.push(error.message));
        await page.setViewportSize({width,height});
        await page.route('**/src/main.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
        await page.route('**/src/analytics/game.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
        await page.goto('/',{waitUntil:'networkidle'});
        await page.evaluate(prepareCasinoReview,{game:'roulette',phone:width < 1000,textScale});
        await page.evaluate(()=>{
            const f=window.__controllerReview;
            f.payload.house={...f.payload.house,tableVersion:'2',balance:999980,
                players:f.payload.occupants.map(p=>({...p,wagers:[{spot:'red',amount:20}],paid:false,payout:0}))};
            f.c.updateState(f.payload);
        });
        await expect(page.locator('.house-game .card-table-dealer')).toBeVisible();
        const clock=page.locator('.house-game .card-table-clock');
        const checkClock=async phase=>{
            await clock.scrollIntoViewIfNeeded();await expect(clock).toBeInViewport({ratio:1});
            const blockers=await clock.evaluate(n=>{
                const labels=[...n.querySelectorAll('strong,span')].filter(e=>{const r=e.getBoundingClientRect();return r.width>4&&r.height>4;});
                if(!labels.length)return [{text:'No visible clock contents'}];
                const hits=[];
                for(const label of labels){const r=label.getBoundingClientRect();
                    for(const x of [.2,.5,.8])for(const y of [.2,.5,.8]){
                        const hit=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y);
                        if(!n.contains(hit))hits.push({x,y,element:hit?.className,text:hit?.textContent?.slice(0,80)});
                    }
                }
                return hits;
            });
            await testInfo.attach(`roulette-${phase}-clock`,{body:Buffer.from(JSON.stringify(blockers)),contentType:'application/json'});
            expect(blockers).toEqual([]);
        };
        await checkClock('betting');
        const bowl=page.locator('.roulette-bowl'),before=await bowl.boundingBox();
        await page.evaluate(()=>{
            const f=window.__controllerReview;
            f.payload.house={...f.payload.house,tableVersion:'3',phase:'revealing',serverNow:new Date().toISOString(),revealAt:new Date(Date.now()+6000).toISOString()};
            f.c.updateState(f.payload);
        });
        await expect(page.locator('.roulette-theatre')).toHaveClass(/close-up/);
        await page.waitForTimeout(600);
        const spinning=await bowl.boundingBox();
        expect(spinning.width).toBeGreaterThanOrEqual(Math.min(180,height/3));
        expect(spinning.width).toBeGreaterThan(before.width*1.2);
        await expect(bowl).toBeInViewport({ratio:1});
        await expect(page.locator('.roulette-ball-track')).toBeVisible();
        await expect(page.getByRole('button',{name:'Skip animation',exact:true})).toBeInViewport({ratio:1});
        await checkClock('spinning');
        await page.screenshot({path:testInfo.outputPath(`roulette-controller-spin-${width}.png`)});
        await page.evaluate(()=>{
            const f=window.__controllerReview;
            f.payload.house={...f.payload.house,tableVersion:'4',phase:'settling',number:32};f.c.updateState(f.payload);
        });
        await checkClock('saving');
        await page.evaluate(()=>{
            const f=window.__controllerReview;
            f.payload.house={...f.payload.house,tableVersion:'5',phase:'complete',balance:1000020,
                serverNow:new Date().toISOString(),nextRoundAt:new Date(Date.now()+12000).toISOString(),
                players:f.payload.house.players.map(p=>({...p,paid:true,payout:40}))};f.c.updateState(f.payload);
        });
        await expect(page.locator('.roulette-theatre')).toHaveClass(/close-up/);
        await expect(page.locator('.house-game .casino-celebration')).toBeHidden();
        await expect(page.locator('.roulette-theatre')).not.toHaveClass(/close-up/);
        await expect(page.locator('.roulette-outcome')).toHaveText('32 · Red');
        await expect(await expectHouseWinReadable(page,testInfo,'roulette-landed')).toContainText('+20 Gold');
        await checkClock('next');
        // A legal next round can pay the maximum straight-up stake. Keep the
        // largest return/profit labels readable as well as the small win.
        await page.evaluate(()=>{
            const f=window.__controllerReview;
            f.payload.house={...f.payload.house,tableVersion:'20',roundId:'large-readability',phase:'complete',balance:4500020,
                serverNow:new Date().toISOString(),nextRoundAt:new Date(Date.now()+12000).toISOString(),
                players:f.payload.occupants.map(p=>({...p,wagers:[{spot:'number:32',amount:100000}],paid:true,payout:3600000}))};f.c.updateState(f.payload);
        });
        await expect(await expectHouseWinReadable(page,testInfo,'roulette-large')).toContainText('+3,500,000 Gold');
        await bowl.scrollIntoViewIfNeeded();await expect(bowl).toBeInViewport({ratio:1});
        expect(await bowl.evaluate(n=>{
            const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return n.contains(hit);
        })).toBe(true);
        await checkClock('large-next');
        await page.screenshot({path:testInfo.outputPath(`roulette-win-${width}.png`)});
        expect(await page.locator('.casino-session').evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(()=>window.__controllerReview.sent)).toEqual([]);
        await page.evaluate(()=>{const f=window.__controllerReview;f.c.dispose();f.ui?.dispose();});
        expect(failures).toEqual([]);
    });
}

for (const [width,height,textScale] of [[320,740,125],[390,844,125],[844,390,125],[1440,900,100]]) {
    test(`baccarat seats, cards and clock stay distinct at ${width}px (${textScale}%)`, async ({ page }, testInfo) => {
        const failures = []; page.on('pageerror', error => failures.push(error.message));
        await page.setViewportSize({width,height});
        await page.route('**/src/main.js', r => r.fulfill({contentType:'text/javascript',body:''}));
        await page.route('**/src/analytics/game.js', r => r.fulfill({contentType:'text/javascript',body:''}));
        await page.goto('/', {waitUntil:'networkidle'});
        await page.evaluate(prepareCasinoReview, {game:'baccarat',phone:width < 1000,textScale});
        for (const [revision,phase] of ['betting','revealing','complete'].entries()) {
            await page.evaluate(({phase,revision}) => {
                const f=window.__controllerReview, {c,payload}=f;
                payload.occupants=payload.occupants.map(p=>({...p,connected:!(phase === 'revealing' && p.seat === 2)}));
                const v={...payload.house,phase,tableVersion:String(revision+2),serverNow:new Date().toISOString(),
                    players:payload.occupants.map(p=>({...p,wagers:[{spot:'player',amount:20}],paid:phase === 'complete',payout:0})),
                    revealAt:new Date(Date.now()+6000).toISOString(),nextRoundAt:new Date(Date.now()+30000).toISOString()};
                if (phase === 'revealing') v.dealt={player:[0,3,1],banker:[9,2]};
                if (phase === 'complete') v.baccarat={player:[0,3,1],banker:[9,2,4],playerTotal:7,bankerTotal:8,winner:'banker'};
                payload.house=v; c.updateState(payload); c.house.table.root.scrollTop=0;
            }, {phase,revision});
            await expect(page.locator('.house-game .card-table-dealer')).toBeVisible();
            // Inspect settled layout after the intended card arrival motion.
            await page.waitForTimeout(450);
            const geometry=await page.evaluate(() => {
                const root=window.__controllerReview.c.house.table.root, bounds=root.getBoundingClientRect();
                const regions=[...root.querySelectorAll('.casino-table-ribbon,.card-table-dealer,.baccarat-result-hand,.baccarat-outcome,.card-table-clock,.card-table-seat')]
                    .filter(n=>getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0)
                    .map(n=>{const r=n.getBoundingClientRect();return {kind:n.className,seat:n.dataset.position,left:r.left,top:r.top,right:r.right,bottom:r.bottom};});
                const overlaps=[];
                for(let i=0;i<regions.length;i++) for(let j=i+1;j<regions.length;j++) {
                    const a=regions[i],b=regions[j];
                    if(Math.min(a.right,b.right)-Math.max(a.left,b.left) > 1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top) > 1) overlaps.push([a,b]);
                }
                const clippedFaces=[];
                for(const card of root.querySelectorAll('.baccarat-cards .casino-card:not(.back)')) {
                    const c=card.getBoundingClientRect(), h=card.closest('.baccarat-result-hand').getBoundingClientRect();
                    const index=card.querySelector('.casino-card-index').getBoundingClientRect(), pip=card.querySelector('.casino-card-pip').getBoundingClientRect();
                    const overlap=Math.min(index.right,pip.right)-Math.max(index.left,pip.left) > 1 && Math.min(index.bottom,pip.bottom)-Math.max(index.top,pip.top) > 1;
                    if(c.left < h.left-1 || c.right > h.right+1 || index.right > c.right+1 || index.left < c.left-1 ||
                        index.top < c.top-1 || index.bottom > c.bottom+1 || pip.bottom > c.bottom+1 || pip.top < c.top-1 ||
                        pip.left < c.left-1 || pip.right > c.right+1 || overlap) clippedFaces.push(card.getAttribute('aria-label'));
                }
                const center=root.querySelector('.card-table-center'),cs=getComputedStyle(center),rs=getComputedStyle(root);
                const cr=center.getBoundingClientRect();
                return {regions,overlaps,clippedFaces,layout:{display:rs.display,rows:rs.gridTemplateRows,
                    center:{top:cr.top,bottom:cr.bottom,height:cs.height,position:cs.position,transform:cs.transform,inset:cs.inset,containerType:cs.containerType,alignSelf:cs.alignSelf}},bounds:{left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom},
                    scrollHeight:root.scrollHeight,clientHeight:root.clientHeight,horizontalOverflow:root.scrollWidth-root.clientWidth};
            });
            await testInfo.attach(`baccarat-${phase}-geometry`,{body:Buffer.from(JSON.stringify(geometry,null,2)),contentType:'application/json'});
            await page.screenshot({path:testInfo.outputPath(`baccarat-spacing-${phase}-${width}.png`)});
            expect(geometry.overlaps).toEqual([]);
            expect(geometry.clippedFaces).toEqual([]);
            expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
            for(const r of geometry.regions) {
                expect(r.left).toBeGreaterThanOrEqual(geometry.bounds.left-1);
                expect(r.right).toBeLessThanOrEqual(geometry.bounds.right+1);
                expect(r.top).toBeGreaterThanOrEqual(geometry.bounds.top-1);
                expect(r.bottom).toBeLessThanOrEqual(geometry.bounds.top+geometry.scrollHeight+1);
            }
            for(const selector of ['.card-table-clock','.baccarat-result-hand.player','.baccarat-result-hand.banker','.baccarat-outcome',
                ...Array.from({length:6},(_,i)=>`.card-table-seat[data-position="${i}"] .card-table-seat-name`)]) {
                const region=page.locator(`.house-game ${selector}`); await region.scrollIntoViewIfNeeded();
                if(selector === '.card-table-clock') await testInfo.attach(`baccarat-${phase}-clock-scroll`,{body:Buffer.from(JSON.stringify(await region.evaluate(n=>{
                    const parents=[];for(let a=n;a;a=a.parentElement){const r=a.getBoundingClientRect(),s=getComputedStyle(a);parents.push({kind:a.className,top:r.top,bottom:r.bottom,scrollTop:a.scrollTop,clientHeight:a.clientHeight,scrollHeight:a.scrollHeight,overflow:s.overflow,scrollMargin:s.scrollMargin});}return parents;
                }))),contentType:'application/json'});
                await expect(region).toBeInViewport({ratio:1});
            }
            if(phase === 'revealing') {
                const warning=page.locator('.house-game .card-table-seat[data-seat="2"] .card-table-seat-status');
                await expect(warning).toHaveText('Reconnecting');await warning.scrollIntoViewIfNeeded();
                await expect(warning).toBeInViewport({ratio:1});
                expect(await warning.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
            }
            await expect(page.locator('.baccarat-theatre [data-card]')).toHaveCount(phase === 'betting' ? 0 : phase === 'revealing' ? 5 : 6);
        }
        await page.evaluate(()=>{
            const f=window.__controllerReview;
            f.payload.house={...f.payload.house,tableVersion:'20',roundId:'banker-win-review',balance:1019,
                serverNow:new Date().toISOString(),nextRoundAt:new Date(Date.now()+12000).toISOString(),
                players:f.payload.occupants.map(p=>({...p,wagers:[{spot:'banker',amount:20}],paid:true,payout:39}))};f.c.updateState(f.payload);
        });
        await expect(await expectHouseWinReadable(page,testInfo,'baccarat')).toContainText('+19 Gold');
        for(const card of await page.locator('.baccarat-theatre [data-card]').all()) {
            await card.scrollIntoViewIfNeeded();await expect(card).toBeInViewport({ratio:1});
            expect(await card.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})).toBe(true);
        }
        const resultClock=page.locator('.house-game .card-table-clock');await resultClock.scrollIntoViewIfNeeded();
        await expect(resultClock).toBeInViewport({ratio:1});
        await page.screenshot({path:testInfo.outputPath(`baccarat-win-${width}.png`)});
        expect(await page.evaluate(()=>window.__controllerReview.sent)).toEqual([]);
        await page.evaluate(()=>{const f=window.__controllerReview;f.c.dispose();f.ui?.dispose();});
        expect(failures).toEqual([]);
    });
}

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
                const unit = currency === 'ep' ? 10 : 100, buyIn = unit * (multiple === 2 ? 2 : 3);
                const shortContribution = unit * (multiple === 1 ? 2 : 1), payout=2*(buyIn-shortContribution);
                const tableId = `${currency === 'ep' ? 'vip' : 'public'}-poker`;
                payload.tables[0] = { ...payload.tables[0], id:tableId, currency, floor:currency === 'ep' ? 'vip' : 'public' };
                payload.floor = payload.tables[0].floor; payload.yourSeat.tableId = tableId;
                payload.occupants.forEach(p => { p.tableId = tableId; });
                const members = payload.occupants.slice(0,3).map((p,i) => ({ ...p,buyIn:i === 2 ? shortContribution : buyIn }));
                payload.poker = { ...payload.poker, tableId, currency, tableVersion:String(multiple), phase:'complete',
                    roundId:`side-${currency}-${multiple}`, players:members, balance:1000-buyIn+payout, minBuyIn:unit, buyInStep:unit, maxBuyIn:currency === 'ep' ? 100 : 100000,
                    smallBlind:currency === 'ep' ? 1 : 5,bigBlind:currency === 'ep' ? 2 : 10,
                    serverNow:new Date().toISOString(), nextRoundAt:new Date(Date.now()+30000).toISOString(),
                    round:{ phase:'complete', revision:10, street:'river', board:[1,16,4,47,36], buttonSeat:0, actions:[], showdown:true,
                        pots:[{amount:shortContribution*3,winners:['guest-2']},{amount:payout,winners:['hero']}],
                        players:members.map((p,i) => ({ ...p,cards:i === 0 ? [12,25] : i === 1 ? [11,24] : [0,13],
                            stack:0,streetBet:0,committed:p.buyIn,payout:i === 0 ? payout : i === 1 ? 0 : shortContribution*3 })) } };
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
