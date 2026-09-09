import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

const skills=['Blessing of Resolve','Blessing of Zeal',"Heaven's Trumpet"];
test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true,userAgent:devices['Pixel 7'].userAgent,
    actionTimeout:12_000,trace:'off',screenshot:'off',video:'off'});

test('normal Cleric support training matches accepted High and Low spell boundaries',async({page,baseURL},testInfo)=>{
    test.setTimeout(180_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER!=='1','Requires isolated Cleric-area route');
    const credentials=credentialsFromEnvironment(),failures=collectBrowserFailures(page,baseURL);
    await loginAndEnterWorld(page,credentials);
    let lastCommandAt=0;
    async function command(value) {
        const delay=Math.max(0,1100-(Date.now()-lastCommandAt));if(delay>0)await page.waitForTimeout(delay);lastCommandAt=Date.now();
        await page.locator('#chat-mobile-toggle').tap();await page.locator('#chat-input').fill(value);
        await page.locator('#chat-input').press('Enter');await page.locator('#chat-mobile-toggle').tap();
    }
    await command('/level 100');await expect.poll(()=>page.evaluate(()=>window.game.player.level)).toBe(100);
    await page.locator('#btn-mobile-menu').tap();await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button',{name:'Skills',exact:true}).tap();
    const branch=page.locator('[data-build-action="branch:C"]');await branch.scrollIntoViewIfNeeded();await branch.tap();
    await expect.poll(()=>page.evaluate(()=>window.game.player.selectedBranch)).toBe('C');
    await page.locator('#btn-close-skills').tap();
    await page.evaluate(()=>{
        const g=window.game,receive=g.handleServerMessage.bind(g);window.__clericArea={casts:[],results:[]};
        g.handleServerMessage=message=>{
            const result=receive(message),p=message.payload;
            if(message.type==='ability_result') window.__clericArea.results.push(p);
            if(message.type==='ability'&&p?.sourceId===g.player.id) {
                const effect=g.effects.find(e=>e.isActive&&e.abilityShape?.sourceId===g.player.id&&e.abilityShape?.skillName===p.skillName);
                const root=effect?.meshes?.[0],boundary=root?.children.find(c=>c.userData.normalizedGameplayRadius===1);
                window.__clericArea.casts.push({skill:p.skillName,radius:p.radius,arc:p.arc,meshRadius:boundary?.scale.x,
                    attached:root?.parent===g.renderSystem.effectGroup,authoritative:effect?.abilityShape.authoritative});
            }
            return result;
        };
    });
    async function casts(rank,quality) {
        await page.locator('#btn-mobile-menu').tap();await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality);await page.locator('#btn-close-settings').tap();
        if(await page.locator('#esc-menu').isVisible())await page.locator('#btn-mobile-menu').tap();
        for(const skill of skills) {
            const sequence=await page.evaluate(()=>window.game.animationQAReadySequence||0);
            await command('/qa-animation-ready');await expect.poll(()=>page.evaluate(()=>window.game.animationQAReadySequence||0)).toBeGreaterThan(sequence);
            const before=await page.evaluate(skill=>{
                window.__clericArea={casts:[],results:[]};const p=window.game.player;
                return {slot:p.hotbar.indexOf(skill),mana:p.stats.mana,rank:p.talentRanks?.CLR_34||0};
            },skill);
            expect(before.slot).toBeGreaterThanOrEqual(0);expect(before.rank).toBe(rank);
            await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
            await expect.poll(()=>page.evaluate(()=>window.__clericArea.casts.length)).toBe(1);
            await expect.poll(()=>page.evaluate(()=>window.__clericArea.results.length)).toBe(1);
            const observation=await page.evaluate(()=>window.__clericArea),cast=observation.casts[0],result=observation.results[0];
            expect(result.accepted).toBe(true);expect(before.mana-result.mana).toBe(skill==="Heaven's Trumpet"?50:35);
            expect(cast).toMatchObject({skill,attached:true,authoritative:true});
            expect(cast.radius).toBeCloseTo((skill==="Heaven's Trumpet"?12:10)*(1+.03*rank),8);
            expect(cast.meshRadius).toBeCloseTo(cast.radius,8);expect(cast.arc).toBeCloseTo(2*Math.PI,8);
            if(skill!=="Heaven's Trumpet") {
                const key=skill==='Blessing of Resolve'?'blessing_resolve':'blessing_zeal';
                await expect.poll(()=>page.evaluate(key=>window.game.player.attachedStatusEffects.has(key),key)).toBe(true);
            }
            console.log(`[cleric-area] ${skill} rank${rank}/${quality}: accepted and actual boundary ${cast.radius}`);
        }
        await page.screenshot({path:testInfo.outputPath(`cleric-area-${rank}-${quality}.png`)});
    }
    await casts(0,'high');
    await page.locator('#btn-mobile-menu').tap();await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button',{name:'Talents',exact:true}).tap();
    for(let rank=1;rank<=5;rank++) {
        const buy=page.locator('[data-build-action="talent:CLR_34"]');await buy.scrollIntoViewIfNeeded();await buy.tap();
        await expect.poll(()=>page.evaluate(()=>window.game.player.talentRanks?.CLR_34||0)).toBe(rank);
        await expect.poll(()=>page.evaluate(()=>window.game.uiManager.skillTree.mobile.pending===null)).toBe(true);
    }
    await page.locator('#btn-close-skills').tap();await casts(5,'low');await casts(5,'high');
    await loginAndEnterWorld(page,credentials);
    expect(await page.evaluate(()=>window.game.player.talentRanks?.CLR_34)).toBe(5);
    expect(failures,failures.join('\n')).toEqual([]);
});
