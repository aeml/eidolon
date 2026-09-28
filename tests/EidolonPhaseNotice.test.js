import { jest } from '@jest/globals';
import { EidolonPhaseNotice } from '../src/ui/EidolonPhaseNotice.js';
import { installUIManagerFeedback } from '../src/ui/UIManagerFeedback.js';

class Feedback {}
installUIManagerFeedback(Feedback);
let ui;
beforeEach(() => {
    jest.useFakeTimers();
    document.body.className = '';
    document.body.innerHTML = '<div id="combat-intent-panel" style="top:232px;right:20px;width:280px"><span id="name"></span></div>';
    ui = new Feedback();
    ui.combatIntentPanel = document.getElementById('combat-intent-panel');
    ui.combatIntentName = document.getElementById('name');
});
afterEach(() => { ui.clearEidolonPhaseNotice(); jest.clearAllTimers(); jest.useRealTimers(); });
const phase = (n = 1) => ({ phase: n, eidolon: ['Orun', 'Neris', 'Pyralis', 'Aeral'][n - 1] });

test('phase notice survives target updates, clearing and immediate danger feedback', () => {
    ui.showEidolonPhaseNotice(phase());
    const notice = document.querySelector('.eidolon-phase-notice');
    ui.updateCombatIntent({ entityId: 'king', name: 'Malachar', distance: 2, status: 'in_range' });
    expect(ui.combatIntentName.textContent).toBe('Malachar');
    ui.showCombatCallout({ title: 'LEAVE THE CIRCLE', duration: 2 });
    expect(ui.combatIntentName.textContent).toBe('LEAVE THE CIRCLE');
    ui.clearCombatIntent();
    jest.advanceTimersByTime(7999);
    expect(notice.isConnected).toBe(true);
    expect(notice.textContent).toContain('King deals 20% less damage');
    jest.advanceTimersByTime(1);
    expect(notice.isConnected).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
});

test('four received phases replace rather than queue obsolete notices', () => {
    for (let n = 1; n <= 4; n++) {
        ui.showEidolonPhaseNotice(phase(n));
        expect(document.querySelectorAll('.eidolon-phase-notice')).toHaveLength(1);
        expect(document.querySelector('.eidolon-phase-notice').textContent).toContain(`${n}/4`);
        jest.advanceTimersByTime(1000);
    }
    expect(document.querySelector('.eidolon-phase-notice').textContent).toContain('Aeral restores mana');
    expect(document.querySelector('.eidolon-phase-notice').textContent).not.toMatch(/victory|defeated/i);
    expect(jest.getTimerCount()).toBe(1);
});

test.each(['death', 'reconnecting', 'lost', 'leave'])('%s clears notices and owned timers', reason => {
    ui.showEidolonPhaseNotice(phase());
    if (reason === 'death') ui.showDeathScreen();
    else if (reason === 'leave') ui.clearEidolonPhaseNotice();
    else ui.setConnectionState(reason);
    expect(document.querySelector('.eidolon-phase-notice')).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
});

test('invalid phase and unavailable anchor create no notices or timers', () => {
    ui.showEidolonPhaseNotice({ phase: 9 });
    new EidolonPhaseNotice(null).show(phase());
    expect(document.querySelector('.eidolon-phase-notice')).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
});

test('the notice follows the actual combat card footprint without accepting HTML', () => {
    ui.combatIntentPanel.getBoundingClientRect = () => ({ width: 230, height: 90, bottom: 156 });
    ui.showEidolonPhaseNotice({ phase: 1, eidolon: '<img src=x>' });
    const notice = document.querySelector('.eidolon-phase-notice');
    expect(notice.style.top).toBe('164px');
    expect(notice.style.width).toBe('230px');
    expect(notice.querySelector('img')).toBeNull();
});

test('phone aid occupies the tracker reservation and restores it when the notice ends', () => {
    document.body.classList.add('mobile-mode');
    const objectives = document.createElement('div');
    objectives.id = 'objectives-panel';
    objectives.textContent = 'My tracked quest';
    objectives.getBoundingClientRect = () => ({ width: 214, left: 205, top: 12 });
    document.body.append(objectives);
    ui.showEidolonPhaseNotice(phase(4));
    const notice = document.querySelector('.eidolon-phase-notice');
    expect(notice.style.left).toBe('205px');
    expect(notice.style.top).toBe('12px');
    expect(notice.querySelectorAll('.eidolon-phase-notice__compact')[1].textContent).toBe('Mana restored · damage +35%');
    expect(document.body.classList.contains('eidolon-aid-visible')).toBe(true);
    jest.advanceTimersByTime(8000);
    expect(document.body.classList.contains('eidolon-aid-visible')).toBe(false);
    expect(objectives.textContent).toBe('My tracked quest');
});
