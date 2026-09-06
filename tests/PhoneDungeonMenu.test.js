import { jest } from '@jest/globals';
import { installUIManagerDungeon } from '../src/ui/UIManagerDungeon.js';

class MenuFixture {
    constructor() {
        this.isMobile = true;
        this.chat = { setMobileExpanded: jest.fn() };
        this.isEscMenuOpen = true;
        this.toggleEscMenu = jest.fn(() => { this.isEscMenuOpen = false; });
    }
    getDungeonDailyQuestEntries() { return []; }
}
installUIManagerDungeon(MenuFixture);

describe('phone adventure composition', () => {
    let ui;
    beforeEach(() => {
        document.body.innerHTML = '<button id="opener">Guide</button>';
        document.getElementById('opener').focus();
        window.game = { socket: { send: jest.fn() }, network: { send: jest.fn() } };
        ui = new MenuFixture();
    });
    afterEach(() => document.getElementById('dungeon-menu-backdrop')?.__closeMenu());
    const open = (ui, extra = {}) => ui.showDungeonMenu({ playerLevel: 100, isLeader: true, hasInstance: false, ...extra });

    test('keeps entry outside reading scroll, with a summary that follows actual selections', () => {
        open(ui);
        const footer = document.querySelector('.phone-adventure-actions');
        expect(footer).not.toBeNull();
        expect(footer.closest('.adventure-scroll')).toBeNull();
        const select = document.getElementById('dungeon-type-select');
        select.value = 'abyssal_well'; select.onchange();
        const level = document.getElementById('dungeon-run-level-select');
        level.value = '60'; level.onchange();
        document.getElementById('diff-btn-heroic').click();
        expect(footer.textContent).toContain('Abyssal Well · Heroic · Level 60');
        document.getElementById('btn-enter-dungeon').click();
        expect(JSON.parse(window.game.socket.send.mock.calls[0][0])).toEqual({
            type: 'enter_dungeon', payload: { dungeonType: 'abyssal_well', difficulty: 'heroic', runLevel: 60 }
        });
        expect(document.activeElement.id).toBe('opener');
    });

    test('preserves each tab reading position and hides dungeon entry while reading raids', () => {
        open(ui);
        const scroll = document.querySelector('.adventure-scroll');
        scroll.scrollTop = 240;
        document.getElementById('adventure-raids-tab').click();
        expect(document.querySelector('.phone-adventure-actions').hidden).toBe(true);
        scroll.scrollTop = 480;
        document.getElementById('adventure-dungeons-tab').click();
        expect(scroll.scrollTop).toBe(240);
        expect(document.querySelector('.phone-adventure-actions').hidden).toBe(false);
        document.getElementById('adventure-raids-tab').click();
        expect(scroll.scrollTop).toBe(480);
    });

    test('reset requires a deliberate confirmation, cancel preserves the run and refocuses Reset', () => {
        open(ui, { hasInstance: true });
        const reset = document.getElementById('btn-reset-dungeon');
        reset.click();
        expect(window.game.socket.send).not.toHaveBeenCalled();
        expect(document.getElementById('phone-dungeon-reset-confirm').textContent).toContain('progress');
        document.getElementById('btn-cancel-dungeon-reset').click();
        expect(window.game.socket.send).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(reset);
        reset.click(); document.getElementById('btn-confirm-dungeon-reset').click();
        expect(window.game.socket.send).toHaveBeenCalledTimes(1);
        expect(JSON.parse(window.game.socket.send.mock.calls[0][0])).toEqual({ type: 'reset_dungeon', payload: {} });
        expect(document.getElementById('dungeon-menu')).toBeNull();
    });

    test('does not offer a reset when there is no instance', () => {
        open(ui);
        expect(document.getElementById('btn-reset-dungeon')).toBeNull();
    });

    test('continues a follower’s exact run without exposing reset or changing parameters', () => {
        open(ui, { hasInstance: true, isLeader: false,
            activeRun: { dungeonType: 'molten_core', difficulty: 'heroic', runLevel: 70 } });
        expect(document.getElementById('btn-reset-dungeon')).toBeNull();
        expect(document.getElementById('dungeon-type-select').disabled).toBe(true);
        expect(document.querySelector('.phone-adventure-summary').textContent).toContain('Molten Core · Heroic · Level 70');
        document.getElementById('btn-enter-dungeon').click();
        expect(JSON.parse(window.game.socket.send.mock.calls[0][0]).payload).toEqual({ dungeonType: 'molten_core', difficulty: 'heroic', runLevel: 70 });
    });

    test('replaces the pause menu, collapses chat and exposes a clean close hook for chat expansion', () => {
        open(ui);
        expect(ui.toggleEscMenu).toHaveBeenCalledTimes(1);
        expect(ui.chat.setMobileExpanded).toHaveBeenCalledWith(false);
        expect(typeof ui.phoneDungeonMenuClose).toBe('function');
        ui.phoneDungeonMenuClose();
        expect(ui.phoneDungeonMenuClose).toBeNull();
        expect(document.getElementById('dungeon-menu')).toBeNull();
    });

    test('retains story and leader gates rather than granting access for the layout', () => {
        open(ui, { isLeader: false, elementalRaidAccess: { earth_crystal_raid: true } });
        expect(document.getElementById('btn-enter-dungeon').disabled).toBe(true);
        const earth = document.querySelector('[data-raid-type="earth_crystal_raid"]');
        expect([...earth.querySelectorAll('button')].every(b => b.disabled)).toBe(true);
        expect(document.querySelector('[data-raid-type="water_crystal_raid"]').dataset.access).toBe('sealed');
        expect(document.querySelector('#dungeon-type-select option[value="umbral_nexus"]')).toBeNull();
    });
});
