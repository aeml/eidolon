import { jest } from '@jest/globals';
import { GroupFinderUI } from '../src/ui/GroupFinderUI.js';

const listing = { ownerId: 'leader', name: '<img src=x>', mode: 'recruit', activity: 'world', role: 'healer',
    minLevel: 1, level: 70, class: 'Fighter', members: 2, capacity: 5, note: '<script>unsafe()</script>', expiresAt: '2026-09-13T12:00:00Z' };
const activities = [{ id:'world', name:'Exploration', minLevel:1 }, { id:'molten_core', name:'Molten Core', minLevel:70 }];
function setup() {
    document.body.innerHTML = '<div class="social-window" style="display:block"><div id="groups"></div></div>';
    const action=jest.fn(), invite=jest.fn();
    const ui = new GroupFinderUI(document.querySelector('#groups'), { action, invite });
    ui.update({viewerId:'self', listings:[listing], activities});
    return {ui, action, invite};
}

test('shows safe listing text and sends a request, never an automatic invitation', () => {
    const {ui,action,invite}=setup();
    expect(ui.container.querySelector('img,script')).toBeNull();
    expect(ui.container.textContent).toContain('<script>unsafe()</script>');
    ui.joinRole.value='healer';
    [...ui.list.querySelectorAll('button')].find(b=>b.textContent==='Ask to join').click();
    expect(action).toHaveBeenCalledWith({action:'request',ownerId:'leader',role:'healer'});
    expect(invite).not.toHaveBeenCalled();
    ui.update({viewerId:'self',listings:[{...listing,requested:true}],activities});
    ui.list.querySelector('button').click();
    expect(action).toHaveBeenLastCalledWith({action:'cancel',ownerId:'leader',role:'healer'});
});

test('owner reviews requests and explicitly invites through the existing party flow', () => {
    const {ui,invite}=setup();
    ui.update({viewerId:'leader',activities,listings:[{...listing,applicants:[{playerId:'a',name:'Alice',class:'Cleric',level:70,role:'healer'}]}]});
    [...ui.list.querySelectorAll('button')].find(b=>b.textContent==='Invite Alice').click();
    expect(invite).toHaveBeenCalledWith('Alice');
});

test('activity selection uses the server entry floor and posts explicit fields', () => {
    const {ui,action}=setup();
    ui.activity.value='molten_core'; ui.activity.onchange();
    expect(ui.minimum.value).toBe('70');
    ui.mode.value='recruit'; ui.role.value='tank'; ui.note.value='First clear';
    ui.container.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));
    expect(action).toHaveBeenCalledWith({action:'post',mode:'recruit',activity:'molten_core',role:'tank',minLevel:70,note:'First clear'});
});

test('refresh stops when inactive and does not poll a hidden social window', () => {
    jest.useFakeTimers();
    const {ui,action}=setup(); ui.setActive(true);
    ui.update({activities,listings:[listing]});
    document.querySelector('.social-window').style.display='none';
    jest.advanceTimersByTime(15000);
    expect(action).toHaveBeenCalledTimes(1);
    ui.setActive(false); jest.useRealTimers();
});
