// Prepared public projections: real UI controllers, not earned play.
export async function prepareCasinoReview({game, phone = false, textScale = 100}) {
            const THREE = await import('three');
            let ui = null;
            if (phone) {
                const {UIManager} = await import('/src/ui/UIManager.js');
                document.body.classList.add('mobile-mode');
                localStorage.setItem('eidolon.phoneMenuTextScale', String(textScale));
                ui = new UIManager(true);
            }
            const { CasinoController } = await import('/src/core/CasinoController.js');
            document.getElementById('start-screen').style.display = 'none';
            const sent = [], engine = { uiManager:ui, currentInstanceId: 'lanternhold-casino', cameraLocked: true,
                player: { id:'hero', state:'IDLE', position:new THREE.Vector3() },
                network: { socket: { readyState: WebSocket.OPEN }, send(type,payload) { sent.push({type,payload}); } },
                inputManager: { clearInputState() {} }, renderSystem: { camera:new THREE.OrthographicCamera(), cameraTarget:new THREE.Vector3(), scene:new THREE.Scene(), setCameraTarget() {} } };
            const c = new CasinoController(engine);
            const table = { id:`public-${game}`, name:`Lanternhold ${game}`, game, floor:'public', currency:'gold', x:0,z:170,
                seats:Array.from({length:6},(_,i)=>({x:i,z:172,rotation:0,exitX:i,exitZ:173})) };
            const house = { tableId:table.id, tableVersion:'1', game, currency:'gold', phase:'betting', roundId:'review', available:true,
                balance:1000,minBet:20,maxBet:100000,betStep:20,players:[],serverNow:new Date().toISOString(),dealAt:new Date(Date.now()+30000).toISOString(),
                history:Array.from({length:37},(_,i)=> game==='roulette' ? {roundId:String(i), number:i} : {roundId:String(i),baccarat:{playerTotal:8,bankerTotal:6,winner:'player'}}) };
            if (game==='roulette') house.spots=[...['red','black','odd','even','low','high','dozen-1','dozen-2','dozen-3','column-1','column-2','column-3']
                .map(id=>({id,label:id,multiplier:id.includes('-')?3:2})),{id:'split:1-2',label:'Split 1/2',multiplier:18}];
            const payload = { tables:[table], floor:'public', yourSeat:{tableId:table.id,seat:0,sessionId:'prepared-seat',exitX:0,exitZ:173},
                occupants:Array.from({length:6},(_,i)=>({tableId:table.id,playerId:i===0?'hero':`guest-${i}`,name:i===0?'You':`Lanternhold guest ${i}`,seat:i,connected:true})), house };
            if (game === 'blackjack') {
                const players=payload.occupants.map(p=>({...p,bet:20}));
                payload.blackjack={...house,gold:1000,phase:'playing',players,
                    round:{revision:1,dealer:[9],dealerHidden:true,turnPlayerId:'hero',turnHand:0,actions:['hit','stand'],
                        deadline:house.dealAt,players:players.map(p=>({...p,hands:[{cards:[10,3],bet:20}]}))}};
            }
            if (game === 'poker') payload.poker = { ...house, gold:1000, minBuyIn:100, maxBuyIn:100000, players:[] };
            if (game === 'slots') payload.slots = { available:true, currency:'gold', balance:1000, minBet:20, maxBet:100000, betStep:20,
                machine:{theme:'earth',name:'Rootheart Reels',lore:'The four realms turn beneath the lanterns.',mechanic:'The roots carry each saved reward.',
                    symbols:['Seed','Fern','Amber','Roadward','Rootheart','Orun','Living root','Vault key'],bonusTitle:'The archive',bonusChoices:['Chest','Tablet','Root'],
                    weights:[24,20,16,12,10,8,5,5],pays:Array.from({length:6},()=>[6,16,28]),freeSpins:4},
                lines:Array.from({length:10},()=>[1,1,1,1,1]),session:{revision:1,bet:20,freeSpins:0,bonus:false}};
            c.updateState(payload); window.__controllerReview = {c,payload,sent,ui};

}
