import { earnedPartyContinuationEnabled } from './partyDungeonFixture.js';

const env = { EIDOLON_E2E_EARNED_PARTY: '1', EIDOLON_E2E_EARNED_RESUME: '1', EIDOLON_E2E_EARNED_CHECKPOINT: '/tmp/eidolon-private/save.archive.gz' };
const route = { dungeonType: 'verdant_bastion_catacombs', difficulty: 'normal', runLevel: 30 };

test('existing prepared party runs remain unchanged without the explicit earned option', () => {
    expect(earnedPartyContinuationEnabled({}, route)).toBe(false);
    expect(earnedPartyContinuationEnabled({}, null, true)).toBe(false);
    expect(earnedPartyContinuationEnabled({ ...env, EIDOLON_E2E_EARNED_PARTY: '0' }, route)).toBe(false);
});

test('the earned Wizard can join three prepared roles for the actual Earth dungeon', () => {
    expect(earnedPartyContinuationEnabled(env, route)).toBe(true);
});

test.each([['abyssal_well', 60], ['molten_core', 70], ['tempest_spire', 70], ['umbral_nexus', 100]])(
    'the earned Wizard can continue into Normal %s/%i with the same four-role route', (dungeonType, runLevel) => {
    expect(earnedPartyContinuationEnabled(env, { ...route, dungeonType, runLevel })).toBe(true);
});

test.each([['earth_crystal_raid', 30], ['water_crystal_raid', 60], ['fire_crystal_raid', 70],
    ['air_crystal_raid', 70], ['weekly_raid', 100]])('earned %s requires its actual raid entry selection', (dungeonType, runLevel) => {
    const encounter = { dungeonType, runLevel, difficulty: dungeonType === 'weekly_raid' ? 'mythic' : 'normal' };
    expect(earnedPartyContinuationEnabled(env, encounter, true)).toBe(true);
    expect(() => earnedPartyContinuationEnabled(env, encounter, false)).toThrow();
    expect(() => earnedPartyContinuationEnabled(env, { ...encounter, runLevel: runLevel + 1 }, true)).toThrow();
    expect(() => earnedPartyContinuationEnabled(env, { ...encounter, difficulty: 'heroic' }, true)).toThrow();
    expect(() => earnedPartyContinuationEnabled({ ...env, EIDOLON_E2E_EARNED_CHECKPOINT: '' }, encounter, true)).toThrow();
});

test.each([
    [{ ...env, EIDOLON_E2E_EARNED_PARTY: 'yes' }, route, false],
    [{ ...env, EIDOLON_E2E_EARNED_RESUME: undefined }, route, false],
    [{ ...env, EIDOLON_E2E_EARNED_CHECKPOINT: '' }, route, false],
    [env, null, true], [env, route, true],
    [env, { ...route, difficulty: 'mythic' }, false],
    [env, { ...route, runLevel: 100 }, false],
    [env, { ...route, dungeonType: 'abyssal_well' }, false],
    [env, { ...route, dungeonType: 'abyssal_well', runLevel: 70 }, false],
    [env, { ...route, dungeonType: 'abyssal_well', runLevel: 60, difficulty: 'heroic' }, false],
    [env, { ...route, dungeonType: 'molten_core' }, false],
    [env, { ...route, dungeonType: 'umbral_nexus', runLevel: 70 }, false],
    [env, { ...route, dungeonType: 'umbral_nexus', runLevel: 100, difficulty: 'mythic' }, false]
])('refuses unrelated encounters or missing earned provenance', (settings, encounter, raid) => {
    expect(() => earnedPartyContinuationEnabled(settings, encounter, raid)).toThrow('private earned checkpoint');
});
