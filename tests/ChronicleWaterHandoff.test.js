import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { chronicleExpeditions } from '../src/data/chronicleExpeditions.generated.js';

const poll = jest.fn(read => ({ toEqual: async expected => expect(await read()).toEqual(expected) }));
jest.unstable_mockModule('@playwright/test', () => ({ expect: Object.assign(
    (...args) => expect(...args), { poll }) }));
const { verifyFreshWaterHandoff } = await import('./e2e/chronicle-water-handoff.js');
const firstStep = () => ({ id: 'chronicle_water_road_open_hands', accepted: false, completed: false, count: 0 });
const page = { evaluate: (fn, argument) => fn(argument) };
afterEach(() => { delete window.game; jest.clearAllMocks(); });

test('fresh Earth completion offers the first road investigation before the ferry hunt', async () => {
    expect(chronicleExpeditions.find(hunt => hunt.id === firstStep().id)).toMatchObject({
        previousQuestId: 'chronicle_03_roots_remember', beforeQuestId: 'chronicle_water_road_bread_carriers', realm: 'earth'
    });
    const quests = Object.freeze([Object.freeze({ id: 'chronicle_03_roots_remember', completed: true }),
        Object.freeze(firstStep()), Object.freeze({ id: 'daily_skeletons', accepted: false })]);
    window.game = { player: { quests } };
    await verifyFreshWaterHandoff(page);
    expect(window.game.player.quests).toBe(quests);
    expect(poll).toHaveBeenCalledTimes(1);
});

test.each([
    [], [{ id: 'chronicle_water_road_bread_carriers', accepted: false, completed: false, count: 0 }],
    [{ ...firstStep(), accepted: true }], [{ ...firstStep(), completed: true }], [{ ...firstStep(), count: 1 }],
    [firstStep(), { id: 'chronicle_water_road_bread_carriers', accepted: false, completed: false, count: 0 }]
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
