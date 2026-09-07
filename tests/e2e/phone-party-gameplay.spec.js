import {devices,expect,test} from '@playwright/test';
import {collectBrowserFailures,credentialsFromEnvironment,loginAndEnterWorld} from './helpers.js';
import {backendOriginBrowserArgs,hardwareWebGLBrowserArgs} from './browserLaunchPolicy.js';

test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true,userAgent:devices['Pixel 7'].userAgent,
    actionTimeout:12_000,trace:'off',screenshot:'off',video:'off'});
test('phone party selection heals a real ally through normal casts in both orientations',async({page,browser,baseURL},testInfo)=>{
    test.setTimeout(240_000);test.skip(process.env.EIDOLON_E2E_REGISTER!=='1','Requires isolated disposable party actors');
    const credentials=credentialsFromEnvironment(),failures=collectBrowserFailures(page,baseURL);
    await loginAndEnterWorld(page,credentials);
    const lastCommands=new Map();
    async function command(target,value){
        const delay=Math.max(0,1100-(Date.now()-(lastCommands.get(target)||0)));if(delay)await target.waitForTimeout(delay);
        lastCommands.set(target,Date.now());
        await target.locator('#chat-mobile-toggle').tap();await target.locator('#chat-input').fill(value);
        await target.locator('#chat-input').press('Enter');await target.locator('#chat-mobile-toggle').tap();
    }
    // Prepared cast conditions only, not earned progression or quest completion.
    await command(page,'/level 100');await expect.poll(()=>page.evaluate(()=>window.game.player.level)).toBe(100);
    await page.locator('#btn-mobile-menu').tap();await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button',{name:'Skills',exact:true}).tap();
    const branch=page.locator('[data-build-action="branch:A"]');await branch.scrollIntoViewIfNeeded();await branch.tap();
    await expect.poll(()=>page.evaluate(()=>window.game.player.hotbar?.[0])).toBe('Healing Light');
    await page.locator('#btn-close-skills').tap();
    const second=await browser.browserType().launch({executablePath:process.env.EIDOLON_E2E_BROWSER_PATH||undefined,
        headless:process.env.EIDOLON_E2E_HEADLESS!=='0',args:[...hardwareWebGLBrowserArgs(),...backendOriginBrowserArgs(process.env.EIDOLON_E2E_BACKEND_ORIGIN_IP)]});
    try{
        const context=await second.newContext({...devices['Pixel 7'],viewport:{width:390,height:844},baseURL});
        const ally=await context.newPage(),allyFailures=collectBrowserFailures(ally,baseURL);
        await loginAndEnterWorld(ally,{...credentials,username:`${credentials.username}-ally`,characterClass:'Fighter'});
        await command(ally,'/level 100');await expect.poll(()=>ally.evaluate(()=>window.game.player.level)).toBe(100);
        const allyId=await ally.evaluate(()=>window.game.player.id),casterId=await page.evaluate(()=>window.game.player.id);
        await expect.poll(()=>page.evaluate(id=>Boolean(window.game.remotePlayers.get(id)),allyId)).toBe(true);
        await page.locator('#btn-phone-party').tap();
        await page.getByRole('textbox',{name:'Player to invite'}).fill(`${credentials.username}-ally`);
        await page.locator('#phone-party-panel').getByRole('button',{name:'Invite',exact:true}).tap();
        await expect(ally.locator('#party-request-modal')).toBeVisible();
        await ally.locator('#btn-accept-party').tap();
        await expect.poll(()=>page.evaluate(()=>window.game.uiManager.social.partyData?.members?.length)).toBe(2);
        await expect(page.locator('#phone-party-panel')).toBeHidden();
        await page.evaluate(()=>{
            const game=window.game,receive=game.handleServerMessage.bind(game);window.__phonePartyHeals=[];
            game.handleServerMessage=message=>{if(message.type==='heal')window.__phonePartyHeals.push(message.payload);return receive(message);};
        });
        for(const [width,height] of [[390,844],[844,390],[568,320]]){
            await page.setViewportSize({width,height});
            await page.locator('#btn-phone-party').tap();
            const select=page.locator(`[data-party-target="${allyId}"]`);await select.scrollIntoViewIfNeeded();await select.tap();
            await expect(page.locator('#phone-party-panel')).toBeHidden();
            expect(await page.evaluate(()=>window.game.getMobileSupportTarget()?.id)).toBe(allyId);
            for (const [slot,skill] of [[0,'Healing Light'],[3,'Divine Intervention']]) {
                expect(await page.evaluate(index=>window.game.player.hotbar?.[index],slot)).toBe(skill);
                const sequence=await ally.evaluate(()=>window.game.animationQAReadySequence||0);
                await command(ally,'/qa-animation-ready low-health');
                await expect.poll(()=>ally.evaluate(()=>window.game.animationQAReadySequence||0)).toBeGreaterThan(sequence);
                const ready=await page.evaluate(()=>window.game.animationQAReadySequence||0);
                await command(page,'/qa-animation-ready');
                await expect.poll(()=>page.evaluate(()=>window.game.animationQAReadySequence||0)).toBeGreaterThan(ready);
                const before=await ally.evaluate(()=>window.game.player.stats.hp);
                const casterHP=await page.evaluate(()=>{window.__phonePartyHeals=[];return window.game.player.stats.hp;});
                await page.locator('#hotbar-container .hotbar-slot').nth(slot).tap();
                await expect.poll(()=>page.evaluate(({casterId,allyId})=>window.__phonePartyHeals.filter(h=>h.sourceId===casterId&&h.targetId===allyId&&h.amount>0).length,{casterId,allyId})).toBe(1);
                await expect.poll(()=>ally.evaluate(()=>window.game.player.stats.hp)).toBeGreaterThan(before);
                expect(await page.evaluate(()=>window.game.player.stats.hp)).toBe(casterHP);
                if (width === 390 && skill === 'Divine Intervention') {
                    const source = `${credentials.username}-ally`.toUpperCase();
                    await expect.poll(() => page.evaluate(name => window.game.floatingTextManager.texts.some(t =>
                        t.compact?.source === name && t.compact?.action === 'INTERVENTION UP'), source)).toBe(true);
                    const label = await page.evaluate(name => {
                        const t = window.game.floatingTextManager.texts.find(t => t.compact?.source === name && t.compact?.action === 'INTERVENTION UP');
                        const r = t.el.getBoundingClientRect();
                        return {x:r.x,right:r.right,width:r.width,font:getComputedStyle(t.el).fontSize,full:t.el.getAttribute('aria-label')};
                    }, source);
                    expect(label.width).toBeLessThanOrEqual(216);
                    expect(label.x).toBeGreaterThanOrEqual(11);
                    expect(label.right).toBeLessThanOrEqual(width - 11);
                    expect(parseFloat(label.font)).toBeGreaterThanOrEqual(16);
                    expect(label.full).toContain(source);
                }
                console.log(`[phone-party] ${width}x${height}: ${skill}, deliberate ally selection, authoritative healing, unchanged caster health`);
            }
            await page.screenshot({path:testInfo.outputPath(`party-heal-${width}-${height}.png`)});
        }
        await ally.locator('#btn-phone-party').tap();const leave=ally.getByRole('button',{name:'Leave party',exact:true});await leave.scrollIntoViewIfNeeded();await leave.tap();
        await expect.poll(()=>page.evaluate(()=>window.game.uiManager.social.phoneParty.selectedId)).toBeNull();
        expect(await page.evaluate(()=>window.game.getMobileSupportTarget()?.id)).toBe(casterId);
        expect(allyFailures,allyFailures.join('\n')).toEqual([]);
    }finally{await second.close();}
    expect(failures,failures.join('\n')).toEqual([]);
});
