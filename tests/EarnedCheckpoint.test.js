import { jest } from '@jest/globals';

const login = jest.fn();
jest.unstable_mockModule('./e2e/helpers.js', () => ({ loginAndEnterWorld: login }));
const { earnedCheckpoint, uninterruptedEarnedMode } = await import('./e2e/earned-checkpoint.js');
const uninterrupted = { EIDOLON_E2E_UNINTERRUPTED: '1', EIDOLON_E2E_FRESH_STORY_HUNT: '1' };

beforeEach(() => {
    login.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('persistence remains the default; uninterrupted mode must explicitly name its supported route', () => {
    expect(uninterruptedEarnedMode({})).toBe(false);
    expect(uninterruptedEarnedMode({ EIDOLON_E2E_UNINTERRUPTED: '0' })).toBe(false);
    expect(uninterruptedEarnedMode(uninterrupted)).toBe(true);
    expect(() => uninterruptedEarnedMode({ EIDOLON_E2E_UNINTERRUPTED: '1' })).toThrow('only opening');
    expect(() => uninterruptedEarnedMode({ EIDOLON_E2E_UNINTERRUPTED: 'true' })).toThrow('0 or 1');
});

test.each(['FRESH_COLLECTION', 'FRESH_HUNT', 'FRESH_READY', 'FRESH_DUNGEON', 'FRESH_EARLY_PREPARATION'])(
    '%s cannot silently mix reloading subroutes into an uninterrupted run', name => {
        expect(() => uninterruptedEarnedMode({ ...uninterrupted, [`EIDOLON_E2E_${name}`]: '1' })).toThrow('only opening');
    });

test.each([
    { label: 'opening', final: false, env: uninterrupted, reconnect: false },
    { label: 'diary', final: false, env: uninterrupted, reconnect: false },
    { label: 'Watch', final: true, env: uninterrupted, reconnect: true },
    { label: 'opening', final: false, env: {}, reconnect: true }
])('$label final=$final reconnect=$reconnect keeps the intended checkpoint behavior', async settings => {
    const before = { hp: 60, maxHP: 100, mana: 7, maxMana: 100 };
    const after = settings.reconnect ? { ...before, hp: 100, mana: 100 } : before;
    const page = { evaluate: jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after), reload: jest.fn() };
    const credentials = { username: 'test-only', password: 'not-a-real-credential' };
    expect(await earnedCheckpoint(page, credentials, settings)).toBe(settings.reconnect);
    // The real login helper owns fresh navigation; the checkpoint must not
    // add a second reload outside that helper's readiness/failure scope.
    expect(page.reload).not.toHaveBeenCalled();
    expect(login).toHaveBeenCalledTimes(settings.reconnect ? 1 : 0);
    if (settings.reconnect) expect(login).toHaveBeenCalledWith(page, credentials);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`"reconnect":${settings.reconnect}`));
    expect(console.log.mock.calls[0][0]).not.toContain(credentials.password);
});
