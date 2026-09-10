import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const recover = jest.fn();
const readResources = jest.fn(), restore = jest.fn();
jest.unstable_mockModule('./e2e/earned-town-rest.js', () => ({ recoverBetweenCollectionEncounters: recover,
    readEarnedRestResources: readResources, restoreEarnedTownResources: restore }));
const { recoverBetweenHuntEncounters, recoverDuringHuntEncounter } = await import('./e2e/earned-hunt-rest.js');
beforeEach(() => jest.clearAllMocks());

test('an explicitly disabled diagnostic never invokes town recovery', async () => {
    expect(await recoverBetweenHuntEncounters({}, { enabled: false, creditedKills: 2 })).toBe(false);
    expect(recover).not.toHaveBeenCalled();
});

const healthy = { hp: 380, maxHP: 380, mana: 260, maxMana: 260, castCost: 30, dead: false, level: 11 };
test('an unfinished resource-starved hunt can Recall before another credited kill', async () => {
    const page = {}, leaveTown = jest.fn(), empty = { ...healthy, mana: 0 };
    readResources.mockResolvedValueOnce(empty);
    restore.mockResolvedValueOnce(true);
    expect(await recoverDuringHuntEncounter(page, { enabled: true, leaveTown })).toBe(true);
    expect(restore).toHaveBeenCalledWith(page, leaveTown, empty, 'mana', { preserveLevel: false });
});
test.each([{ ...healthy, mana: 30 }, { ...healthy, hp: 0, mana: 0, dead: true }])(
    'healthy affordable combat and counted deaths are not disguised as a retreat', async state => {
        readResources.mockResolvedValueOnce(state);
        expect(await recoverDuringHuntEncounter({}, { enabled: true, leaveTown() {} })).toBe(false);
        expect(restore).not.toHaveBeenCalled();
    });
test('no-rest diagnostics never observe or recover an unfinished encounter', async () => {
    expect(await recoverDuringHuntEncounter({}, { enabled: false })).toBe(false);
    expect(readResources).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
});
test('failed mid-encounter Recall is still fatal', async () => {
    readResources.mockResolvedValueOnce({ ...healthy, mana: 0 });
    restore.mockRejectedValueOnce(new Error('recall failed'));
    await expect(recoverDuringHuntEncounter({}, { enabled: true, leaveTown() {} })).rejects.toThrow('recall failed');
});
test('unfinished retreat consumes the same encounter deadline and cannot manufacture credit', () => {
    const route = readFileSync(new URL('./e2e/fresh-story-hunt-route.js', import.meta.url), 'utf8');
    const loop = route.slice(route.indexOf('const deadline = Date.now() + 120_000'));
    expect(loop).toContain('recoverDuringHuntEncounter(page, { enabled: earnedTownRecoveryEnabled(), leaveTown })');
    expect(loop).toContain('while (Date.now() < deadline');
    expect(loop.match(/deadline\s*=/g)).toHaveLength(1);
    expect(loop).toContain('toBeGreaterThan(credit)');
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
