import { expect, test } from '@playwright/test';

// Rendered access/seat/UI fixture. Real membership and currency settlement are
// exercised by the focused disposable-Mongo server tests, not faked as earnings.
for (const width of [390,1440]) test(`Separate VIP floor and EP table controls at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:width===390?844:1000});
    await page.routeWebSocket(/\/ws(?:\?|$)/,()=>{});
    await page.goto('/',{waitUntil:'networkidle'});
    await page.evaluate(async()=>{
        const THREE=await import('three');
        const {CasinoController}=await import('/src/core/CasinoController.js');
        const {CollisionManager}=await import('/src/core/CollisionManager.js');
        const {createCasinoInterior}=await import('/src/art/ProceduralCasino.js');
        const {createProceduralFighter}=await import('/src/art/ProceduralHumanoid.js');
        document.getElementById('start-screen').style.display='none';
        document.querySelectorAll('canvas').forEach(n=>n.hidden=true);
        const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);
        renderer.domElement.style.cssText='position:fixed;inset:0;z-index:2';document.body.append(renderer.domElement);
        const scene=new THREE.Scene();scene.background=new THREE.Color(0x17212d);
        scene.add(new THREE.HemisphereLight(0xffe5bc,0x394968,3));
        const light=new THREE.DirectionalLight(0xffdb9a,3);light.position.set(8,24,185);scene.add(light);
        const camera=new THREE.OrthographicCamera(-24*innerWidth/innerHeight,24*innerWidth/innerHeight,24,-24,.1,500);
        camera.position.set(18,35,183);camera.lookAt(0,8,140);
        const collisionManager=new CollisionManager();createCasinoInterior(scene,collisionManager);
        const player={id:'hero',position:new THREE.Vector3(0,0,104),rotation:new THREE.Quaternion(),state:'IDLE',mesh:createProceduralFighter(),move(p){this.position.copy(p);}};
        scene.add(player.mesh);
        const sent=[],target=new THREE.Vector3(0,8,140);
        const engine={player,currentInstanceId:'lanternhold-casino',cameraLocked:true,isMobile:innerWidth<600,collisionManager,
            network:{socket:{readyState:WebSocket.OPEN},send(type,payload){sent.push({type,payload});}},
            renderSystem:{scene,renderer,camera,cameraTarget:target,setCameraTarget(p){target.copy(p);}},
            inputManager:{groundPlane:new THREE.Plane(new THREE.Vector3(0,1,0),0),clearInputState(){}},uiManager:{addChatMessage(){}}};
        const controller=new CasinoController(engine);
        const table={id:'vip-blackjack',name:'The Crownless Court',floor:'vip',currency:'ep',game:'blackjack',x:-14,y:8,z:137,minimumPlayers:1,
            seats:Array.from({length:6},(_,i)=>{const angle=i*Math.PI/3;return{x:-14+Math.sin(angle)*2.2,y:8,z:137+Math.cos(angle)*2.2,exitX:-14+Math.sin(angle)*3.4,exitZ:137+Math.cos(angle)*3.4,rotation:angle+Math.PI};})};
        controller.updateState({tables:[table],floor:'public',vip:true});controller.showDoorDialogue('guard');
        renderer.setAnimationLoop(()=>{controller.beforeUpdate(1/60);player.mesh.position.copy(player.position);player.mesh.quaternion.copy(player.rotation);controller.render([player]);renderer.render(scene,camera);});
        window.__vip={controller,engine,table,sent};
    });
    await page.getByRole('button',{name:'Enter VIP lounge',exact:true}).click();
    expect(await page.evaluate(()=>window.__vip.sent.some(m=>m.payload.action==='vip'))).toBe(true);
    await page.evaluate(()=>{const f=window.__vip;f.controller.setFloor({upstairs:true,x:0,y:8,z:104});f.controller.updateState({tables:[f.table],floor:'vip',vip:true});});
    await expect(page.getByRole('button',{name:'Return downstairs',exact:true})).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>{
        const floors=window.__vip.engine.renderSystem.scene.getObjectByName('lanternhold-casino-interior').userData.floors;
        return { public:floors.public.visible, vip:floors.vip.visible };
    })).toEqual({ public:false, vip:true });
    await page.screenshot({path:`/tmp/eidolon-vip-floor-${width}.png`});
    await page.evaluate(()=>{
        const f=window.__vip,s=f.table.seats[0];
        f.controller.updateState({tables:[f.table],floor:'vip',vip:true,occupants:[{tableId:f.table.id,playerId:'hero',name:'Thorn',seat:0,connected:true}],
            yourSeat:{tableId:f.table.id,seat:0,sessionId:'vip-fixture',exitX:s.exitX,exitY:8,exitZ:s.exitZ},
            blackjack:{available:true,currency:'ep',balance:100,gold:100000,minBet:2,maxBet:100,betStep:2,roundId:'vip-1',phase:'betting',players:[],serverNow:new Date().toISOString(),dealAt:new Date(Date.now()+30000).toISOString()}});
    });
    const panel=page.locator('.casino-session');
    await expect(panel).toBeVisible();await expect(panel).toContainText('100 EP available');
    await expect(panel).not.toContainText('Gold',{useInnerText:true});
    await expect.poll(()=>page.evaluate(()=>window.__vip.controller.blend)).toBe(1);
    expect(await panel.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:`/tmp/eidolon-vip-table-${width}.png`});
    await page.getByRole('button',{name:'Bet · 2 EP',exact:true}).click();
    expect(await page.evaluate(()=>window.__vip.sent.some(m=>m.payload.action==='bet'&&m.payload.bet===2))).toBe(true);
    await page.getByRole('button',{name:'Leave table',exact:true}).click();
    await page.evaluate(()=>{const f=window.__vip;f.controller.updateState({tables:[f.table],floor:'vip',vip:true});});
    expect(await page.evaluate(()=>window.__vip.engine.player.position.y)).toBe(8);
});
