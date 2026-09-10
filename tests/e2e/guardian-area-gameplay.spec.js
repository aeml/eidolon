import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame } from './helpers.js';
import { backendOriginBrowserArgs, hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000, trace: 'off', screenshot: 'off', video: 'off' });

test('trained Guardian Embrace heals on the server and shows its persistent radius to a late observer', async ({ page, browser, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires the isolated guardian route');
    const credentials=credentialsFromEnvironment();
    const failures=collectBrowserFailures(page,baseURL);
    await loginAndEnterWorld(page,credentials);
    let lastCommandAt=0;
    async function command(value) {
        const delay=Math.max(0,1100-(Date.now()-lastCommandAt));
        if(delay>0) await page.waitForTimeout(delay);
        lastCommandAt=Date.now();
        await page.locator('#chat-mobile-toggle').tap();
        await page.locator('#chat-input').fill(value); await page.locator('#chat-input').press('Enter');
        await page.locator('#chat-mobile-toggle').tap();
    }
    // Disposable functional preparation only; all talents and casts use normal UI.
    await command('/level 100');
    await expect.poll(()=>page.evaluate(()=>window.game.player.level)).toBe(100);
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button',{name:'Skills',exact:true}).tap();
    const branch=page.locator('[data-build-action="branch:A"]'); await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(()=>page.evaluate(()=>window.game.player.hotbar.indexOf('Guardian Embrace'))).toBeGreaterThanOrEqual(0);
    await page.locator('#btn-close-skills').tap();
    await page.evaluate(()=>{
        const game=window.game,receive=game.handleServerMessage.bind(game);
        window.__guardianArea={casts:[],heals:[]};
        game.handleServerMessage=message=>{
            const result=receive(message);
            if(message.type==='ability' && message.payload?.sourceId===game.player.id && message.payload.skillName==='Guardian Embrace') window.__guardianArea.casts.push(message.payload);
            if(message.type==='heal' && message.payload?.sourceId===game.player.id && message.payload.targetId===game.player.id && message.payload.kind==='guardian_embrace') window.__guardianArea.heals.push(message.payload.amount);
            return result;
        };
    });
    async function cast(rank,quality) {
        await expect.poll(()=>page.evaluate(()=>Boolean(window.game.player.guardianEmbraceActive)),{timeout:15_000}).toBe(false);
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality); await page.locator('#btn-close-settings').tap();
        if(await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        const sequence=await page.evaluate(()=>window.game.animationQAReadySequence||0);
        await command('/qa-animation-ready low-health');
        await expect.poll(()=>page.evaluate(()=>window.game.animationQAReadySequence||0)).toBeGreaterThan(sequence);
        const before=await page.evaluate(()=>{
            window.__guardianArea={casts:[],heals:[]};
            const p=window.game.player;
            return {slot:p.hotbar.indexOf('Guardian Embrace'),rank:p.talentRanks?.CLR_34||0,wisdom:p.stats.wisdom,equipment:p.stats.healingDoneBonus||0,missing:p.stats.maxHp-p.stats.hp};
        });
        expect(before.rank).toBe(rank);
        const expectedHeal=Math.floor((20+2*before.wisdom)*(1+before.equipment));
        expect(before.missing).toBeGreaterThan(expectedHeal);
        await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
        await expect.poll(()=>page.evaluate(()=>window.__guardianArea.casts.length)).toBe(1);
        expect(await page.evaluate(()=>window.__guardianArea.casts[0].radius)).toBeCloseTo(rank?11.5:10,8);
        await expect.poll(()=>page.evaluate(()=>window.game.player.attachedStatusEffects.get('guardian_embrace')?.group.userData.gameplayRadius)).toBe(rank?11.5:10);
        await expect.poll(()=>page.evaluate(()=>window.__guardianArea.heals.length)).toBeGreaterThan(0);
        expect(await page.evaluate(()=>window.__guardianArea.heals[0])).toBe(expectedHeal);
        await page.screenshot({path:testInfo.outputPath(`guardian-${rank}-${quality}.png`)});
        console.log(`[guardian-area] rank ${rank}, ${quality}: accepted/persistent radius ${rank?11.5:10}, real heal ${expectedHeal}`);
    }
    await cast(0,'high');
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button',{name:'Talents',exact:true}).tap();
    for(let rank=1;rank<=5;rank++) {
        const buy=page.locator('button[data-build-action="talent:CLR_34"]'); await buy.scrollIntoViewIfNeeded(); await buy.tap();
        await expect.poll(()=>page.evaluate(()=>window.game.player.talentRanks?.CLR_34||0)).toBe(rank);
        await expect.poll(()=>page.evaluate(()=>window.game.uiManager.skillTree.mobile.pending===null)).toBe(true);
    }
    await page.locator('#btn-close-skills').tap();
    await cast(5,'low');

    // A separate Chrome process avoids starving two WebGL loops on one GPU
    // scheduler. This observer connects only after the next aura is cast, so
    // its active geometry must arrive in state, not the missed cast event.
    const secondBrowser=await browser.browserType().launch({executablePath:process.env.EIDOLON_E2E_BROWSER_PATH||undefined,
        headless:process.env.EIDOLON_E2E_HEADLESS!=='0',args:[...hardwareWebGLBrowserArgs(),...backendOriginBrowserArgs(process.env.EIDOLON_E2E_BACKEND_ORIGIN_IP)]});
    try {
        const observerContext=await secondBrowser.newContext({ baseURL });
        const observer=await observerContext.newPage();
        const observerFailures=collectBrowserFailures(observer,baseURL);
        // Finish the normal bounded runtime warm-up before starting the short
        // aura. A raw extra navigation bypassed readiness/recovery handling.
        await openGame(observer);
        const sourceId=await page.evaluate(()=>window.game.player.id);
        await cast(5,'high');
        await loginAndEnterWorld(observer,{...credentials,username:`${credentials.username}-view`});
        await expect.poll(()=>observer.evaluate(id=>window.game.remotePlayers.get(id)?.attachedStatusEffects.get('guardian_embrace')?.group.userData.gameplayRadius,sourceId)).toBe(11.5);
        const remote=await observer.evaluate(id=>{const p=window.game.remotePlayers.get(id);return {ranks:p.talentRanks||{},duration:p.guardianEmbraceTimer,attached:p.attachedStatusEffects.get('guardian_embrace').group.parent===window.game.renderSystem.effectGroup};},sourceId);
        expect(remote.ranks).toEqual({});
        expect(remote.duration).toBeGreaterThan(0); expect(remote.duration).toBeLessThan(10); expect(remote.attached).toBe(true);
        await expect.poll(()=>observer.evaluate(id=>window.game.remotePlayers.get(id)?.attachedStatusEffects.has('guardian_embrace'),sourceId),{timeout:15_000}).toBe(false);
        expect(observerFailures,observerFailures.join('\n')).toEqual([]);
        console.log('[guardian-area] late rank-private observer received persistent radius and watched normal expiry');
    } finally { await secondBrowser.close(); }
    await loginAndEnterWorld(page,credentials);
    expect(await page.evaluate(()=>window.game.player.talentRanks?.CLR_34)).toBe(5);
    expect(failures,failures.join('\n')).toEqual([]);
});
