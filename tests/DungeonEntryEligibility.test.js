import { jest } from '@jest/globals';
import { installUIManagerDungeon } from '../src/ui/UIManagerDungeon.js';

class MenuFixture {
    constructor(isMobile) { this.isMobile = isMobile; }
    getDungeonDailyQuestEntries() { return []; }
}
installUIManagerDungeon(MenuFixture);

describe.each([false, true])('dungeon entry eligibility (phone=%s)', isMobile => {
    beforeEach(() => {
        document.body.innerHTML = '';
        window.game = { socket: { send: jest.fn() }, network: { send: jest.fn() } };
    });
    afterEach(() => document.getElementById('dungeon-menu-backdrop')?.__closeMenu());
    const open = extra => new MenuFixture(isMobile).showDungeonMenu({ playerLevel: 30, isLeader: true, ...extra });
    const select = value => {
        const control = document.getElementById('dungeon-type-select');
        control.value = value;
        control.dispatchEvent(new Event('change'));
    };
    const button = () => document.getElementById('btn-enter-dungeon');
    const note = () => document.getElementById('dungeon-unlock-note');

    test('explains the first unmet gate without offering locked run levels or sending entry', () => {
        open({ playerLevel: 16, availableRunLevels: [] });
        expect(button().disabled).toBe(true);
        expect(button().style.cursor).toBe('not-allowed');
        expect(note().textContent).toContain('Verdant Bastion Catacombs unlocks at level 30');
        expect(note().textContent).toContain('Your level: 16');
        expect(button().getAttribute('aria-describedby')).toBe('dungeon-unlock-note');
        const levels = document.getElementById('dungeon-run-level-select');
        expect(levels.disabled).toBe(true);
        expect([...levels.options].some(option => Number(option.value) >= 30)).toBe(false);
        button().click();
        button().onclick(); // Guard accidental direct invocation too; server remains authoritative.
        expect(window.game.socket.send).not.toHaveBeenCalled();
        expect(document.getElementById('dungeon-menu')).not.toBeNull();
    });

    test.each([['abyssal_well', 60], ['molten_core', 70], ['tempest_spire', 70]])('updates the family requirement for %s', (type, level) => {
        open();
        expect(button().disabled).toBe(false);
        select(type);
        expect(button().disabled).toBe(true);
        expect(note().textContent).toContain(`unlocks at level ${level}`);
        expect(document.getElementById('difficulty-info-box').textContent).not.toContain('All dungeons unlock');
        select('verdant_bastion_catacombs');
        expect(button().disabled).toBe(false);
        expect(button().title).toBe('');
        expect(button().style.cursor).toBe('pointer');
    });

    test('keeps family eligibility separate from selectable run scaling', () => {
        open({ playerLevel: 60 });
        select('abyssal_well');
        expect(button().disabled).toBe(false);
        expect(document.getElementById('dungeon-run-level-select').value).toBe('30');
        button().click();
        expect(JSON.parse(window.game.socket.send.mock.calls[0][0]).payload).toEqual({
            dungeonType: 'abyssal_well', difficulty: 'normal', runLevel: 30
        });
    });

    test('uses the server-provided family requirements', () => {
        open({ playerLevel: 60, dungeonEntryLevels: { abyssal_well: 65 } });
        select('abyssal_well');
        expect(button().disabled).toBe(true);
        expect(note().textContent).toContain('unlocks at level 65');
        expect(document.querySelector('option[value="abyssal_well"]').innerText).toContain('Lv 65+');
    });

    test('preserves leader and existing-run restrictions', () => {
        open({ playerLevel: 100, isLeader: false });
        expect(button().disabled).toBe(true);
        expect(note().textContent).toContain('party leader');
        open({ playerLevel: 30, isLeader: false, hasInstance: true,
            activeRun: { dungeonType: 'abyssal_well', difficulty: 'normal', runLevel: 60 } });
        expect(button().disabled).toBe(true);
        expect(note().textContent).toContain('unlocks at level 60');
        open({ playerLevel: 60, isLeader: false, hasInstance: true,
            activeRun: { dungeonType: 'abyssal_well', difficulty: 'normal', runLevel: 60 } });
        expect(button().disabled).toBe(false);
    });
});
