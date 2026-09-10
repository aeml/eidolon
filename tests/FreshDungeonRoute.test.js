import { jest } from '@jest/globals';

const readPlayerState = jest.fn();
const readChronicleChapter = jest.fn();
const verifyTurnIn = jest.fn();
const playDungeon = jest.fn();
const createDefense = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ readPlayerState }));
jest.unstable_mockModule('./e2e/chronicle-earth-route.js', () => ({
    EARTH_DUNGEON_CHAPTER: 'chronicle_03_roots_remember', readChronicleChapter,
    verifyEarthDungeonChronicleTurnIn: verifyTurnIn
}));
jest.unstable_mockModule('./e2e/dungeon-playthrough-route.js', () => ({ playDungeonThroughInputs: playDungeon }));
jest.unstable_mockModule('./e2e/earned-class-combat.js', () => ({ createEarnedClassCombat: createDefense }));
const { clearEarnedVerdant } = await import('./e2e/fresh-dungeon-route.js');

let page;
beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    readPlayerState.mockResolvedValue({ level: 34, state: 'IDLE', health: 200 });
    readChronicleChapter.mockResolvedValue({ accepted: true, completed: false, count: 0,
        grantedGold: 100, grantedXP: 500 });
    page = { evaluate: jest.fn().mockResolvedValueOnce('Wizard').mockResolvedValue({ retreats: 0 }),
        locator: jest.fn().mockReturnValue({ click: jest.fn() }) };
});
afterEach(() => jest.restoreAllMocks());

test('earned entry uses the real town guide and full normal level-30 route before story turn-in', async () => {
    const defense = jest.fn();
    createDefense.mockResolvedValue(defense);
    await clearEarnedVerdant(page, {});
    expect(playDungeon).toHaveBeenCalledWith(page, expect.objectContaining({
        playthrough: expect.objectContaining({ dungeonType: 'verdant_bastion_catacombs',
            difficulty: 'normal', runLevel: 30, bosses: ['RootboundWarden', 'BriarMatron', 'RustboundColossus', 'HollowSentinel'] }),
        fullRun: true, fallbackRun: false, useTownGuide: true, beforeCombat: defense
    }));
    expect(verifyTurnIn).toHaveBeenCalledWith(page, {});
    expect(playDungeon.mock.invocationCallOrder[0]).toBeLessThan(verifyTurnIn.mock.invocationCallOrder[0]);
});

test('an unmet earned level gate stops before entry without granting a level', async () => {
    readPlayerState.mockResolvedValue({ level: 29, state: 'IDLE' });
    await expect(clearEarnedVerdant(page, {})).rejects.toThrow();
    expect(playDungeon).not.toHaveBeenCalled();
    expect(verifyTurnIn).not.toHaveBeenCalled();
});

test.each([
    [34, ['Whirlwind', 'Shield Slam', 'Iron Fortress']],
    [40, ['Whirlwind', 'Shield Slam', 'Iron Fortress', 'Guardian Roar']]
])('earned Fighter level %s requires only the skills unlocked at entry', async (level, skills) => {
    readPlayerState.mockResolvedValue({ level, state: 'IDLE', health: 400 });
    page.evaluate.mockReset().mockResolvedValueOnce('Fighter').mockResolvedValue({ accepted: {} });
    await clearEarnedVerdant(page, {});
    expect(createDefense).toHaveBeenCalledWith(page, 'Fighter');
    expect(playDungeon).toHaveBeenCalledWith(page, expect.objectContaining({ requiredFighterSkills: skills }));
    expect(verifyTurnIn).toHaveBeenCalledWith(page, {});
});

test('an unsupported earned class fails before starting dungeon combat', async () => {
    page.evaluate.mockReset().mockResolvedValue('Rogue');
    await expect(clearEarnedVerdant(page, {})).rejects.toThrow();
    expect(playDungeon).not.toHaveBeenCalled();
});

test.each([
    { accepted: false, completed: false, count: 0 },
    { accepted: true, completed: true, count: 1 },
    { accepted: true, completed: false, count: 1 }
])('requires an accepted, previously uncleared story objective: %j', async chapter => {
    readChronicleChapter.mockResolvedValue(chapter);
    await expect(clearEarnedVerdant(page, {})).rejects.toThrow();
    expect(playDungeon).not.toHaveBeenCalled();
});

test('a failed traversal cannot proceed to reward and raid-access assertions', async () => {
    const failure = new Error('ordinary combat failed');
    playDungeon.mockRejectedValue(failure);
    await expect(clearEarnedVerdant(page, {})).rejects.toBe(failure);
    expect(verifyTurnIn).not.toHaveBeenCalled();
});

test('story-only driver enforces separate clear and manual reward/save phases', async () => {
    const runPhase = jest.fn((_id, body) => body());
    await clearEarnedVerdant(page, {}, { runPhase });
    expect(runPhase.mock.calls.map(call => call[0])).toEqual(['dungeon', 'dungeon-turn-in']);
    expect(playDungeon.mock.invocationCallOrder[0]).toBeLessThan(verifyTurnIn.mock.invocationCallOrder[0]);
});
