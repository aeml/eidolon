import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, loginAndEnterWorld } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const characterClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
    test(`${characterClass} creation and explicit QA leveling share ordinary base stats across login`, async ({ page, baseURL }) => {
        test.skip(process.env.EIDOLON_E2E_INITIAL_STAT_PARITY !== '1', 'Explicit disposable creation/QA parity diagnostic');
        expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
        expect(process.env.EIDOLON_E2E_WS_URL).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/ws$/);
        const base = credentialsFromEnvironment();
        const credentials = { ...base, characterClass, username: `${base.username}-baseline-${characterClass.toLowerCase()}` };
        const failures = collectBrowserFailures(page, baseURL);
        const read = () => page.evaluate(() => ({ className: window.game.player.constructor.name,
            level: window.game.player.level, baseStats: window.game.player.baseStats }));
        await loginAndEnterWorld(page, credentials);
        const initial = { className: characterClass, level: 1,
            baseStats: { strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, vitality: 10 } };
        expect(await read()).toEqual(initial);
        await loginAndEnterWorld(page, credentials);
        expect(await read()).toEqual(initial);
        // Deliberate QA-only level override, not earned leveling or a campaign
        // result. Ordinary XP growth parity is independently tested in Go.
        await ensureDungeonReadyLevel(page, 30);
        const prepared = { className: characterClass, level: 30,
            baseStats: { strength: 68, dexterity: 39, intelligence: 39, wisdom: 39, vitality: 68 } };
        expect(await read()).toEqual(prepared);
        await loginAndEnterWorld(page, credentials);
        expect(await read()).toEqual(prepared);
        console.log('[initial-stat-parity]', JSON.stringify({ initial, prepared, note: 'Explicit QA level override; not earned progression' }));
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
