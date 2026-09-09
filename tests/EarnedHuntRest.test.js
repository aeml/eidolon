import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const recover = jest.fn();
jest.unstable_mockModule('./e2e/earned-town-rest.js', () => ({ recoverBetweenCollectionEncounters: recover }));
const { recoverBetweenHuntEncounters } = await import('./e2e/earned-hunt-rest.js');
beforeEach(() => jest.clearAllMocks());

test('an explicitly disabled diagnostic never invokes town recovery', async () => {
    expect(await recoverBetweenHuntEncounters({}, { enabled: false, creditedKills: 2 })).toBe(false);
    expect(recover).not.toHaveBeenCalled();
});
test('no extra rest stop before the first credited encounter', async () => {
    expect(await recoverBetweenHuntEncounters({}, { enabled: true, creditedKills: 0, leaveTown() {} })).toBe(false);
    expect(recover).not.toHaveBeenCalled();
});
test('credited encounters delegate to the existing real-resource recovery policy', async () => {
    const page = {}, leaveTown = jest.fn();
    recover.mockResolvedValue(true);
    expect(await recoverBetweenHuntEncounters(page, { enabled: true, creditedKills: 2, leaveTown })).toBe(true);
    expect(recover).toHaveBeenCalledWith(page, leaveTown);
});
test('a failed real recovery remains a route failure', async () => {
    recover.mockRejectedValue(new Error('town not reached'));
    await expect(recoverBetweenHuntEncounters({}, { enabled: true, creditedKills: 2, leaveTown() {} }))
        .rejects.toThrow('town not reached');
});
test.each([-1, NaN, 1.5])('malformed credit %s is not an earned encounter', async creditedKills => {
    await expect(recoverBetweenHuntEncounters({}, { enabled: true, creditedKills, leaveTown() {} }))
        .rejects.toThrow('Invalid earned hunt credit');
    expect(recover).not.toHaveBeenCalled();
});
test('enabled comparison cannot silently omit ordinary departure', async () => {
    await expect(recoverBetweenHuntEncounters({}, { enabled: true, creditedKills: 2 }))
        .rejects.toThrow('ordinary town departure');
});
test('normal rest is outside the unchanged credit watchdog; no-rest diagnostics are explicit', () => {
    const route = readFileSync(new URL('./e2e/fresh-story-hunt-route.js', import.meta.url), 'utf8');
    const loop = route.slice(route.indexOf('while ((await readChronicleChapter'));
    expect(loop.indexOf('recoverBetweenHuntEncounters(')).toBeGreaterThan(-1);
    expect(loop.indexOf('const deadline = Date.now() + 120_000')).toBeGreaterThan(-1);
    expect(loop.indexOf('recoverBetweenHuntEncounters(')).toBeLessThan(loop.indexOf('const deadline = Date.now() + 120_000'));
    expect(loop.slice(loop.indexOf('const deadline = Date.now() + 120_000'))).not.toContain('recoverBetweenHuntEncounters(');
    const shell = readFileSync(new URL('../scripts/run-isolated-character-qa.sh', import.meta.url), 'utf8');
    expect(route).toContain('enabled: earnedTownRecoveryEnabled()');
    expect(shell.match(/fresh-story-uninterrupted\)[\s\S]*?;;/)[0]).not.toContain('EIDOLON_E2E_REST_RECOVERY=0');
    expect(shell.match(/fresh-rested-story-uninterrupted\)[\s\S]*?;;/)[0]).toContain('EIDOLON_E2E_REST_RECOVERY=1');
    expect(shell.match(/fresh-story-no-rest-uninterrupted\)[\s\S]*?;;/)[0]).toContain('EIDOLON_E2E_REST_RECOVERY=0');
});
