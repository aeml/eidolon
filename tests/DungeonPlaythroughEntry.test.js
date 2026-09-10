import { jest } from '@jest/globals';

const enterAndExitDungeon = jest.fn();
jest.unstable_mockModule('./dungeonTraversalRoutes.js', () => ({
    buildDungeonTraversalRoutes: () => [[{ x: 0, z: 0 }]]
}));
jest.unstable_mockModule('./e2e/helpers.js', () => ({
    enterAndExitDungeon, moveByGroundClick: jest.fn(), projectEntity: jest.fn(), readPlayerState: jest.fn()
}));
// This check exercises entry option flow without launching a browser or invoking
// Playwright's assertions. The first entry deliberately stops at its boundary.
// Playwright accepts an optional message; Jest's expect does not. Retain the
// actual assertion while adapting that API difference in the unit harness.
jest.unstable_mockModule('@playwright/test', () => ({ expect: Object.assign(value => expect(value), expect) }));
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

test('actual encounter dispatch carries the fixed boss room into the combat callback', async () => {
    const stopped = new Error('combat boundary captured');
    const room = { x: 20000, z: 19460, width: 120, height: 120, type: 'boss' };
    const layout = { generationSeed: '-1263584004433865125', rooms: [{ type: 'start' }, room] };
    const enemy = { id: 'warden', type: 'RootboundWarden', distance: 10, health: 15000 };
    const page = { evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(layout)
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce([enemy]).mockResolvedValueOnce(0) };
    const beforeCombat = jest.fn().mockRejectedValue(stopped);
    enterAndExitDungeon.mockImplementationOnce(async (_page, { beforeExit }) => beforeExit());
    await expect(playDungeonThroughInputs(page, { beforeCombat,
        playthrough: { dungeonType: 'verdant_bastion_catacombs', bosses: ['RootboundWarden'] }
    })).rejects.toBe(stopped);
    expect(beforeCombat).toHaveBeenCalledWith(page, { ...enemy,
        encounter: { x: 20000, z: 19460, width: 120, height: 120 } });
    expect(enemy.encounter).toBeUndefined();
});
