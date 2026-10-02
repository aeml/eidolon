import { jest } from '@jest/globals';
import { GroupFinderUI } from '../src/ui/GroupFinderUI.js';

const listing = { id: 'listing-current', ownerId: 'leader', name: '<img src=x>', mode: 'recruit', activity: 'world', role: 'healer',
    plan: { meetingPointId: 'dungeon-guide' }, roles: { tank: 1, damage: 1 }, ready: 1,
    minLevel: 1, level: 70, class: 'Fighter', members: 2, capacity: 5, note: '<script>unsafe()</script>', expiresAt: '2026-09-13T12:00:00Z' };
const activities = [{ id:'world', name:'Exploration', minLevel:1 }, { id:'molten_core', name:'Molten Core', minLevel:70 }];
const meetingPoints = [{ id: 'dungeon-guide', name: 'Dungeon Guide', x: 0, z: 240 }, { id: 'story-wizard', name: 'Archmage Ilyra', x: 20, z: 215 }];
function setup() {
    document.body.innerHTML = '<div class="social-window" style="display:block"><div id="groups"></div></div>';
    const action=jest.fn(), invite=jest.fn();
    const ui = new GroupFinderUI(document.querySelector('#groups'), { action, invite });
    ui.update({viewerId:'self', listings:[listing], activities, meetingPoints});
    return {ui, action, invite};
}

test('corrected recruitment labels do not become safety account targets', () => {
    const { ui } = setup();
    ui.safety = jest.fn();
    ui.update({ viewerId: 'self', activities, meetingPoints,
        listings: [{ ...listing, ownerId: 'player-Alice', name: 'Arcanis Dawn' }] });
    const safety = ui.list.querySelector('.social-safety');
    expect(safety.querySelector('summary').getAttribute('aria-label')).toContain('Arcanis Dawn');
    const block = safety.querySelector('button');
    block.click(); block.click();
    expect(ui.safety).toHaveBeenCalledWith('block', 'Alice', expect.any(String));
});

test('shows safe listing text and sends a request, never an automatic invitation', () => {
    const {ui,action,invite}=setup();
    expect(ui.container.querySelector('img,script')).toBeNull();
    expect(ui.container.textContent).toContain('<script>unsafe()</script>');
    ui.joinRole.value='healer';
    [...ui.list.querySelectorAll('button')].find(b=>b.textContent==='Ask to join').click();
    expect(action).toHaveBeenCalledWith({action:'request',ownerId:'leader',listingId:'listing-current',role:'healer'});
    expect(invite).not.toHaveBeenCalled();
    ui.update({viewerId:'self',listings:[{...listing,requested:true,requestId:'application-current'}],activities,meetingPoints});
    ui.list.querySelector('button').click();
    expect(action).toHaveBeenLastCalledWith({action:'cancel',ownerId:'leader',listingId:'listing-current',applicationId:'application-current'});
});

test('owner reviews requests and explicitly invites through the existing party flow', () => {
    const {ui,invite,action}=setup();
    ui.update({viewerId:'leader',activities,meetingPoints,listings:[{...listing,applicants:[{id:'application-alice',playerId:'a',name:'Alice',class:'Cleric',level:70,role:'healer'}]}]});
    [...ui.list.querySelectorAll('button')].find(b=>b.textContent==='Invite Alice').click();
    expect(action).toHaveBeenCalledWith({action:'invite',ownerId:'leader',listingId:'listing-current',applicantId:'a',applicationId:'application-alice'});
    expect(invite).not.toHaveBeenCalled();
});

test('activity selection uses the server entry floor and posts explicit fields', () => {
    const {ui,action}=setup();
    ui.activity.value='molten_core'; ui.activity.onchange();
    expect(ui.minimum.value).toBe('70');
    ui.mode.value='recruit'; ui.role.value='tank'; ui.note.value='First clear';
    ui.container.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));
    expect(action).toHaveBeenCalledWith({action:'post',mode:'recruit',activity:'molten_core',role:'tank',minLevel:70,note:'First clear',plan:{meetingPointId:'dungeon-guide'}});
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

test('guide context waits for the authoritative catalogue and never posts or invites', () => {
    const {ui, action, invite} = setup();
    ui.update({activities: [], listings: []});
    ui.focusActivity('molten_core');
    expect(ui.context.textContent).toContain('Loading');
    expect(ui.activity.options).toHaveLength(0);
    ui.update({activities, listings: [listing]});
    expect(ui.filter.value).toBe('molten_core');
    expect(ui.activity.value).toBe('molten_core');
    expect(ui.minimum.value).toBe('70');
    expect(ui.list.textContent).toContain('Only real players');
    expect(ui.list.textContent).not.toContain(listing.name);
    ui.list.querySelector('button').click();
    expect(ui.editor.open).toBe(true);
    expect(document.activeElement).toBe(ui.mode);
    expect(action).not.toHaveBeenCalled();
    expect(invite).not.toHaveBeenCalled();
});

test('unknown activities do not manufacture entry floors and manual filters cancel pending context', () => {
    const {ui, action} = setup();
    ui.focusActivity('unreleased_raid');
    expect(ui.context.textContent).toContain('unavailable');
    expect([...ui.activity.options].some(option => option.value === 'unreleased_raid')).toBe(false);
    ui.filter.value = 'world'; ui.filter.onchange();
    ui.update({activities, listings: [listing]});
    expect(ui.filter.value).toBe('world');
    expect(ui.context.hidden).toBe(true);
    expect(action).not.toHaveBeenCalled();
});

test('opening contextual recruitment twice keeps one refresh request and closing stops refresh', () => {
    jest.useFakeTimers();
    const {ui, action} = setup();
    ui.setActive(true); ui.setActive(true);
    ui.update({activities, listings: []});
    expect(action).toHaveBeenCalledTimes(1);
    ui.setActive(false);
    jest.advanceTimersByTime(30000);
    expect(action).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
});

test('uses canonical public meeting points and submits an optional local-time start explicitly', () => {
    const { ui, action } = setup();
    expect(ui.list.textContent).toContain('Dungeon Guide, Lanternhold (0, 240)');
    expect(ui.list.textContent).toContain('1 tank · 0 healer · 1 damage');
    expect(ui.list.textContent).toContain('1/2 ready');
    ui.meetingPoint.value = 'story-wizard'; ui.start.value = '2026-09-30T20:10';
    ui.container.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(action).toHaveBeenLastCalledWith(expect.objectContaining({ plan: {
        meetingPointId: 'story-wizard', startsAt: new Date(ui.start.value).toISOString() } }));
    expect(ui.container.textContent).toContain('never teleport');
});

test('old detached listing and applicant buttons refresh instead of acting on replacement consent', () => {
    const { ui, action } = setup();
    const staleRequest = [...ui.list.querySelectorAll('button')].find(button => button.textContent === 'Ask to join');
    ui.update({ viewerId: 'self', activities, meetingPoints, listings: [{ ...listing, id: 'new-plan' }] });
    staleRequest.click();
    expect(action).toHaveBeenLastCalledWith({ action: 'list' });
    expect(ui.context.textContent).toContain('changed');
    const applicant = { id: 'old-request', playerId: 'a', name: 'Alice', class: 'Cleric', level: 70, role: 'healer' };
    ui.update({ viewerId: 'leader', activities, meetingPoints, listings: [{ ...listing, applicants: [applicant] }] });
    const oldInvite = [...ui.list.querySelectorAll('button')].find(button => button.textContent === 'Invite Alice');
    ui.update({ viewerId: 'leader', activities, meetingPoints, listings: [{ ...listing, applicants: [{ ...applicant, id: 'new-request' }] }] });
    oldInvite.click();
    expect(action).toHaveBeenLastCalledWith({ action: 'list' });
    expect(action.mock.calls.some(([payload]) => payload.action === 'invite')).toBe(false);
});

test('looking-player invitations use the listing identity, and map viewing does not post or invite', () => {
    const { ui, action, invite } = setup(), meeting = jest.fn();
    ui.meeting = meeting;
    ui.update({ viewerId: 'self', activities, meetingPoints, listings: [{ ...listing, mode: 'looking' }] });
    [...ui.list.querySelectorAll('button')].find(button => button.textContent === 'View meeting point on map').click();
    expect(meeting).toHaveBeenCalledWith('dungeon-guide'); expect(action).not.toHaveBeenCalled();
    [...ui.list.querySelectorAll('button')].find(button => button.textContent.startsWith('Invite ')).click();
    expect(action).toHaveBeenCalledWith({ action: 'invite', ownerId: 'leader', listingId: 'listing-current', applicantId: 'leader' });
    expect(invite).not.toHaveBeenCalled();
});
