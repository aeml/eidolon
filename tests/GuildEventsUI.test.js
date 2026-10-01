import { jest } from '@jest/globals';
import { GuildUI } from '../src/ui/GuildUI.js';

function setup() {
    const container = document.createElement('div');
    const ui = new GuildUI({ container, getLastPlayer: () => ({ name: 'Alice' }) });
    ui.onEvent = jest.fn(); ui.onPartyInvite = jest.fn(); ui.onPartyReadyCheck = jest.fn(); ui.onFindCompanions = jest.fn();
    const guild = { id: 'g', name: 'Wardens', tag: 'W', permissions: { manage_events: true },
        activities: [{ id: 'world', name: 'World exploration' }],
        members: [{ playerId: 'a', username: 'Alice' }, { playerId: 'b', username: 'Bob', online: true, class: 'Fighter', level: 70 }],
        events: [{ id: 'e', revision: 3, title: '<b>Adventure</b>', activity: 'world', startsAt: '2099-09-14T18:00:00Z', durationMinutes: 120, capacity: 4,
            rsvps: [{ playerId: 'b', role: 'tank', status: 'going' }] }] };
    ui.update({ guild });
    return { ui, guild, panel: ui.events };
}

const click = (element, text) => [...element.querySelectorAll('button')].find(button => button.textContent === text).click();

test('calendar hands only the chosen activity to recruitment without publishing private plans', () => {
    const {ui, panel} = setup();
    click(panel.list, 'Find companions');
    expect(ui.onFindCompanions).toHaveBeenCalledWith('world');
    expect(ui.onFindCompanions.mock.calls[0]).toHaveLength(1);
    expect(ui.onEvent).not.toHaveBeenCalled(); expect(ui.onPartyInvite).not.toHaveBeenCalled();
    expect(panel.element.textContent).toContain('no listing is posted automatically');
});

test('changed or disposed calendar buttons cannot recruit, invite or act on old consent', () => {
    const {ui, guild, panel} = setup();
    const stale = [...panel.list.querySelectorAll('button')];
    click(panel.list, 'Cancel event');
    const confirm = [...panel.list.querySelectorAll('button')].find(button => button.textContent === 'Confirm cancellation');
    ui.update({guild: {...guild, events: [{...guild.events[0], revision: 4}]}});
    for (const button of [...stale, confirm]) button.click();
    expect(ui.onEvent).not.toHaveBeenCalled(); expect(ui.onPartyInvite).not.toHaveBeenCalled(); expect(ui.onFindCompanions).not.toHaveBeenCalled();
    const current = [...panel.list.querySelectorAll('button')];
    panel.dispose(); for (const button of current) button.click();
    expect(ui.onEvent).not.toHaveBeenCalled(); expect(ui.onPartyInvite).not.toHaveBeenCalled(); expect(ui.onFindCompanions).not.toHaveBeenCalled();
});

test('calendar sends versioned own consent and explicit party actions, rendering plain text', () => {
    const { ui, panel } = setup();
    expect(panel.list.querySelector('b')).toBeNull();
    panel.list.querySelector('select').value = 'healer';
    click(panel.list, 'Going');
    expect(ui.onEvent).toHaveBeenCalledWith({ action: 'rsvp', eventId: 'e', revision: 3, role: 'healer', status: 'going' });
    expect(ui.onPartyInvite).not.toHaveBeenCalled();
    click(panel.list, 'Invite to party');
    expect(ui.onPartyInvite).toHaveBeenCalledWith('Bob');
    click(panel.element, 'Check current party readiness');
    expect(ui.onPartyReadyCheck).toHaveBeenCalledTimes(1);
});

test('losing guild membership or passing an event end retires calendar actions', () => {
    const {ui, panel} = setup();
    const beforeLeaving = [...panel.list.querySelectorAll('button')];
    ui.update({guild: null});
    for (const button of beforeLeaving) button.click();
    expect(ui.onEvent).not.toHaveBeenCalled(); expect(ui.onPartyInvite).not.toHaveBeenCalled(); expect(ui.onFindCompanions).not.toHaveBeenCalled();
    const current = setup();
    jest.useFakeTimers();
    try {
        jest.setSystemTime(new Date('2099-09-14T20:00:00Z'));
        for (const button of current.panel.list.querySelectorAll('button')) button.click();
        expect(current.ui.onEvent).not.toHaveBeenCalled(); expect(current.ui.onPartyInvite).not.toHaveBeenCalled(); expect(current.ui.onFindCompanions).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
});

test('guild pushes preserve draft and edits carry original revision with local-to-UTC time', () => {
    const { ui, guild, panel } = setup();
    click(panel.list, 'Edit event');
    panel.title.value = 'Updated expedition';
    ui.update({ guild: { ...guild, events: [{ ...guild.events[0], revision: 4 }] } });
    expect(panel.title.value).toBe('Updated expedition');
    panel.form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(ui.onEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'edit', revision: 3, title: 'Updated expedition', startsAt: '2099-09-14T18:00:00.000Z' }));
});

test('ordinary members cannot see editor and cancellation requires explicit second click', () => {
    const { ui, guild, panel } = setup();
    click(panel.list, 'Cancel event');
    expect(ui.onEvent).not.toHaveBeenCalled();
    click(panel.list, 'Confirm cancellation');
    expect(ui.onEvent).toHaveBeenCalledWith({ action: 'cancel', eventId: 'e', revision: 3 });
    ui.update({ guild: { ...guild, permissions: {}, events: [{ ...guild.events[0], cancelled: true }] } });
    expect(panel.editor.hidden).toBe(true);
    expect(panel.list.textContent).toContain('CANCELLED');
    expect([...panel.list.querySelectorAll('button')].map(button => button.textContent)).not.toContain('Going');
});
