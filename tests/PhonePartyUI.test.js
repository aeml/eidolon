import { jest } from '@jest/globals';
import { PhonePartyUI } from '../src/ui/PhonePartyUI.js';

let ui,social,player;
const party = () => ({partyId:'group',leaderId:'self',members:[
    {id:'self',name:'Cleric',hp:90,maxHp:100,level:30,class:'Cleric'},
    {id:'ally',name:'Ayla',hp:30,maxHp:100,level:30,class:'Fighter'}]});
beforeEach(()=>{
    document.body.innerHTML='<div id="ui-layer"></div><div id="chat-box"></div>';
    player={id:'self'};social={ctx:{getLastPlayer:()=>player,closePrimaryHudMenus:jest.fn()},partyData:party(),
        onPartyLeave:jest.fn(),onPartyInvite:jest.fn(),onPartyPromote:jest.fn(),onPartyKick:jest.fn(),onPartyReady:jest.fn()};
    ui=new PhonePartyUI(social);ui.update(social.partyData);
});
afterEach(()=>ui.dispose());
test('shared reward rules are readable on demand without expanding the roster by default',()=>{
    expect(ui.rewardRules.open).toBe(false);
    expect(ui.rewardRules.querySelector('summary').textContent).toBe('Shared kill rewards');
    expect(ui.rewardRules.textContent).toContain('anywhere inside the same dungeon');
    expect(ui.rewardRules.textContent).toContain('two normal screens');
    expect(ui.rewardRules.textContent).toContain('Downed allies count');
    expect(ui.rewardRules.textContent).toContain('completes their own quests');
});
test('party snapshots never automatically open a roster over the world',()=>{
    expect(ui.root.hidden).toBe(true);expect(ui.launcher.textContent).toBe('Party 2');
    ui.update(social.partyData);expect(ui.root.hidden).toBe(true);
    ui.launcher.click();expect(ui.root.hidden).toBe(false);
    expect(social.ctx.closePrimaryHudMenus).toHaveBeenCalledTimes(1);
});
test('health updates retain focused target buttons and scroll position',()=>{
    ui.open();const select=ui.rows.get('ally').select;select.focus();ui.body.scrollTop=180;
    social.partyData.members[1].hp=50;ui.update(social.partyData);
    expect(ui.rows.get('ally').select).toBe(select);expect(document.activeElement).toBe(select);
    expect(ui.body.scrollTop).toBe(180);expect(ui.rows.get('ally').health.textContent).toBe('50 / 100 HP');
});
test('a deliberate ally selection closes the panel and remains selected on updates',()=>{
    ui.open();ui.rows.get('ally').select.click();
    expect(ui.selectedId).toBe('ally');expect(ui.root.hidden).toBe(true);
    ui.update(social.partyData);expect(ui.selectedId).toBe('ally');
    expect(ui.selection.textContent).toContain('Ayla');expect(ui.rows.get('ally').select.getAttribute('aria-pressed')).toBe('true');
});
test('dead members cannot be newly selected, and a departing member clears the selection',()=>{
    social.partyData.members[1].hp=0;ui.update(social.partyData);
    expect(ui.rows.get('ally').select.disabled).toBe(true);
    ui.selectedId='ally';social.partyData.members.pop();ui.update(social.partyData);
    expect(ui.selectedId).toBeNull();expect(ui.rows.has('ally')).toBe(false);
});
test('leave and invite remain deliberate callbacks, not optimistic party mutations',()=>{
    ui.leave.click();expect(social.onPartyLeave).toHaveBeenCalledTimes(1);expect(ui.rows.size).toBe(2);
    ui.invite.value=' Neris ';[...ui.body.querySelectorAll('button')].find(b=>b.textContent==='Invite').click();
    expect(social.onPartyInvite).toHaveBeenCalledWith('Neris');
});
test('leadership and readiness remain authoritative',()=>{
    expect(ui.rows.get('ally').kick.hidden).toBe(false);expect(ui.rows.get('self').kick.hidden).toBe(true);
    social.partyData.leaderId='ally';social.partyData.readyCheckActive=true;ui.update(social.partyData);
    expect(ui.rows.get('ally').kick.hidden).toBe(true);expect(ui.loot.disabled).toBe(true);
    ui.ready.click();expect(social.onPartyReady).toHaveBeenCalledWith(true);
});
test('Escape closes only the party surface and restores its launcher',()=>{
    ui.open();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
    expect(ui.root.hidden).toBe(true);expect(document.activeElement).toBe(ui.launcher);
    expect(document.getElementById('chat-box').style.display).not.toBe('none');
});
test('changing characters clears selected allies and closes the old surface',()=>{
    ui.open();ui.selectedId='ally';player={id:'other-character'};ui.update(social.partyData);
    expect(ui.selectedId).toBeNull();expect(ui.root.hidden).toBe(true);
});
