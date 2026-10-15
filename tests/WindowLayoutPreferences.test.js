import { jest } from '@jest/globals';
import { WindowLayoutPreferences } from '../src/ui/WindowLayoutPreferences.js';

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test.each(['{broken', 'null', '{"version":2,"wide":{"shop":{"left":30,"top":40}}}',
    '{"version":1,"wide":{"shop":{"left":"30","top":40},"character":{"left":1e20,"top":40}}}'])('ignores malformed, unsupported or invalid saved coordinates: %s', input => {
    localStorage.setItem('eidolon.windowLayout.v1', input);
    expect(new WindowLayoutPreferences().get('shop', 'wide')).toBeUndefined();
});

test('unavailable storage still remembers positions for the current UI session', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
    const preferences = new WindowLayoutPreferences();
    preferences.remember('inventory', 'wide', { left: 80, top: 120 });
    expect(preferences.get('inventory', 'wide')).toEqual({ left: 80, top: 120 });
    expect(() => preferences.reset()).not.toThrow();
    expect(preferences.get('inventory', 'wide')).toBeUndefined();
});
