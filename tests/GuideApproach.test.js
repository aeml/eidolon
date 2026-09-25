import { jest } from '@jest/globals';
import { approachStoryWizard, approachTownGuide } from './guideApproach.js';

test('story approach settles every waypoint and uses move-only input through a party crowd', async () => {
    let player = { x: 0, z: 0 }, pending;
    const moves = [];
    await approachStoryWizard({ read: async () => ({ player, wizard: { x: 25, z: 0 }, range: 5 }),
        settle: async () => { if (pending) { player = pending; pending = null; } },
        move: async (dx, dz, options) => {
            moves.push({ dx, dz, options });
            pending = { x: player.x + dx, z: player.z + dz };
            player = { x: player.x + 1, z: player.z };
        } });
    expect(moves).toEqual([12, 10].map(dx => ({ dx, dz: 0,
        options: { moveOnly: true, allowJumpFallback: false } })));
    expect(player).toEqual({ x: 22, z: 0 });
});

test('story approach already inside the live interaction range does not move', async () => {
    const move = jest.fn(), settle = jest.fn();
    await approachStoryWizard({ settle, move,
        read: async () => ({ player: { x: 16, z: 215 }, wizard: { x: 20, z: 215 }, range: 5 }) });
    expect(settle).toHaveBeenCalledTimes(1);
    expect(move).not.toHaveBeenCalled();
});

test('story approach cannot silently click an out-of-range NPC after its step bound', async () => {
    const move = jest.fn();
    await expect(approachStoryWizard({ settle: jest.fn(), move,
        read: async () => ({ player: { x: 0, z: 200 }, wizard: { x: 20, z: 215 }, range: 5 }) }))
        .rejects.toThrow('remains out of range');
    expect(move).toHaveBeenCalledTimes(12);
});

test('story approach stops on unsettled movement or unavailable NPC instead of guessing', async () => {
    const read = jest.fn(), move = jest.fn();
    await expect(approachStoryWizard({ read, move, settle: async () => { throw new Error('still moving'); } }))
        .rejects.toThrow('still moving');
    expect(read).not.toHaveBeenCalled();
    await expect(approachStoryWizard({ read: async () => ({ player: { x: 0, z: 0 } }), move, settle: jest.fn() }))
        .rejects.toThrow('live NPC');
    expect(move).not.toHaveBeenCalled();
});

test('each short movement observation finishes before another guide waypoint is computed', async () => {
    let z = 200, pending = null;
    const moves = [];
    const settle = jest.fn(async () => { if (pending !== null) { z = pending; pending = null; } });
    const project = jest.fn(async () => ({ visible: z >= 230 }));
    const result = await approachTownGuide({ project, settle, read: async () => ({ x: 0, z }),
        move: async (dx, dz, options) => { moves.push({ dx, dz, options }); pending = z + dz; z++; } });
    expect(result.visible).toBe(true);
    expect(moves).toEqual([16, 16].map(dz => ({ dx: -0, dz,
        options: { moveOnly: true, allowJumpFallback: false } })));
    expect(z).toBe(232);
    expect(settle).toHaveBeenCalledTimes(3);
});

test('an already visible guide needs no movement, but waits for camera arrival', async () => {
    const order = [], move = jest.fn();
    const result = await approachTownGuide({ settle: async () => order.push('settle'),
        project: async () => { order.push('project'); return { visible: true }; }, read: jest.fn(), move });
    expect(result.visible).toBe(true);
    expect(order).toEqual(['settle', 'project']);
    expect(move).not.toHaveBeenCalled();
});

test('a missing guide keeps the four-step bound and never fabricates visibility', async () => {
    const move = jest.fn(), settle = jest.fn();
    expect(await approachTownGuide({ project: async () => null, read: async () => ({ x: 0, z: 200 }), move, settle })).toBeNull();
    expect(move).toHaveBeenCalledTimes(4);
    expect(settle).toHaveBeenCalledTimes(5);
});

test('a hidden guide at the player position does not request a zero-length or NaN move', async () => {
    const move = jest.fn();
    expect(await approachTownGuide({ project: async () => null, read: async () => ({ x: 0, z: 240 }),
        move, settle: jest.fn() })).toBeNull();
    expect(move).not.toHaveBeenCalled();
});

test('a stalled waypoint fails without issuing another click', async () => {
    const move = jest.fn(), settle = jest.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('stalled'));
    await expect(approachTownGuide({ project: async () => null, read: async () => ({ x: 0, z: 200 }), move, settle }))
        .rejects.toThrow('stalled');
    expect(move).toHaveBeenCalledTimes(1);
});
