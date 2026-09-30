import { jest } from '@jest/globals';
import { createMotionPreference, prefersReducedMotion } from '../src/core/MotionPreference.js';
import { installUIManagerSettings } from '../src/ui/UIManagerSettings.js';

class SettingsFixture {}
installUIManagerSettings(SettingsFixture);
const previousMatchMedia = globalThis.matchMedia;
afterEach(() => { globalThis.matchMedia = previousMatchMedia; delete document.documentElement.dataset.reducedMotion; localStorage.clear(); });

test('manual reduction updates existing live consumers without listeners or storage reads', () => {
    globalThis.matchMedia = jest.fn(() => ({ matches: false }));
    const preference = createMotionPreference();
    const ui = new SettingsFixture();
    expect(preference.matches).toBe(false);
    ui.setMotionPreference('reduced');
    expect(preference.matches).toBe(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(localStorage.getItem('eidolon.motionPreference')).toBe('reduced');
    ui.setMotionPreference('system'); expect(preference.matches).toBe(false);
});

test('system mode never overrides a device request, including a later device change', () => {
    const system = { matches: false };
    globalThis.matchMedia = jest.fn(() => system);
    const preference = createMotionPreference();
    const ui = new SettingsFixture(); ui.setMotionPreference('system');
    system.matches = true; expect(preference.matches).toBe(true);
    system.matches = false; expect(preference.matches).toBe(false);
});

test('missing browser APIs do not prevent manual reduction', () => {
    globalThis.matchMedia = undefined;
    const ui = new SettingsFixture(); ui.setMotionPreference('reduced', { save: false });
    expect(prefersReducedMotion()).toBe(true);
    expect(localStorage.getItem('eidolon.motionPreference')).toBeNull();
});
