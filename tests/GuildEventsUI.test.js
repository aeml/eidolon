import { jest } from '@jest/globals';
import { GuildUI } from '../src/ui/GuildUI.js';

function setup() {
    const container = document.createElement('div');
    const ui = new GuildUI({ container, getLastPlayer: () => ({ name: 'Alice' }) });
    ui.onEvent = jest.fn(); ui.onPartyInvite = jest.fn(); ui.onPartyReadyCheck = jest.fn();
    ui.onFindGroup = jest.fn();
    const guild = { id: 'g', name: 'Wardens', tag: 'W', permissions: { manage_events: true },
        activities: [{ id: 'world', name: 'World exploration' }],
        members: [{ playerId: 'a', username: 'Alice' }, { playerId: 'b', username: 'Bob', online: true, class: 'Fighter', level: 70 }],
        events: [{ id: 'e', revision: 3, title: '<b>Adventure</b>', activity: 'world', startsAt: '2099-09-14T18:00:00Z', durationMinutes: 120, capacity: 4,
            rsvps: [{ playerId: 'b', role: 'tank', status: 'going' }] }] };
    ui.update({ guild });
    return { ui, guild, panel: ui.events };
}

const click = (element, text) => [...element.querySelectorAll('button')].find(button => button.textContent === text).click();

test('calendar recruitment opens only its activity, without posting, RSVP or party consent', () => {
    const { ui, panel } = setup();
    click(panel.list, 'Find companions for this activity');
    expect(ui.onFindGroup).toHaveBeenCalledWith('world');
    expect(ui.onEvent).not.toHaveBeenCalled();
    expect(ui.onPartyInvite).not.toHaveBeenCalled();
    expect(ui.onPartyReadyCheck).not.toHaveBeenCalled();
    expect(panel.list.textContent).toContain('Listings last 20 minutes');
});

test.each(['revision', 'cancelled', 'finished', 'unsupported', 'other-guild', 'left', 'disposed'])(
    'calendar rejects a stale recruitment handoff after %s', change => {
        const { ui, guild, panel } = setup();
        const captured = [...panel.list.querySelectorAll('button')].find(button => button.textContent === 'Find companions for this activity');
        const next = { ...guild, events: [{ ...guild.events[0] }] };
        if (change === 'revision') next.events[0].revision++;
        if (change === 'cancelled') next.events[0].cancelled = true;
        if (change === 'finished') next.events[0].startsAt = '2000-01-01T00:00:00Z';
        if (change === 'unsupported') next.activities = [];
        if (change === 'other-guild') next.id = 'different';
        if (change === 'disposed') ui.dispose();
        else ui.update({ guild: change === 'left' ? null : next });
        captured.click();
        expect(ui.onFindGroup).not.toHaveBeenCalled();
    }
);

test('calendar handoff expires even without a subsequent server push', () => {
    const { ui, guild, panel } = setup();
    const now = jest.spyOn(Date, 'now').mockReturnValue(new Date(guild.events[0].startsAt).getTime() + 120 * 60000);
    try {
        click(panel.list, 'Find companions for this activity');
        expect(ui.onFindGroup).not.toHaveBeenCalled();
    } finally { now.mockRestore(); }
});

test('calendar public names keep own sign-ups and invitation account targets stable', () => {
    const { ui, guild, panel } = setup();
    panel.getPlayer = () => ({ id: 'a', name: 'Arcanis Dawn' });
    ui.update({ guild: { ...guild,
        members: guild.members.map(member => ({ ...member, displayName: member.playerId === 'a' ? 'Arcanis Dawn' : 'Moon Keeper' })),
        events: [{ ...guild.events[0], rsvps: [...guild.events[0].rsvps, { playerId: 'a', role: 'healer', status: 'going' }] }] } });
    expect(panel.list.textContent).toContain('Arcanis Dawn');
    expect(panel.list.textContent).toContain('Moon Keeper');
    expect(panel.list.querySelector('select').value).toBe('healer');
    expect([...panel.list.querySelectorAll('button')].filter(button => button.textContent === 'Invite to party')).toHaveLength(1);
    click(panel.list, 'Invite to party');
    expect(ui.onPartyInvite).toHaveBeenCalledWith('Bob');
    click(panel.list, 'Withdraw');
    expect(ui.onEvent).toHaveBeenCalledWith({ action: 'withdraw', eventId: 'e' });
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
