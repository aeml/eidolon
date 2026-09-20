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

test('the earned Wizard can continue into Normal60 Abyssal with the same four-role route', () => {
    expect(earnedPartyContinuationEnabled(env, { ...route, dungeonType: 'abyssal_well', runLevel: 60 })).toBe(true);
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
    [env, { ...route, dungeonType: 'molten_core' }, false]
])('refuses unrelated encounters or missing earned provenance', (settings, encounter, raid) => {
    expect(() => earnedPartyContinuationEnabled(settings, encounter, raid)).toThrow('private earned checkpoint');
});
