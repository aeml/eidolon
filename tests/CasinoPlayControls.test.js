import { jest } from '@jest/globals';
import { CasinoPlayControls } from '../src/ui/CasinoPlayControls.js';

function setup() {
    let now = 1000; const paused = jest.fn();
    const controls = new CasinoPlayControls(paused, () => now);
    controls.setContext('hero', true);
    return { controls, paused, advance: seconds => { now += seconds * 1000; controls.tick(); } };
}

test('the optional limit starts only with an explicit click and counts smoothly', () => {
    const { controls, advance } = setup();
    controls.minutes.value = '15'; advance(900);
    expect(controls.paused).toBe(false);
    controls.apply.click(); expect(controls.status.textContent).toContain('15:00');
    advance(1); expect(controls.status.textContent).toContain('14:59');
    advance(1); expect(controls.status.textContent).toContain('14:58');
    expect(controls.allows({ action: 'bet' })).toBe(true); controls.dispose();
});

test('a limit pauses once and does not refresh with table or floor updates', () => {
    const { controls, paused, advance } = setup();
    controls.minutes.value = '15'; controls.apply.click(); advance(899);
    controls.setContext('hero', true); advance(1); controls.tick(); controls.tick();
    expect(paused).toHaveBeenCalledTimes(1); expect(controls.paused).toBe(true);
    expect(controls.status.textContent).toContain('limit is reached');
    controls.minutes.value = '0'; controls.apply.click();
    expect(controls.paused).toBe(true); expect(controls.allows({ action: 'bet' })).toBe(false);
    controls.resume.click(); expect(controls.paused).toBe(false); controls.dispose();
});

test.each(['bet', 'poker_buy_in', 'house_bet', 'slot_spin'])('a break blocks a new %s without taking funds', action => {
    const { controls, paused } = setup(); controls.pause.click();
    expect(controls.allows({ action }, { available: true, session: { freeSpins: 0 } })).toBe(false);
    expect(paused).toHaveBeenCalledTimes(1); controls.dispose();
});

test.each(['play', 'poker_play', 'slot_bonus', 'leave', 'get'])('a break preserves funded decisions and recovery: %s', action => {
    const { controls } = setup(); controls.pause.click();
    expect(controls.allows({ action })).toBe(true); controls.dispose();
});

test('saved free spins remain usable but missing or unavailable state cannot authorize a paid spin', () => {
    const { controls } = setup(); controls.pause.click();
    expect(controls.allows({ action: 'slot_spin' }, { available: true, session: { freeSpins: 2 } })).toBe(true);
    for (const view of [null, { available: false, session: { freeSpins: 2 } }, { available: true, session: {} }]) {
        expect(controls.allows({ action: 'slot_spin' }, view)).toBe(false);
    }
    controls.dispose();
});

test('a new session is explicit and neither restarts a queue nor sends a wager', () => {
    const { controls, paused, advance } = setup(); controls.minutes.value = '15'; controls.apply.click();
    advance(900); controls.resume.click();
    expect(controls.status.textContent).toContain('15:00');
    expect(controls.allows({ action: 'bet' })).toBe(true);
    expect(paused).toHaveBeenCalledTimes(1); controls.dispose();
});

test('leaving or changing character clears this visit without carrying another player’s pause', () => {
    const { controls } = setup(); controls.pause.click();
    controls.setContext('hero', true); expect(controls.paused).toBe(true);
    controls.setContext('other', true); expect(controls.paused).toBe(false);
    controls.pause.click(); controls.setContext('other', false);
    expect(controls.paused).toBe(false); expect(controls.limitMinutes).toBe(0); controls.dispose();
});

test('disposed controls cannot apply, resume, pause, or authorize new play', () => {
    const { controls, paused } = setup(); controls.pause.click(); controls.dispose();
    controls.resume.click(); controls.apply.click(); controls.pause.click(); controls.startSession(); controls.tick();
    expect(controls.paused).toBe(true); expect(paused).toHaveBeenCalledTimes(1);
    expect(controls.allows({ action: 'get' })).toBe(false);
});
