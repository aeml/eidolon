import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { prepareCasinoReview } from './casinoPreparedController.js';

// Prepared controller/DOM integration, not earned play or native venue art.
for (const [width, height] of [[320,740],[390,844],[844,390],[1440,900]]) for (const game of ['roulette','baccarat','blackjack','poker','slots']) {
    test(`${game} real controller panel and history at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width, height });
        await page.route('**/src/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.route('**/src/analytics/game.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(prepareCasinoReview,{game});
        const panel=page.locator('.casino-session');
        await expect(panel.getByRole('button',{name:'Leave table',exact:true})).toBeVisible();
        await expect(panel.getByRole('button',{name:'Take a break',exact:true})).toBeVisible();
        const bounds = await panel.boundingBox();
        expect(bounds.width).toBeGreaterThan(width * .85); expect(bounds.height).toBeGreaterThan(height * .85);
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width); expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        await expect(panel.locator('details')).toHaveCount(0);
        if (game==='blackjack') {
            await expect(panel.locator('.card-table-seat .casino-hand-value')).toHaveCount(6);
            expect(await panel.locator('.card-table-seat .casino-hand-value').evaluateAll(values=>values.flatMap(n=>{
                const r=n.getBoundingClientRect(),clip=n.closest('.card-table-seat-hands').getBoundingClientRect();
                return r.top>=clip.top-1&&r.bottom<=clip.bottom+1?[]:[{value:n.textContent,top:r.top,bottom:r.bottom,clipTop:clip.top,clipBottom:clip.bottom}];
            }))).toEqual([]);
        }
        if (['roulette','baccarat'].includes(game)) await page.locator('.casino-history').scrollIntoViewIfNeeded();
        if (game==='slots') {
            await expect(panel.getByRole('button',{name:'Spin · 20 Gold',exact:true})).toBeVisible();
            const grid=await panel.locator('.slot-grid').boundingBox(), stage=await panel.locator('.slot-stage').boundingBox();
            expect(grid.height).toBeGreaterThan(100);
            expect(grid.y + grid.height).toBeLessThanOrEqual(stage.y + stage.height);
            expect(await panel.locator('.slot-cell img').evaluateAll(icons=>icons.every(n=>{
                const r=n.getBoundingClientRect();return r.width>20&&r.height>20;
            }))).toBe(true);
        }
        expect(await panel.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
        if(game==='roulette') await expect.poll(()=>page.locator('.casino-history ol').evaluate(n=>n.scrollWidth-n.clientWidth-n.scrollLeft)).toBeLessThanOrEqual(2);
        await page.screenshot({path:testInfo.outputPath(`controller-${game}-${width}.png`)});
        await panel.getByRole('button',{name:'Play options',exact:true}).click();
        const options=page.getByRole('dialog',{name:'Play-time controls',exact:true});
        await expect(options.getByRole('button',{name:'Apply time limit',exact:true})).toBeVisible();
        await options.getByRole('button',{name:'Close popup',exact:true}).click();
        await panel.locator('.casino-session-header').getByRole('button',{name:'Rules',exact:true}).click();
        const rulesName={roulette:'Roulette rules',baccarat:'Baccarat rules',blackjack:'Blackjack rules',poker:'Hold’em rules',slots:'Slot rules and paylines'}[game];
        const rules=page.getByRole('dialog',{name:rulesName,exact:true});
        await expect(rules).toBeVisible();
        const popupBounds=await rules.boundingBox();
        expect(popupBounds.y).toBeGreaterThanOrEqual(0); expect(popupBounds.y+popupBounds.height).toBeLessThanOrEqual(height);
        expect(await rules.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
        await page.screenshot({path:testInfo.outputPath(`rules-${game}-${width}.png`)});
        if (width>=960) {
            const h=await rules.locator('h2').boundingBox();
            await page.mouse.move(h.x+10,h.y+10); await page.mouse.down(); await page.mouse.move(h.x+46,h.y+20,{steps:5}); await page.mouse.up();
            expect((await rules.boundingBox()).x).toBeGreaterThan(popupBounds.x+20);
            expect((await panel.boundingBox()).x).toBeCloseTo(bounds.x,0);
        }
        await page.keyboard.press('Escape');
        expect(await page.evaluate(()=>window.__controllerReview.sent)).toEqual([]);
        if (width>=960) {
            const header=panel.locator('.casino-session-header h2'), before=await panel.boundingBox(), h=await header.boundingBox();
            await page.mouse.move(h.x+10,h.y+10); await page.mouse.down(); await page.mouse.move(h.x+46,h.y+30,{steps:5}); await page.mouse.up();
            const after=await panel.boundingBox(); expect(after.x).toBeGreaterThan(before.x+20);
            await page.evaluate(()=>{const f=window.__controllerReview;f.c.updateState({...f.payload,yourSeat:null});f.c.updateState(f.payload);});
            expect((await panel.boundingBox()).x).toBeCloseTo(after.x,0);
        } else {
            const before=await panel.boundingBox(), h=await panel.locator('.casino-session-header h2').boundingBox();
            await page.mouse.move(h.x+4,h.y+8);await page.mouse.down();await page.mouse.move(h.x+4,h.y+22,{steps:5});await page.mouse.up();
            expect((await panel.boundingBox()).y).toBeGreaterThan(before.y+5);
        }
        if (game==='slots') {
            await panel.getByRole('button',{name:'Auto',exact:true}).click();
            const auto=page.getByRole('dialog',{name:'Auto spins',exact:true});
            await expect(auto).toContainText('1,000 Gold in total stakes');
            await auto.getByRole('button',{name:'Close popup',exact:true}).click();
            await panel.getByRole('button',{name:'Manual',exact:true}).click();
            expect(await page.evaluate(()=>window.__controllerReview.sent)).toEqual([]);
            await page.evaluate(()=>{
                const f=window.__controllerReview;
                f.payload.slots={...f.payload.slots,session:{revision:2,bet:20,bonus:true,freeSpins:4}};
                f.c.updateState(f.payload);
            });
            const bonus=panel.locator('.slot-bonus');
            await expect(bonus).toBeVisible();
            await bonus.getByRole('button',{name:'Chest',exact:true}).click();
            await page.screenshot({path:testInfo.outputPath(`bonus-slots-${width}.png`)});
        }
        await panel.getByRole('button',{name:'Leave table',exact:true}).click();
        expect(await page.evaluate(()=>window.__controllerReview.sent.map(x=>x.payload.action))).toEqual(game==='slots'?['slot_bonus','leave']:['leave']);
        await page.evaluate(()=>window.__controllerReview.c.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
