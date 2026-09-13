import { jest } from '@jest/globals';
import { appendDungeonPreparation, CRYSTAL_VIGIL_PREPARATION, weeklyRaidRewardText } from '../src/ui/DungeonPreparation.js';
import { installUIManagerDungeon } from '../src/ui/UIManagerDungeon.js';

class MenuFixture { getDungeonDailyQuestEntries() { return []; } }
installUIManagerDungeon(MenuFixture);

afterEach(() => document.getElementById('dungeon-menu-backdrop')?.__closeMenu());

test('preparation covers all four roles and distinct ritual jobs without blocking class choice', () => {
    document.body.replaceChildren();
    appendDungeonPreparation(document.body);
    const guide = document.querySelector('details');
    expect(guide.open).toBe(false);
    for (const phrase of ['Strong Fighter', 'Agile Rogue', 'Brilliant Wizard', 'Wise Cleric', 'not class-entry restrictions', '5–10', '5 minutes', 'current wave']) {
        expect(guide.textContent).toContain(phrase);
    }
    expect(new Set(Object.values(CRYSTAL_VIGIL_PREPARATION)).size).toBe(4);
});

test.each(['available', 'claimed', 'unknown'])('weekly %s cache advice separates reward eligibility from entry', status => {
    const text = weeklyRaidRewardText({ status, resetsAt: '2026-09-14T00:00:00Z' });
    expect(text).toContain('2026-09-14 00:00 UTC');
    expect(text).toContain('does not reset this reward limit');
    if (status === 'unknown') expect(text).toContain('Do not assume');
    if (status === 'claimed') expect(text).toContain('still enter and help');
});

test('desktop reset is deliberate and cancellation keeps the existing run', () => {
    document.body.replaceChildren();
    window.game = { socket: { send: jest.fn() }, network: { send: jest.fn() } };
    new MenuFixture().showDungeonMenu({ playerLevel: 100, isLeader: true, hasInstance: true, darkRealmOpen: true,
        elementalRaidAccess: { air_crystal_raid: true }, weeklyRaidReward: { status: 'claimed' } });
    expect(document.querySelector('[data-weekly-raid-reward="claimed"]').textContent).toContain('still enter and help');
    expect(document.querySelector('[data-raid-type="air_crystal_raid"]').textContent).toContain('Wind relay');
    const reset = document.getElementById('btn-reset-dungeon');
    reset.click();
    expect(window.game.socket.send).not.toHaveBeenCalled();
    const confirmation = document.getElementById('dungeon-reset-confirm');
    const [cancel, confirm] = confirmation.querySelectorAll('button');
    expect(cancel.id).toBe('btn-cancel-dungeon-reset');
    expect(confirm.id).toBe('btn-confirm-dungeon-reset');
    cancel.click();
    expect(confirmation.hidden).toBe(true);
    expect(document.activeElement).toBe(reset);
    reset.click(); confirm.click();
    expect(window.game.socket.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.game.socket.send.mock.calls[0][0])).toEqual({ type: 'reset_dungeon', payload: {} });
});
