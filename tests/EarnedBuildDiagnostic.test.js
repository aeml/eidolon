import { readFileSync } from 'node:fs';
import { earnedBuildCharacter, requireIsolatedBuildFixture } from './earnedBuildDiagnostic.js';
const record = JSON.parse(readFileSync('tests/fixtures/earned-wizard-31.json', 'utf8'));

test('recorded level31 stats, gear and training survive fixture conversion without grants', () => {
    const original = JSON.stringify(record), c = earnedBuildCharacter(record, 'disposable');
    expect(c).toMatchObject({ level: 31, progression_version: 2, xp: 10652, gold: 22432,
        stats: { strength: 70, intelligence: 40, dexterity: 40, wisdom: 40, vitality: 70 },
        talent_ranks: { WIZ_01: 5 }, selected_branch: 'C', inventory: [], stash: [] });
    for (const [slot, item] of Object.entries(record.equipment)) {
        expect(c.equipment[slot]).toMatchObject({ id: item.id, stats: item.stats, level: item.level,
            rarity: item.rarity.name, stat_scale_version: 1 });
    }
    expect(c.quests.at(-1)).toMatchObject({ id: 'chronicle_03_roots_remember', completed: false, count: 0 });
    c.equipment.mainHand.stats.damage = 999;
    c.quests[0].completed = false;
    expect(JSON.stringify(record)).toBe(original);
    expect(c.resources).toBeUndefined();
    expect(c.well_rested).toBeUndefined();
});

test('unknown records are not silently treated as the original failed build', () => {
    expect(() => earnedBuildCharacter({ ...record, level: 100 }, 'disposable')).toThrow();
});

const env = { EIDOLON_E2E_BUILD_MONGO_CONTAINER: 'eidolon-isolated-qa-mongo-recorded-build',
    EIDOLON_E2E_BUILD_MONGO_PORT: '18581', EIDOLON_E2E_REGISTER: '1',
    EIDOLON_E2E_EARNED_BUILD_DIAGNOSTIC: '1', EIDOLON_E2E_WS_URL: 'ws://127.0.0.1:18580/ws' };
test('only the explicit disposable route can seed the diagnostic', () => {
    expect(() => requireIsolatedBuildFixture(env)).not.toThrow();
    for (const key of Object.keys(env)) expect(() => requireIsolatedBuildFixture({ ...env, [key]: '' })).toThrow();
    expect(() => requireIsolatedBuildFixture({ ...env, EIDOLON_E2E_WS_URL: 'wss://eserver.mendola.tech/ws' })).toThrow();
});
