import { jest } from '@jest/globals';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';

function fixture() {
    document.body.innerHTML = '<div id="skill-tree-window"><button id="btn-close-skills"></button><div id="skill-tree-content"></div></div>';
    return new SkillTreeUI({ getLastPlayer: () => ({ level: 30, gold: 1000 }), sendRespec: jest.fn() });
}

afterEach(() => { document.getElementById('respec-menu-backdrop')?.__closeMenu?.(); jest.useRealTimers(); });

test('retired skill owner removes its feedback and cancels both notification stages', () => {
    jest.useFakeTimers(); const old = fixture();
    old.showComboNotification('First', 'first'); old.showComboNotification('Second', 'second');
    jest.advanceTimersByTime(1500);
    old.dispose?.();
    expect(document.querySelectorAll('.combo-notification')).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
});

test('old owner retirement closes its respec listener without closing the replacement menu', () => {
    const old = fixture(); old.showRespecMenu();
    old.dispose?.(); expect(document.getElementById('respec-menu-backdrop')).toBeNull();
    const current = fixture(); current.showRespecMenu();
    const backdrop = document.getElementById('respec-menu-backdrop');
    old.dispose?.(); expect(backdrop.isConnected).toBe(true);
    current.dispose?.(); expect(backdrop.isConnected).toBe(false);
});

test('notification keeps its normal duration and retired callbacks cannot reopen feedback', () => {
    jest.useFakeTimers(); const owner = fixture(); owner.showComboNotification('Normal', 'normal');
    jest.advanceTimersByTime(1499); expect(document.querySelectorAll('.combo-notification')).toHaveLength(1);
    jest.advanceTimersByTime(1); expect(document.querySelectorAll('.combo-notification')).toHaveLength(1);
    jest.advanceTimersByTime(300); expect(document.querySelectorAll('.combo-notification')).toHaveLength(0);
    owner.dispose?.(); owner.showComboNotification('Late', 'late'); owner.showRespecMenu();
    expect(document.querySelectorAll('.combo-notification')).toHaveLength(0);
    expect(document.getElementById('respec-menu-backdrop')).toBeNull(); expect(jest.getTimerCount()).toBe(0);
});
