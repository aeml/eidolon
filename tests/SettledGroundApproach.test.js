import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { approachSettledGround } from './settledGroundApproach.js';

test('transient near-waypoint motion cannot pass before the final position settles', async () => {
    let state = { z: 8.1, settled: false };
    const events = [];
    const settle = jest.fn(async () => {
        events.push('settle');
        state = { z: settle.mock.calls.length === 1 ? 7.87305646 : 10, settled: true };
    });
    const move = jest.fn(async () => events.push('move'));
    expect(await approachSettledGround({ destinationZ: 10, settle, move, now: () => 0,
        read: async () => { events.push('read'); return state; } })).toEqual({ z: 10, settled: true });
    expect(events).toEqual(['settle', 'read', 'move', 'settle', 'read']);
    expect(move).toHaveBeenCalledWith(0, expect.closeTo(2.12694354, 7));
});

test('uses bounded ordinary ground steps and retains the strict two-unit threshold', async () => {
    const read = jest.fn().mockResolvedValueOnce({ z: 0, settled: true })
        .mockResolvedValueOnce({ z: 18, settled: true }).mockResolvedValueOnce({ z: 20, settled: true });
    const move = jest.fn();
    await approachSettledGround({ destinationZ: 20, read, move, settle: jest.fn(), now: () => 0 });
    expect(move.mock.calls).toEqual([[0, 12], [0, 2]]);
});

test('a state change after settling cannot issue another click or claim arrival', async () => {
    const read = jest.fn().mockResolvedValueOnce({ z: 10, settled: false }).mockResolvedValueOnce({ z: 10, settled: true });
    const move = jest.fn(), settle = jest.fn();
    await approachSettledGround({ destinationZ: 10, read, move, settle, now: () => 0 });
    expect(settle).toHaveBeenCalledTimes(2);
    expect(move).not.toHaveBeenCalled();
});

test('settling and travel consume one absolute deadline, never a renewed approach budget', async () => {
    let time = 100;
    const deadlines = [];
    await expect(approachSettledGround({ destinationZ: 50, now: () => time,
        settle: async deadline => { deadlines.push(deadline); time += 20_000; },
        read: async () => ({ z: 0, settled: true }), move: async () => { time += 10_000; }
    })).rejects.toThrow('within 45 seconds');
    expect(deadlines).toEqual([45_100, 45_100]);
});

test('failed settling, invalid position and failed movement remain failures', async () => {
    const base = { destinationZ: 50, now: () => 0, settle: async () => {},
        read: async () => ({ z: 0, settled: true }), move: async () => {} };
    await expect(approachSettledGround({ ...base, settle: async () => { throw new Error('not idle'); } })).rejects.toThrow('not idle');
    await expect(approachSettledGround({ ...base, read: async () => ({ z: NaN }) })).rejects.toThrow('finite');
    await expect(approachSettledGround({ ...base, move: async () => { throw new Error('blocked'); } })).rejects.toThrow('blocked');
});

test('the native route requires settled movement/camera, fresh retry training and exact QA authorization', () => {
    const route = readFileSync(new URL('./e2e/dungeon-ground-area-gameplay.spec.js', import.meta.url), 'utf8');
    expect(route).toContain("credentials.username += `-retry${testInfo.retry}`");
    expect(route).toContain("p.state === 'IDLE' && !p.targetPosition && cameraDistance < .05");
    expect(route).toContain('approachSettledGround({');
    expect(route).toContain('ground-approach-failure.png');
    const shell = readFileSync(new URL('../scripts/run-isolated-character-qa.sh', import.meta.url), 'utf8');
    expect(shell).toContain('${QA_USERNAME_BASE}-ground-retry1');
    expect(route).toContain('for (let rank = 1; rank <= 5; rank++)');
    expect(route).toContain('accepted: false');
    expect(route).toContain('cooldownRemaining: 0');
});
