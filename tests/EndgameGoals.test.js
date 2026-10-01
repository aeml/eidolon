import { jest } from '@jest/globals';
import { appendEndgameGoals, endgameGoals } from '../src/ui/EndgameGoals.js';
import { installUIManagerDungeon } from '../src/ui/UIManagerDungeon.js';

class GuideFixture { getDungeonDailyQuestEntries() { return []; } }
installUIManagerDungeon(GuideFixture);
afterEach(() => document.getElementById('dungeon-menu-backdrop')?.__closeMenu());

test.each([undefined, 0, 30, 99, 'bad'])('level %s does not gain endgame goals from local data', playerLevel => {
    expect(endgameGoals({ playerLevel }, { level: 100 })).toEqual([]);
});

test.each([
    [{}, 'all four repairs'],
    [{ crystalsRestored: true }, 'The Door Beneath the Crown'],
    [{ canEnterUmbralNexus: true }, 'The Fifth Note'],
    [{ darkRealmOpen: true }, 'personally click Complete Quest'],
    [{ darkKingDefeated: true }, 'A Letter Without a Throne']
])('story stage follows the guide reply %j', (stage, expected) => {
    const goals = endgameGoals({ playerLevel: 100, ...stage }, null);
    expect(goals).toHaveLength(6);
    expect(goals[0].text).toContain(expected);
    expect(goals[0].status).toBe(stage.darkKingDefeated ? 'Story claimed' : 'Story still in progress');
});

test.each(['available', 'claimed', 'unknown'])('weekly %s remains separate from entry and reset', status => {
    const goal = endgameGoals({ playerLevel: 100, weeklyRaidReward: { status, resetsAt: '2026-10-05T00:00:00Z' } })[2];
    expect(goal.text).toContain('2026-10-05 00:00 UTC');
    expect(goal.text).toContain('does not reset this reward limit');
    if (status === 'claimed') expect(goal.text).toContain('help other players');
    if (status === 'unknown') expect(goal.text).toContain('Do not assume');
});

test('reward sources and long-term goals do not create a mandatory daily or EP power path', () => {
    const text = endgameGoals({ playerLevel: 100 }, { resonancePoints: 2 }).map(g => g.text).join(' ');
    for (const phrase of ['2 unspent Resonance points', 'Daily quests are optional', 'EP cannot buy points',
        'one bonus gem and one unique-effect item', '+20 potency is a long-term endgame goal',
        'not a campaign requirement', 'without consuming the items', 'cosmetic only', 'no extra event completion purse']) {
        expect(text).toContain(phrase);
    }
    expect(endgameGoals({ playerLevel: 100 }, { resonancePoints: '<img src=x>' })[3].text).not.toContain('<img');
});

test('rendering has no writes or phantom reward button and disables unavailable navigation', () => {
    document.body.replaceChildren();
    const onRaids = jest.fn();
    appendEndgameGoals(document.body, { playerLevel: 100 }, undefined, { raids: onRaids });
    expect(document.querySelectorAll('[data-endgame-goal]')).toHaveLength(6);
    expect(document.querySelectorAll('button:not(:disabled)')).toHaveLength(2);
    expect(document.body.textContent).toContain('Eligibility unavailable');
    expect(document.body.textContent).toContain('reopen it to refresh');
    document.querySelector('button:not(:disabled)').click();
    expect(onRaids).toHaveBeenCalledTimes(1);
});

test('three-tab guide supports keyboard navigation and normal screen handoffs without starting a run', () => {
    document.body.replaceChildren();
    window.game = { socket: { send: jest.fn() }, network: { send: jest.fn() } };
    const ui = new GuideFixture();
    ui.toggleCharacterSheet = jest.fn(); ui.toggleWorldMap = jest.fn();
    ui.showDungeonMenu({ playerLevel: 100, isLeader: true, darkKingDefeated: true });
    const tabs = [...document.querySelectorAll('[role=tab]')];
    expect(tabs.map(t => t.textContent)).toEqual(['Dungeons', 'Raids', 'Endgame']);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[2]);
    expect(document.getElementById('dungeon-party-state-box').hidden).toBe(true);
    document.querySelector('[data-endgame-goal=repeat-runs] button').click();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('dungeon-party-state-box').hidden).toBe(false);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.activeElement).toBe(tabs[2]);
    const character = document.querySelector('[data-endgame-goal=resonance] button');
    character.click(); character.click();
    expect(ui.toggleCharacterSheet).toHaveBeenCalledTimes(1);
    expect(document.getElementById('dungeon-menu')).toBeNull();
    expect(window.game.socket.send).not.toHaveBeenCalled();
    expect(window.game.network.send).not.toHaveBeenCalled();
});

test('under-cap guide preserves its two-tab keyboard cycle', () => {
    document.body.replaceChildren();
    new GuideFixture().showDungeonMenu({ playerLevel: 30, isLeader: true });
    const tabs = [...document.querySelectorAll('[role=tab]')];
    expect(tabs).toHaveLength(2);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.activeElement).toBe(tabs[1]);
    expect(document.getElementById('adventure-endgame')).toBeNull();
});
