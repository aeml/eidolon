import { jest } from '@jest/globals';
import { approachTownGuide } from './guideApproach.js';

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
