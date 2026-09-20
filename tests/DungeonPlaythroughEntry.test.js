import { jest } from '@jest/globals';

const enterAndExitDungeon = jest.fn();
const moveByGroundClick = jest.fn();
const readPlayerState = jest.fn();
const projectEntity = jest.fn();
jest.unstable_mockModule('./dungeonTraversalRoutes.js', () => ({
    buildDungeonTraversalRoutes: () => [[{ x: 0, z: 0 }]]
}));
jest.unstable_mockModule('./e2e/helpers.js', () => ({
    enterAndExitDungeon, enterDungeon: jest.fn(), returnToTown: jest.fn(),
    moveByGroundClick, projectEntity, readPlayerState,
    settlePointerRaycast: jest.fn()
}));
// This check exercises entry option flow without launching a browser or invoking
// Playwright's assertions. The first entry deliberately stops at its boundary.
// Playwright accepts an optional message; Jest's expect does not. Retain the
// actual assertion while adapting that API difference in the unit harness.
jest.unstable_mockModule('@playwright/test', () => ({ expect: Object.assign(value => expect(value), expect) }));
const { playDungeonThroughInputs } = await import('./e2e/dungeon-playthrough-route.js');

afterEach(() => { jest.clearAllMocks(); jest.restoreAllMocks(); });

test('covered pack retargets party inputs before attacking and never credits the untouched golem', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const layout = { generationSeed: 'covered-pack', rooms: [{ type: 'start' }, { type: 'boss' }],
        corridors: [{ toRoomIndex: 1 }] };
    const golem = { id: 'golem', type: 'MagmaGolem', distance: 6, health: 6340 };
    const behemoth = { id: 'behemoth', type: 'InfernalBehemoth', distance: 9, health: 9000 };
    const page = { mouse: { move: jest.fn(), click: jest.fn() }, evaluate: jest.fn(async fn => {
        if (fn.name === 'readDungeonTargetStateInPage') return { state: 'IDLE', health: golem.health };
        if (fn.name === 'readDungeonTargetPointerInPage') return behemoth.id;
        const source = fn.toString();
        if (source.includes('currentDungeonLayout')) return layout;
        if (source.includes('remotePlayers.values')) return [golem, behemoth];
        if (source.includes('hoveredEntity')) return behemoth.id;
        return 0;
    }) };
    projectEntity.mockResolvedValue({ x: 100, y: 200, visible: true });
    const reachedForeground = new Error('foreground now needs its own real combat');
    const beforeCombat = jest.fn(async (_page, target) => {
        if (target.id === behemoth.id) throw reachedForeground;
        return false;
    });
    const afterEncounter = jest.fn();
    enterAndExitDungeon.mockImplementationOnce(async (_page, { beforeExit }) => beforeExit());
    await expect(playDungeonThroughInputs(page, { expeditionProfile: 'party', beforeCombat, afterEncounter,
        playthrough: { dungeonType: 'fire_crystal_raid', bosses: ['AshenImperator'] }
    })).rejects.toBe(reachedForeground);
    expect(beforeCombat.mock.calls.map(([, target]) => target.id)).toEqual(['golem', 'behemoth']);
    expect(afterEncounter).not.toHaveBeenCalled();
    expect(page.mouse.click).not.toHaveBeenCalled();
    expect(moveByGroundClick).not.toHaveBeenCalled();
});

test.each([[true, true], [true, false], [false, true]])(
    'raid hands off to the ritual only after its observed final boss and all cleared rooms: enabled%s cleared%s',
    async (finishAtFinalBoss, cleared) => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        let defeated = false;
        const layout = { generationSeed: 'raid-handoff', generatorVersion: 2,
            rooms: [{ type: 'start' }, { type: 'boss', x: 0, z: 0, width: 100, height: 100 }],
            corridors: [{ toRoomIndex: 1 }] };
        const rooms = [{ cleared: false }, { cleared }];
        const enemy = { id: 'guardian', type: 'AshenImperator', distance: 10, health: 100 };
        const page = { evaluate: jest.fn(async fn => {
            if (fn.name === 'readDungeonTargetStateInPage') { defeated = true; return { state: 'DEAD', health: 0 }; }
            const source = fn.toString();
            if (source.includes('currentDungeonLayout.generationSeed')) return layout.generationSeed;
            if (source.includes('currentDungeonLayout.generatorVersion')) return layout.generatorVersion;
            if (source.includes('currentDungeonLayout')) return layout;
            if (source.includes('currentDungeonRoomState.rooms')) return rooms;
            if (source.includes('currentDungeonRoomState')) return { rooms };
            if (source.includes('player.gold')) return defeated ? 10 : 0;
            if (source.includes('remotePlayers.values')) return defeated ? [] : [enemy];
            return 0;
        }) };
        const centerWalk = new Error('unnecessary formation around repair NPC');
        moveByGroundClick.mockRejectedValue(centerWalk);
        readPlayerState.mockResolvedValue({ x: 50, z: 50 });
        enterAndExitDungeon.mockImplementation(async (_page, { beforeExit }) => beforeExit());
        const afterClearedRoute = jest.fn();
        const result = playDungeonThroughInputs(page, { finishAtFinalBoss, afterClearedRoute,
            playthrough: { dungeonType: 'fire_crystal_raid', bosses: ['AshenImperator'] } });
        if (finishAtFinalBoss && cleared) {
            await result;
            expect(afterClearedRoute).toHaveBeenCalledTimes(1);
            expect(moveByGroundClick).not.toHaveBeenCalled();
        } else {
            await expect(result).rejects.toBe(centerWalk);
            expect(afterClearedRoute).not.toHaveBeenCalled();
        }
    }
);

test.each([false, true])('traversal timeout retains bounded in-dungeon evidence before recall (observation fails: %s)', async observationFails => {
    let moves = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => moves >= 14 ? 180_001 : moves * 1000);
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    const layout = { generationSeed: 'timeout-fixture',
        rooms: [{ type: 'start' }, { type: 'boss' }], corridors: [{ toRoomIndex: 1 }] };
    const spatial = { instanceType: 'dungeon', player: { position: { x: 50, z: 50 } } };
    const page = { evaluate: jest.fn(async fn => {
        if (fn.name === 'installDungeonObservationInPage') return;
        if (fn.name === 'dungeonSpatialSnapshot') {
            if (observationFails) throw new Error('browser disconnected during observation');
            return spatial;
        }
        if (fn.toString().includes('currentDungeonLayout')) return layout;
        if (fn.toString().includes('remotePlayers.values')) return [];
        return 0;
    }) };
    readPlayerState.mockImplementation(async () => ({ x: 50 - moves / 10, z: 50 }));
    moveByGroundClick.mockImplementation(async () => { moves++; });
    let recordedBeforeRecall = false;
    enterAndExitDungeon.mockImplementationOnce(async (_page, { beforeExit }) => {
        try { await beforeExit(); }
        finally { recordedBeforeRecall = output.mock.calls.some(([line]) => line.includes('traversal failure')); }
    });
    await expect(playDungeonThroughInputs(page, {
        playthrough: { dungeonType: 'test', bosses: ['Boss'] }
    })).rejects.toThrow('Traversal stalled before room 1');
    expect(recordedBeforeRecall).toBe(true);
    expect(moves).toBe(14); // No extra move or relaxed deadline after failure.
    const line = output.mock.calls.find(([value]) => value.includes('traversal failure'))[0];
    const receipt = JSON.parse(line.slice(line.indexOf('{')));
    expect(receipt).toMatchObject({ roomIndex: 1, destination: { x: 0, z: 0 },
        spatial: observationFails ? null : spatial });
    expect(receipt.recentPositions).toHaveLength(12);
    expect(receipt.recentPositions[0]).toMatchObject({ at: 2000, x: 49.8, z: 50 });
    expect(receipt.recentPositions.at(-1).distance).toBeCloseTo(Math.hypot(48.7, 50));
});

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

test('fresh isolated party entry does not request a nonexistent prior-run reset', async () => {
    const stopped = new Error('fresh entry reached');
    enterAndExitDungeon.mockRejectedValueOnce(stopped);
    const page = { evaluate: jest.fn() };
    const playthrough = { dungeonType: 'abyssal_well', runLevel: 60, difficulty: 'normal' };
    await expect(playDungeonThroughInputs(page, { playthrough, resetRun: false })).rejects.toBe(stopped);
    expect(enterAndExitDungeon).toHaveBeenCalledWith(page, {
        ...playthrough, useTownGuide: true, resetRun: false, beforeExit: expect.any(Function)
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

test.each([true, false])('post-clear inspection runs only after successful room/reward checks: %s', async success => {
    // Empty synthetic route isolates the post-combat inspection boundary. Native
    // tests still require all actual configured bosses and cleared-room checks.
    const layout = { generationSeed: 'route-boundary', rooms: [] };
    const page = { evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(layout)
        .mockResolvedValueOnce(10).mockResolvedValueOnce({ rooms: [] }).mockResolvedValueOnce(success ? 20 : 5) };
    const afterClearedRoute = jest.fn();
    enterAndExitDungeon.mockImplementationOnce(async (_page, { beforeExit }) => beforeExit());
    const result = playDungeonThroughInputs(page, { fullRun: false, afterClearedRoute,
        playthrough: { dungeonType: 'test', bosses: [] } });
    if (success) {
        await result;
        expect(afterClearedRoute).toHaveBeenCalledWith(page, {
            assertActive: expect.any(Function), fight: expect.any(Function)
        });
        expect(afterClearedRoute).toHaveBeenCalledTimes(1);
    } else {
        await expect(result).rejects.toThrow();
        expect(afterClearedRoute).not.toHaveBeenCalled();
    }
});
