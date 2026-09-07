import { jest } from '@jest/globals';

const enterAndExitDungeon = jest.fn();
jest.unstable_mockModule('./e2e/helpers.js', () => ({
    enterAndExitDungeon, moveByGroundClick: jest.fn(), projectEntity: jest.fn(), readPlayerState: jest.fn()
}));
// This check exercises entry option flow without launching a browser or invoking
// Playwright's assertions. The first entry deliberately stops at its boundary.
jest.unstable_mockModule('@playwright/test', () => ({ expect }));
const { playDungeonThroughInputs } = await import('./e2e/dungeon-playthrough-route.js');

afterEach(() => jest.clearAllMocks());

test.each([undefined, true, false])('shared dungeon traversal forwards safe town-guide choice %s', async (useTownGuide) => {
    const stopped = new Error('entry boundary reached');
    enterAndExitDungeon.mockRejectedValueOnce(stopped);
    const page = { evaluate: jest.fn() };
    const playthrough = { dungeonType: 'verdant_bastion_catacombs', difficulty: 'normal', runLevel: 30 };
    const options = { playthrough };
    if (useTownGuide !== undefined) options.useTownGuide = useTownGuide;
    await expect(playDungeonThroughInputs(page, options)).rejects.toBe(stopped);
    expect(enterAndExitDungeon).toHaveBeenCalledTimes(1);
    expect(enterAndExitDungeon).toHaveBeenCalledWith(page, {
        ...playthrough, useTownGuide: useTownGuide ?? true, resetRun: true, beforeExit: expect.any(Function)
    });
});

test.each([true, false])('completed-run re-entry preserves guide choice %s', async (useTownGuide) => {
    // Skip the actual combat callback here; only exercise option propagation.
    enterAndExitDungeon.mockResolvedValue(undefined);
    const page = { evaluate: jest.fn() };
    const playthrough = { dungeonType: 'verdant_bastion_catacombs', runLevel: 30 };
    await playDungeonThroughInputs(page, { playthrough, useTownGuide });
    expect(enterAndExitDungeon).toHaveBeenCalledTimes(2);
    expect(enterAndExitDungeon).toHaveBeenNthCalledWith(2, page, {
        ...playthrough, useTownGuide, beforeExit: expect.any(Function)
    });
});
