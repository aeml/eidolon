import {devices,expect,test} from '@playwright/test';
import {collectBrowserFailures,credentialsFromEnvironment,loginAndEnterWorld} from './helpers.js';
import {backendOriginBrowserArgs,hardwareWebGLBrowserArgs} from './browserLaunchPolicy.js';

test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true,userAgent:devices['Pixel 7'].userAgent,
    actionTimeout:12_000,trace:'off',screenshot:'off',video:'off'});

test('Cleric cone, Beacon and normal Mass Revival casts render their accepted trained boundaries',async({page,browser,baseURL},testInfo)=>{
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER!=='1','Requires isolated disposable Cleric');
    const credentials=credentialsFromEnvironment(),failures=collectBrowserFailures(page,baseURL);
    await loginAndEnterWorld(page,credentials);
    const second=await browser.browserType().launch({executablePath:process.env.EIDOLON_E2E_BROWSER_PATH||undefined,
        headless:process.env.EIDOLON_E2E_HEADLESS!=='0',args:[...hardwareWebGLBrowserArgs(),...backendOriginBrowserArgs(process.env.EIDOLON_E2E_BACKEND_ORIGIN_IP)]});
    try{
    const context=await second.newContext({...devices['Pixel 7'],viewport:{width:390,height:844},baseURL});
    const observer=await context.newPage(),observerFailures=collectBrowserFailures(observer,baseURL);
    await loginAndEnterWorld(observer,{...credentials,username:`${credentials.username}-view`});
    const sourceId=await page.evaluate(()=>window.game.player.id);
    await expect.poll(()=>observer.evaluate(id=>Boolean(window.game.remotePlayers.get(id)?.mesh),sourceId)).toBe(true);
    await observer.evaluate(id=>{
        const g=window.game,receive=g.handleServerMessage.bind(g);window.__observedAreas=[];
        g.handleServerMessage=message=>{
            const result=receive(message),p=message.payload;
            if(message.type==='ability'&&p?.sourceId===id){
                const source=g.remotePlayers.get(id);
                const effect=g.effects.find(e=>e.isActive&&e.abilityShape?.sourceId===id&&e.abilityShape?.skillName===p.skillName);
                const root=effect?.meshes?.[0],boundary=root?.children.find(c=>c.userData.normalizedGameplayRadius===1);
                window.__observedAreas.push({skill:p.skillName,radius:p.radius||0,arc:p.arc||0,resolved:p.shapeResolved,
                    ranks:source?.talentRanks||{},meshRadius:boundary?.scale.x,attached:root?.parent===g.renderSystem.effectGroup,
                    center:root?{x:root.position.x,z:root.position.z}:null});
            }
            return result;
        };
    },sourceId);
    let lastCommand=0;
    async function command(value){
        const delay=Math.max(0,1100-(Date.now()-lastCommand));if(delay)await page.waitForTimeout(delay);lastCommand=Date.now();
        await page.locator('#chat-mobile-toggle').tap();await page.locator('#chat-input').fill(value);
        await page.locator('#chat-input').press('Enter');await page.locator('#chat-mobile-toggle').tap();
    }
    async function build(tab){
        await page.locator('#btn-mobile-menu').tap();await page.locator('#btn-phone-skills').tap();
        await page.locator('.phone-build-tabs').getByRole('button',{name:tab,exact:true}).tap();
    }
    async function branch(value){
        await build('Skills');const button=page.locator(`[data-build-action="branch:${value}"]`);
        await button.scrollIntoViewIfNeeded();await button.tap();
        await expect.poll(()=>page.evaluate(()=>window.game.player.selectedBranch)).toBe(value);
        await page.locator('#btn-close-skills').tap();
    }
    async function ready(){
        const sequence=await page.evaluate(()=>window.game.animationQAReadySequence||0);
        await command('/qa-animation-ready low-health');
        await expect.poll(()=>page.evaluate(()=>window.game.animationQAReadySequence||0)).toBeGreaterThan(sequence);
    }
    async function tapSkill(skill){
        const slot=await page.evaluate(name=>window.game.player.hotbar.indexOf(name),skill);
        expect(slot).toBeGreaterThanOrEqual(0);
        await page.locator('#hotbar-container .hotbar-slot').nth(slot).tap();
    }
    await command('/level 100');await expect.poll(()=>page.evaluate(()=>window.game.player.level)).toBe(100);
    await page.evaluate(()=>{
        const g=window.game,receive=g.handleServerMessage.bind(g);window.__finalAreas=[];
        g.handleServerMessage=message=>{
            const result=receive(message),p=message.payload;
            if(message.type==='ability'&&p?.sourceId===g.player.id){
                const effect=g.effects.find(e=>e.isActive&&e.abilityShape?.sourceId===g.player.id&&e.abilityShape?.skillName===p.skillName);
                const root=effect?.meshes?.[0],boundary=root?.children.find(c=>c.userData.normalizedGameplayRadius===1);
                window.__finalAreas.push({skill:p.skillName,resolved:p.shapeResolved,radius:p.radius||0,arc:p.arc||0,
                    meshRadius:boundary?.scale.x,meshArc:root?.userData.gameplayArc,center:root?{x:root.position.x,z:root.position.z}:null,
                    target:{x:p.targetX,z:p.targetZ},attached:root?.parent===g.renderSystem.effectGroup});
            }
            return result;
        };
    });
    async function cast(variant,rank){
        const skill=variant==='Radiant Strike'?variant:'Healing Light';
        await ready();await page.evaluate(()=>{window.__finalAreas=[];});
        await observer.evaluate(()=>{window.__observedAreas=[];});
        if(variant==='Mass Revival'){
            await tapSkill('Divine Intervention');
            await expect.poll(()=>page.evaluate(()=>window.__finalAreas.some(e=>e.skill==='Divine Intervention'))).toBe(true);
            // Ordinary GCD elapsed, still inside the real three-second combo window.
            await page.waitForTimeout(1100);
        }
        await tapSkill(skill);
        await expect.poll(()=>page.evaluate(name=>window.__finalAreas.filter(e=>e.skill===name).length,skill)).toBe(1);
        const event=await page.evaluate(name=>window.__finalAreas.find(e=>e.skill===name),skill);
        const base=variant==='Radiant Strike'?3:variant==='Beacon'?5:variant==='Mass Revival'?20:0;
        expect(event.resolved).toBe(true);expect(event.radius).toBeCloseTo(base*(1+.03*rank),8);
        if(base){
            expect(event.attached).toBe(true);expect(event.meshRadius).toBeCloseTo(event.radius,8);
            expect(event.arc).toBeCloseTo(variant==='Radiant Strike'?2*Math.PI/3:2*Math.PI,8);
            if(skill==='Healing Light')expect(event.center).toEqual(event.target);
        }else expect(event.meshRadius).toBeUndefined();
        await expect.poll(()=>observer.evaluate(name=>window.__observedAreas.filter(e=>e.skill===name).length,skill)).toBe(1);
        const remote=await observer.evaluate(name=>window.__observedAreas.find(e=>e.skill===name),skill);
        expect(remote.ranks).toEqual({});expect(remote.resolved).toBe(true);
        expect(remote.radius).toBeCloseTo(event.radius,8);expect(remote.arc).toBeCloseTo(event.arc,8);
        if(base){
            expect(remote.attached).toBe(true);expect(remote.meshRadius).toBeCloseTo(event.radius,8);
            if(skill==='Healing Light')expect(remote.center).toEqual(event.target);
        }else expect(remote.meshRadius).toBeUndefined();
        if(variant==='Mass Revival'){
            await expect(page.locator('.combo-notification').last()).toContainText('Mass Revival');
            await expect(page.locator('.combo-notification').last()).toBeVisible();
            expect(await page.evaluate(()=>window.game.floatingTextManager.texts.some(t=>
                /^COMBO:/.test(t.el?.textContent||'')))).toBe(false);
        }
        console.log(`[cleric-final-area] ${variant}/rank${rank}: accepted ${event.radius}m, real rendered boundary`);
    }
    for(const rank of [0,5]){
        if(rank){
            await build('Talents');
            for(let n=1;n<=rank;n++){
                const buy=page.locator('[data-build-action="talent:CLR_34"]');await buy.scrollIntoViewIfNeeded();await buy.tap();
                await expect.poll(()=>page.evaluate(()=>window.game.player.talentRanks?.CLR_34||0)).toBe(n);
                await expect.poll(()=>page.evaluate(()=>window.game.uiManager.skillTree.mobile.pending===null)).toBe(true);
            }
            await page.locator('#btn-close-skills').tap();
            await page.locator('#btn-mobile-menu').tap();await page.locator('#btn-settings').tap();
            await page.locator('#graphics-quality').selectOption('low');await page.locator('#btn-close-settings').tap();
            if(await page.locator('#esc-menu').isVisible())await page.locator('#btn-mobile-menu').tap();
            await observer.locator('#btn-mobile-menu').tap();await observer.locator('#btn-settings').tap();
            await observer.locator('#graphics-quality').selectOption('low');await observer.locator('#btn-close-settings').tap();
            if(await observer.locator('#esc-menu').isVisible())await observer.locator('#btn-mobile-menu').tap();
        }
        await branch('B');await cast('Radiant Strike',rank);
        await branch('A');
        if(!rank)await cast('Direct',rank);
        await build('Runes');await page.locator('#phone-rune-skill').selectOption('Healing Light');
        if(!rank){
            const rune=page.locator('[data-build-action="rune:healinglight_beacon"]');await rune.scrollIntoViewIfNeeded();await rune.tap();
            await expect.poll(()=>page.evaluate(()=>window.game.player.skillRunes?.['Healing Light'])).toBe('healinglight_beacon');
        }
        await page.locator('#btn-close-skills').tap();
        await cast('Beacon',rank);await cast('Mass Revival',rank);
        await page.screenshot({path:testInfo.outputPath(`cleric-final-area-rank${rank}.png`)});
        await observer.screenshot({path:testInfo.outputPath(`cleric-final-observer-rank${rank}.png`)});
    }
    await page.reload({waitUntil:'networkidle'});await loginAndEnterWorld(page,credentials);
    expect(await page.evaluate(()=>window.game.player.talentRanks?.CLR_34)).toBe(5);
    expect(observerFailures,observerFailures.join('\n')).toEqual([]);
    expect(failures,failures.join('\n')).toEqual([]);
    }finally{await second.close();}
});
