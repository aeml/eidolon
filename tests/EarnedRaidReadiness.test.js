import { jest } from '@jest/globals';

const restoreEarnedWizard = jest.fn(), openIlyra = jest.fn(), acceptOfferedChapter = jest.fn();
const readChronicleChapter = jest.fn(), readSavedEarnedHandoff = jest.fn();
const poll = read => ({ toBe: async value => expect(await read()).toBe(value) });
jest.unstable_mockModule('@playwright/test', () => ({ expect: Object.assign(value => expect(value), { poll }) }));
jest.unstable_mockModule('./e2e/earned-earth-continuation.js', () => ({ restoreEarnedWizard }));
jest.unstable_mockModule('./e2e/chronicle-earth-route.js', () => ({ readChronicleChapter, openIlyra, acceptOfferedChapter }));
jest.unstable_mockModule('./earnedEarthCheckpoint.js', () => ({ readSavedEarnedHandoff }));
jest.unstable_mockModule('./e2e/dungeon-guide.js', () => ({ openDungeonGuide: jest.fn() }));
const { restoreEarnedRaidReadiness } = await import('./e2e/earned-regional-dungeon-entry.js');

const credentials = { username: 'isolated-wizard' };
const raid = { raidType: 'fire_crystal_raid', chapterId: 'fire-vigil', priorChapterIds: ['earth-vigil', 'water-vigil'] };
let quests, saved, page;
beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    quests = [{ id: 'earth-vigil', completed: true }, { id: 'water-vigil', completed: true },
        { id: 'fire-vigil', completed: false, accepted: true, count: 0 }];
    saved = { level: 70, xp: 42, gold: 321, correctSaveKey: true, quests: quests.map(quest => ({ ...quest })) };
    page = { evaluate: jest.fn().mockResolvedValue({ level: 70, xp: 42, gold: 321 }) };
    readChronicleChapter.mockImplementation(async (_page, id) => quests.find(q => q.id === id));
    readSavedEarnedHandoff.mockImplementation(() => saved);
});
afterEach(() => jest.restoreAllMocks());

test('restores the private save and requires personal prior claims without generating progression', async () => {
    await restoreEarnedRaidReadiness(page, credentials, raid, 70);
    expect(restoreEarnedWizard).toHaveBeenCalledWith(page, credentials);
    expect(acceptOfferedChapter).not.toHaveBeenCalled();
    expect(saved).toMatchObject({ xp: 42, gold: 321, quests });
});

test.each(['client', 'saved'])('refuses a missing prior restoration in %s state', async source => {
    (source === 'client' ? quests : saved.quests)[1].completed = false;
    await expect(restoreEarnedRaidReadiness(page, credentials, raid, 70)).rejects.toThrow();
    expect(acceptOfferedChapter).not.toHaveBeenCalled();
});

test('an actual unaccepted offer is accepted through Ilyra and checked in the saved character', async () => {
    quests.at(-1).accepted = saved.quests.at(-1).accepted = false;
    acceptOfferedChapter.mockImplementationOnce(async (_page, id) => {
        quests.find(q => q.id === id).accepted = true;
        saved.quests.find(q => q.id === id).accepted = true;
    });
    await restoreEarnedRaidReadiness(page, credentials, raid, 70);
    expect(openIlyra).toHaveBeenCalledWith(page);
    expect(acceptOfferedChapter).toHaveBeenCalledWith(page, raid.chapterId);
    expect(saved.quests.at(-1)).toMatchObject({ completed: false, count: 0 });
});

test.each([{ completed: true }, { count: 1 }])('refuses an already-earned objective: %j', async change => {
    Object.assign(quests.at(-1), change);
    await expect(restoreEarnedRaidReadiness(page, credentials, raid, 70)).rejects.toThrow();
});
