import { jest } from '@jest/globals';
import { installUIManagerFeedback } from '../src/ui/UIManagerFeedback.js';

class Feedback {}
installUIManagerFeedback(Feedback);
let ui;
beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="panel"><span id="name"></span><span id="status"></span></div>';
    ui = new Feedback();
    ui.combatIntentPanel = document.getElementById('panel');
    ui.combatIntentName = document.getElementById('name');
    ui.combatIntentStatus = document.getElementById('status');
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
const intent = { entityId: 'enemy', name: 'Skeleton', status: 'in_range', distance: 2 };

test('a level-up notice expires without another target or movement update', () => {
    ui.showCombatCallout({ title: 'Level 30 Reached', duration: 2.8 });
    jest.advanceTimersByTime(2799);
    expect(ui.combatIntentPanel.style.display).toBe('block');
    jest.advanceTimersByTime(1);
    expect(ui.combatIntentPanel.style.display).toBe('none');
});
test('expiry restores the selected target and clears warning styling', () => {
    ui.updateCombatIntent(intent);
    ui.showCombatCallout({ title: 'Level up', tone: 'boss', duration: 2 });
    jest.advanceTimersByTime(2000);
    expect(ui.combatIntentName.textContent).toBe('Skeleton');
    expect(ui.combatIntentPanel.dataset.calloutTone).toBeUndefined();
});
test('a replacement callout keeps its own full lifetime', () => {
    ui.showCombatCallout({ title: 'First', duration: 2 });
    jest.advanceTimersByTime(1000);
    ui.showCombatCallout({ title: 'Second', duration: 4 });
    jest.advanceTimersByTime(1000);
    expect(ui.combatIntentName.textContent).toBe('Second');
    jest.advanceTimersByTime(3000);
    expect(ui.combatIntentPanel.style.display).toBe('none');
});
test('selecting the same target again replaces a notice without stale timer interference', () => {
    ui.updateCombatIntent(intent);
    ui.showCombatCallout({ title: 'Warning', duration: 2 });
    ui.updateCombatIntent(intent);
    expect(ui.combatIntentName.textContent).toBe('Skeleton');
    jest.advanceTimersByTime(2500);
    expect(ui.combatIntentPanel.style.display).toBe('block');
});
test('clearing a target during a notice cannot resurrect it on expiry', () => {
    ui.updateCombatIntent(intent);
    ui.showCombatCallout({ title: 'Warning', duration: 2 });
    ui.clearCombatIntent();
    jest.advanceTimersByTime(2500);
    expect(ui.combatIntentPanel.style.display).toBe('none');
    expect(jest.getTimerCount()).toBe(0);
});
test.each([undefined, 0, -1, NaN, Infinity])('invalid or absent lifetime %s has a finite readable fallback', duration => {
    ui.showCombatCallout({ title: 'Notice', duration });
    jest.advanceTimersByTime(4000);
    expect(ui.combatIntentPanel.style.display).toBe('none');
});
