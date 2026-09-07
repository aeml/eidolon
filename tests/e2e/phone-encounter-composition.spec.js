import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({hasTouch:true,isMobile:true,userAgent:devices['Pixel 7'].userAgent,actionTimeout:12_000});
for (const [width,height] of [[390,844],[844,390],[568,320]]) {
    test(`${width}x${height}: default encounter framing leaves readable actors outside thumb controls`, async({page,baseURL},testInfo)=>{
        const failures=collectBrowserFailures(page,baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/,()=>{});
        await page.setViewportSize({width,height});
        await page.goto('/',{waitUntil:'networkidle'});
        await page.evaluate(async()=>{
            const THREE=await import('three');
            const {RenderSystem}=await import('/src/core/RenderSystem.js');
            const {UIManager}=await import('/src/ui/UIManager.js');
            const {InputManager}=await import('/src/core/InputManager.js');
            const {Minimap}=await import('/src/ui/Minimap.js');
            const {MeshFactory}=await import('/src/utils/MeshFactory.js');
            const {createProceduralTerrainMaterial}=await import('/src/art/ProceduralRealmTerrain.js');
            document.body.classList.add('mobile-mode');document.getElementById('start-screen').style.display='none';
            const render=new RenderSystem(true),ui=new UIManager(true),input=new InputManager(render.camera,render.scene,render.renderer.domElement);
            input.setupMobileControls();ui.showHUD();ui.toggleChat(true);new Minimap();
            ui.quest.renderObjectivesPanel([{id:'field-guide',title:'Find the missing crystal fragments',progressLabel:'1 / 4',hint:'Follow the roots.'}]);
            ui.lastPlayerRef={id:'self'};
            ui.social.updateParty({partyId:'composition-party',leaderId:'self',members:Array.from({length:5},(_,i)=>({
                id:i===0?'self':`ally-${i}`,name:`Long named adventurer ${i}`,hp:60,maxHp:100,level:30,class:i===0?'Cleric':'Fighter'}))});
            const hero=await MeshFactory.createMeshForType('Wizard'),enemy=await MeshFactory.createMeshForType('Skeleton');
            enemy.position.set(4,0,-4);render.entityGroup.add(hero,enemy);
            const terrain=new THREE.Mesh(new THREE.PlaneGeometry(120,120),createProceduralTerrainMaterial('earth',{quality:'low'}));
            terrain.rotation.x=-Math.PI/2;terrain.position.y=-.02;render.environmentGroup.add(terrain);
            render.setCameraTarget(hero.position);render.onWindowResize();
            const project=p=>{const v=p.clone().project(render.camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};};
            const metrics=()=>{
                render.camera.updateMatrixWorld(true);render.scene.updateMatrixWorld(true);
                const box=new THREE.Box3().setFromObject(hero),feet=project(hero.position),head=project(new THREE.Vector3(0,box.max.y,0));
                const rect=document.getElementById('phone-encounter-region')?.getBoundingClientRect();
                return {feet,head,enemy:project(enemy.position.clone().add(new THREE.Vector3(0,1,0))),height:feet.y-head.y,
                    zoom:render.currentZoom,region:rect?{left:rect.left,top:rect.top,width:rect.width,height:rect.height}:null};
            };
            window.__encounterComposition={render,ui,input,metrics};
            const draw=()=>{render.render();window.__encounterComposition.frame=requestAnimationFrame(draw);};draw();
        });
        try {
            const metrics=await page.evaluate(()=>window.__encounterComposition.metrics());
            await testInfo.attach('composition',{body:JSON.stringify(metrics),contentType:'application/json'});
            await page.screenshot({path:testInfo.outputPath('encounter.png')});
            expect(metrics.region).not.toBeNull();
            expect(metrics.zoom).toBe(15);
            expect(metrics.height).toBeGreaterThan(40);
            expect(metrics.feet.x).toBeCloseTo(metrics.region.left+metrics.region.width/2,0);
            expect(metrics.feet.y).toBeCloseTo(metrics.region.top+metrics.region.height/2,0);
            for (const point of [metrics.feet,metrics.head,metrics.enemy]) {
                expect(await page.evaluate(p=>!document.elementFromPoint(p.x,p.y)?.closest('#player-hud,#objectives-panel,#minimap-hud,#mobile-actions,#joystick-zone,#hotbar-container,#chat-box,#party-panel'),point)).toBe(true);
            }
            for (const button of await page.locator('#mobile-actions button,#hotbar-container .hotbar-slot,#btn-phone-status').all()) {
                await expect(button).toBeInViewport();
                expect(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
            }
            const beforeMatrix=await page.evaluate(()=>window.__encounterComposition.render.camera.projectionMatrix.elements);
            await page.evaluate(()=>window.__encounterComposition.ui.skillTree.showComboNotification('Mass Revival','mass_revival'));
            const combo=page.locator('.combo-notification');
            const comboBox=await combo.boundingBox();
            expect(comboBox.height).toBeLessThanOrEqual(44);
            expect(comboBox.y).toBeGreaterThan(metrics.feet.y);
            expect(comboBox.x).toBeGreaterThanOrEqual(metrics.region.left);
            expect(comboBox.x+comboBox.width).toBeLessThanOrEqual(metrics.region.left+metrics.region.width);
            expect(await combo.evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
            await page.screenshot({path:testInfo.outputPath('combo.png')});
            await expect(combo).toHaveCount(0,{timeout:4000});
            await page.locator('#btn-phone-party').tap();
            await expect(page.locator('#phone-party-panel')).toBeVisible();
            const partyBox=await page.locator('#phone-party-panel').boundingBox(),chatBox=await page.locator('#chat-box').boundingBox();
            expect(partyBox.y+partyBox.height).toBeLessThanOrEqual(chatBox.y);
            const select=page.locator('[data-party-target="ally-1"]');await select.scrollIntoViewIfNeeded();
            expect((await select.boundingBox()).height).toBeGreaterThanOrEqual(44);
            await page.screenshot({path:testInfo.outputPath('party.png')});
            await select.tap();await expect(page.locator('#phone-party-panel')).toBeHidden();
            expect(await page.evaluate(()=>window.__encounterComposition.ui.social.phoneParty.selectedId)).toBe('ally-1');
            expect(await page.evaluate(()=>window.__encounterComposition.render.camera.projectionMatrix.elements)).toEqual(beforeMatrix);
            await page.locator('#chat-mobile-toggle').tap();
            expect(await page.evaluate(()=>window.__encounterComposition.render.camera.projectionMatrix.elements)).toEqual(beforeMatrix);
            expect(await page.locator('#chat-mobile-toggle').evaluate(el=>{
                const r=el.getBoundingClientRect();
                return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
            })).toBe(true);
            await page.locator('#chat-mobile-toggle').tap();
            await expect(page.locator('#chat-box')).not.toHaveClass(/chat-mobile-expanded/);
        } finally {
            await page.evaluate(()=>{const s=window.__encounterComposition;cancelAnimationFrame(s.frame);s.input.dispose();s.ui.social.phoneParty?.dispose();s.ui.characterPreview?.dispose();s.render.dispose();});
        }
        expect(failures,failures.join('\n')).toEqual([]);
    });
}
