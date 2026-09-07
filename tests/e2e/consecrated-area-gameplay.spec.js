import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true,userAgent:devices['Pixel 7'].userAgent,
    actionTimeout:12_000,trace:'off',screenshot:'off',video:'off'});

test('holy ground training and its expanded rune match the persistent server zone',async({page,baseURL},testInfo)=>{
    test.setTimeout(180_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER!=='1','Requires isolated holy-ground route');
    const credentials=credentialsFromEnvironment(),failures=collectBrowserFailures(page,baseURL);
    await loginAndEnterWorld(page,credentials);
    let lastCommandAt=0;
    async function command(value) {
        const delay=Math.max(0,1100-(Date.now()-lastCommandAt)); if(delay>0) await page.waitForTimeout(delay);
        lastCommandAt=Date.now();
        await page.locator('#chat-mobile-toggle').tap();
        await page.locator('#chat-input').fill(value); await page.locator('#chat-input').press('Enter');
        await page.locator('#chat-mobile-toggle').tap();
    }
    async function build(tab) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
        await page.locator('.phone-build-tabs').getByRole('button',{name:tab,exact:true}).tap();
    }
    await command('/level 100');
    await expect.poll(()=>page.evaluate(()=>window.game.player.level)).toBe(100);
    await build('Skills');
    const branch=page.locator('[data-build-action="branch:B"]'); await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(()=>page.evaluate(()=>window.game.player.hotbar.indexOf('Consecrated Ground'))).toBeGreaterThanOrEqual(0);
    await page.locator('#btn-close-skills').tap();
    await page.evaluate(()=>{
        const g=window.game,receive=g.handleServerMessage.bind(g);
        window.__holyArea={casts:[],heals:[]};
        g.handleServerMessage=message=>{
            const result=receive(message),p=message.payload;
            if(message.type==='ability'&&p?.sourceId===g.player.id&&p.skillName==='Consecrated Ground') window.__holyArea.casts.push(p);
            if(message.type==='heal'&&p?.sourceId===g.player.id&&p.targetId===g.player.id&&p.kind==='consecration') window.__holyArea.heals.push(p.amount);
            return result;
        };
    });
    async function cast(radius,quality,label) {
        await expect.poll(()=>page.evaluate(()=>[...window.game.remotePlayers.values()].filter(e=>e.type==='ZoneHoly'&&e.owner?.id===window.game.player.id).length),{timeout:20_000}).toBe(0);
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality); await page.locator('#btn-close-settings').tap();
        if(await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        const sequence=await page.evaluate(()=>window.game.animationQAReadySequence||0);
        await command('/qa-animation-ready low-health');
        await expect.poll(()=>page.evaluate(()=>window.game.animationQAReadySequence||0)).toBeGreaterThan(sequence);
        const before=await page.evaluate(()=>{
            window.__holyArea={casts:[],heals:[]}; const p=window.game.player;
            return {slot:p.hotbar.indexOf('Consecrated Ground'),wisdom:p.stats.wisdom,equipment:p.stats.healingDoneBonus||0};
        });
        await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
        await expect.poll(()=>page.evaluate(()=>window.__holyArea.casts.length)).toBe(1);
        expect(await page.evaluate(()=>window.__holyArea.casts[0].radius)).toBeCloseTo(radius,8);
        await expect.poll(()=>page.evaluate(()=>[...window.game.remotePlayers.values()].find(e=>e.type==='ZoneHoly'&&e.owner?.id===window.game.player.id)?.mesh.userData.gameplayRadius)).toBeCloseTo(radius,5);
        await expect.poll(()=>page.evaluate(()=>window.__holyArea.heals.length)).toBeGreaterThan(0);
        const healing=Math.floor((15+Math.floor(before.wisdom/2))*(1+before.equipment));
        expect(await page.evaluate(()=>window.__holyArea.heals[0])).toBe(healing);
        await page.screenshot({path:testInfo.outputPath(`holy-${label}-${quality}.png`)});
        console.log(`[holy-area] ${label}/${quality}: accepted and persistent radius ${radius}, actual heal ${healing}`);
    }
    await cast(5,'high','baseline');
    await build('Talents');
    for(let rank=1;rank<=5;rank++) {
        const buy=page.locator('button[data-build-action="talent:CLR_34"]'); await buy.scrollIntoViewIfNeeded(); await buy.tap();
        await expect.poll(()=>page.evaluate(()=>window.game.player.talentRanks?.CLR_34||0)).toBe(rank);
        await expect.poll(()=>page.evaluate(()=>window.game.uiManager.skillTree.mobile.pending===null)).toBe(true);
    }
    await page.locator('#btn-close-skills').tap();
    await cast(5.75,'low','trained');
    await build('Runes'); await page.locator('#phone-rune-skill').selectOption('Consecrated Ground');
    const expanded=page.locator('[data-build-action="rune:consecratedground_expanded"]'); await expanded.scrollIntoViewIfNeeded(); await expanded.tap();
    await expect.poll(()=>page.evaluate(()=>window.game.player.skillRunes?.['Consecrated Ground'])).toBe('consecratedground_expanded');
    await page.locator('#btn-close-skills').tap();
    await cast(8.625,'high','expanded');
    await page.reload({waitUntil:'networkidle'}); await loginAndEnterWorld(page,credentials);
    expect(await page.evaluate(()=>window.game.player.talentRanks?.CLR_34)).toBe(5);
    expect(await page.evaluate(()=>window.game.player.skillRunes?.['Consecrated Ground'])).toBe('consecratedground_expanded');
    expect(failures,failures.join('\n')).toEqual([]);
});
