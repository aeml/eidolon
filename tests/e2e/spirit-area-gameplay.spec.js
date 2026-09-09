import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame } from './helpers.js';
import { backendOriginBrowserArgs, hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';

test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true,userAgent:devices['Pixel 7'].userAgent,
    actionTimeout:12_000,trace:'off',screenshot:'off',video:'off'});
test('trained spirit rings preserve cherubs and reach a late observer without private ranks',async({page,browser,baseURL},testInfo)=>{
    test.setTimeout(240_000);test.skip(process.env.EIDOLON_E2E_REGISTER!=='1','Requires isolated spirit route');
    const credentials=credentialsFromEnvironment(),failures=collectBrowserFailures(page,baseURL);
    await loginAndEnterWorld(page,credentials);let lastCommandAt=0;
    async function command(value){
        const delay=Math.max(0,1100-(Date.now()-lastCommandAt));if(delay>0)await page.waitForTimeout(delay);lastCommandAt=Date.now();
        await page.locator('#chat-mobile-toggle').tap();await page.locator('#chat-input').fill(value);
        await page.locator('#chat-input').press('Enter');await page.locator('#chat-mobile-toggle').tap();
    }
    async function build(tab){
        await page.locator('#btn-mobile-menu').tap();await page.locator('#btn-phone-skills').tap();
        await page.locator('.phone-build-tabs').getByRole('button',{name:tab,exact:true}).tap();
    }
    await command('/level 100');await expect.poll(()=>page.evaluate(()=>window.game.player.level)).toBe(100);
    await build('Skills');const branch=page.locator('[data-build-action="branch:B"]');await branch.scrollIntoViewIfNeeded();await branch.tap();
    await expect.poll(()=>page.evaluate(()=>window.game.player.hotbar.indexOf('Spirit Guardians Boost'))).toBeGreaterThanOrEqual(0);
    await page.locator('#btn-close-skills').tap();
    // A normal level event must not leave a permanent notice over the world.
    await expect(page.locator('#combat-intent-panel')).toBeHidden({timeout:6000});
    expect((await page.locator('#objectives-panel').boundingBox()).height).toBeLessThanOrEqual(52);
    await page.locator('#objectives-panel').getByRole('button',{name:/^Open journal:/}).tap();
    await expect(page.locator('#quest-journal')).toBeVisible();
    await page.locator('#btn-close-journal').tap();
    await page.evaluate(()=>{
        const g=window.game,receive=g.handleServerMessage.bind(g);window.__spiritArea=[];
        g.handleServerMessage=message=>{const result=receive(message),p=message.payload;
            if(message.type==='ability'&&p?.sourceId===g.player.id&&p.skillName.startsWith('Spirit Guardians'))window.__spiritArea.push(p);
            return result;};
    });
    async function cast({boosted=false,rank=5,expanded=false,quality='high'}={}){
        await expect.poll(()=>page.evaluate(()=>Boolean(window.game.player.spiritsActive)),{timeout:20_000}).toBe(false);
        await page.locator('#btn-mobile-menu').tap();await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality);await page.locator('#btn-close-settings').tap();
        if(await page.locator('#esc-menu').isVisible())await page.locator('#btn-mobile-menu').tap();
        const sequence=await page.evaluate(()=>window.game.animationQAReadySequence||0);await command('/qa-animation-ready');
        await expect.poll(()=>page.evaluate(()=>window.game.animationQAReadySequence||0)).toBeGreaterThan(sequence);
        const before=await page.evaluate(()=>{window.__spiritArea=[];const p=window.game.player;return {rank:p.talentRanks?.CLR_34||0,slot:p.hotbar.indexOf('Spirit Guardians Boost')};});
        expect(before.rank).toBe(rank);
        if(boosted)await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();else await page.locator('#btn-mobile-ability').tap();
        await expect.poll(()=>page.evaluate(()=>window.__spiritArea.length)).toBe(1);
        const radius=(boosted?20:16)*(expanded?1.5:1)*(1+.03*rank);
        expect(await page.evaluate(()=>window.__spiritArea[0].radius)).toBeCloseTo(radius,8);
        await expect.poll(()=>page.evaluate(()=>window.game.player.spiritEffect?.effectRadius)).toBeCloseTo(radius,4);
        const scene=await page.evaluate(()=>{const p=window.game.player,e=p.spiritEffect;return {radius:p.spiritRadius,rune:p.spiritRune,
            boundary:e.pulseRing.geometry.parameters.outerRadius,scale:e.pulseRing.scale.x,count:e.guardians.length,
            cherub:e.guardians[0].userData.presentation,bodyScale:e.guardians[0].scale.x};});
        expect(scene.radius).toBeCloseTo(radius,4);expect(scene.boundary).toBeCloseTo(radius,4);
        expect(scene.rune).toBe(expanded?'spirits_expanded':'');expect(scene.scale).toBe(1);
        expect(scene.count).toBe(boosted?5:3);expect(scene.cherub).toBe('cherub');expect(scene.bodyScale).toBeLessThan(1.3);
        await page.screenshot({path:testInfo.outputPath(`spirits-${boosted}-${rank}-${expanded}-${quality}.png`)});
        console.log(`[spirit-area] boosted${boosted}/rank${rank}/expanded${expanded}/${quality}: accepted and persistent ${radius}m, ${scene.count} body-sized cherubs`);
    }
    await cast({rank:0});await build('Talents');
    for(let rank=1;rank<=5;rank++){
        const buy=page.locator('[data-build-action="talent:CLR_34"]');await buy.scrollIntoViewIfNeeded();await buy.tap();
        await expect.poll(()=>page.evaluate(()=>window.game.player.talentRanks?.CLR_34||0)).toBe(rank);
        await expect.poll(()=>page.evaluate(()=>window.game.uiManager.skillTree.mobile.pending===null)).toBe(true);
    }
    await page.locator('#btn-close-skills').tap();await cast({quality:'low'});
    await build('Runes');await page.locator('#phone-rune-skill').selectOption('Spirit Guardians');
    const rune=page.locator('[data-build-action="rune:spirits_expanded"]');await rune.scrollIntoViewIfNeeded();await rune.tap();
    await expect.poll(()=>page.evaluate(()=>window.game.player.skillRunes?.['Spirit Guardians'])).toBe('spirits_expanded');
    await page.locator('#btn-close-skills').tap();await cast({expanded:true});
    const second=await browser.browserType().launch({executablePath:process.env.EIDOLON_E2E_BROWSER_PATH||undefined,
        headless:process.env.EIDOLON_E2E_HEADLESS!=='0',args:[...hardwareWebGLBrowserArgs(),...backendOriginBrowserArgs(process.env.EIDOLON_E2E_BACKEND_ORIGIN_IP)]});
    try{
        const context=await second.newContext({ baseURL }),observer=await context.newPage(),observerFailures=collectBrowserFailures(observer,baseURL);
        // Use the same complete runtime readiness/recovery as ordinary login.
        await openGame(observer);const sourceId=await page.evaluate(()=>window.game.player.id);
        await cast({boosted:true,expanded:true,quality:'low'});
        await loginAndEnterWorld(observer,{...credentials,username:`${credentials.username}-view`});
        await expect.poll(()=>observer.evaluate(id=>window.game.remotePlayers.get(id)?.spiritEffect?.effectRadius,sourceId)).toBeCloseTo(34.5,4);
        const state=await observer.evaluate(id=>{const p=window.game.remotePlayers.get(id);return {ranks:p.talentRanks||{},rune:p.spiritRune,
            duration:p.spiritDuration,count:p.spiritEffect.guardians.length};},sourceId);
        expect(state.ranks).toEqual({});expect(state.rune).toBe('spirits_expanded');expect(state.count).toBe(5);
        expect(state.duration).toBeGreaterThan(0);expect(state.duration).toBeLessThan(10);
        await expect.poll(()=>observer.evaluate(id=>Boolean(window.game.remotePlayers.get(id)?.spiritEffect),sourceId),{timeout:15_000}).toBe(false);
        expect(observerFailures,observerFailures.join('\n')).toEqual([]);
        console.log('[spirit-area] late observer reconstructed trained boost/rune and saw normal expiry');
    }finally{await second.close();}
    await loginAndEnterWorld(page,credentials);
    expect(await page.evaluate(()=>window.game.player.talentRanks?.CLR_34)).toBe(5);
    expect(await page.evaluate(()=>window.game.player.skillRunes?.['Spirit Guardians'])).toBe('spirits_expanded');
    expect(failures,failures.join('\n')).toEqual([]);
});
