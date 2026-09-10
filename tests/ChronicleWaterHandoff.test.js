import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';

const poll = jest.fn(read => ({ toEqual: async expected => expect(await read()).toEqual(expected) }));
jest.unstable_mockModule('@playwright/test', () => ({ expect: Object.assign(
    (...args) => expect(...args), { poll }) }));
const { verifyFreshWaterHandoff } = await import('./e2e/chronicle-water-handoff.js');
const ferry = () => ({ id: 'chronicle_water_missing_ferry', accepted: false, completed: false, count: 0 });
const page = { evaluate: (fn, argument) => fn(argument) };
afterEach(() => { delete window.game; jest.clearAllMocks(); });

test('fresh Earth completion offers the authored ferry hunt before the flood shelter', async () => {
    expect(chronicleHunts.find(hunt => hunt.id === ferry().id)).toMatchObject({
        previousQuestId: 'chronicle_03_roots_remember', beforeQuestId: 'chronicle_water_flood_shelter', realm: 'water'
    });
    const quests = Object.freeze([Object.freeze({ id: 'chronicle_03_roots_remember', completed: true }),
        Object.freeze(ferry()), Object.freeze({ id: 'daily_skeletons', accepted: false })]);
    window.game = { player: { quests } };
    await verifyFreshWaterHandoff(page);
    expect(window.game.player.quests).toBe(quests);
    expect(poll).toHaveBeenCalledTimes(1);
});

test.each([
    [], [{ id: 'chronicle_water_flood_shelter', accepted: false, completed: false, count: 0 }],
    [{ ...ferry(), accepted: true }], [{ ...ferry(), completed: true }], [{ ...ferry(), count: 1 }],
    [ferry(), { id: 'chronicle_water_flood_shelter', accepted: false, completed: false, count: 0 }]
].map(quests => ({ quests })))('missing, auto-accepted or skipped Water progress fails verification: %j', async ({ quests }) => {
    window.game = { player: { quests } };
    await expect(verifyFreshWaterHandoff(page)).rejects.toThrow();
});

test('dungeon turn-in verifies Water both after the manual claim and after login', () => {
    const source = readFileSync('tests/e2e/chronicle-earth-route.js', 'utf8')
        .split('export async function verifyEarthDungeonChronicleTurnIn')[1];
    const claim = source.indexOf('await claimChapterAndContinue(page, EARTH_DUNGEON_CHAPTER)');
    const first = source.indexOf('await verifyFreshWaterHandoff(page)');
    const login = source.indexOf('await loginAndEnterWorld(page, credentials)');
    const last = source.lastIndexOf('await verifyFreshWaterHandoff(page)');
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(first).toBeGreaterThan(claim);
    expect(login).toBeGreaterThan(first);
    expect(last).toBeGreaterThan(login);
    expect(source).not.toContain('chronicle_water_flood_shelter');
});
