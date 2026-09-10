import { jest } from '@jest/globals';
import { approachEarnedMerchant } from './earnedMerchantApproach.js';

const snapshot = (x = 0) => ({ position: [x, 0, 200], camera: [x, 0, 200],
    merchant: [22.5, 0, 200], state: 'IDLE', target: null });

test('each offset is computed after the previous click fully arrives, not after its first metre', async () => {
    const state = snapshot(), events = [];
    const result = await approachEarnedMerchant({
        settle: async () => {
            events.push('settle');
            if (state.target) state.position = [...state.target];
            state.camera = [...state.position]; state.target = null; state.state = 'IDLE';
        },
        read: async () => { events.push('read'); return { ...state, position: [...state.position], camera: [...state.camera] }; },
        move: async (x, z) => {
            events.push([x, z]); state.target = [state.position[0] + x, 0, state.position[2] + z];
            state.position[0] += 1.01; state.state = 'MOVING';
        }
    });
    expect(events).toEqual(['settle', 'read', [12, 0], 'settle', 'read', [7.5, 0], 'settle', 'read']);
    expect(result).toMatchObject({ position: [19.5, 0, 200], target: null, state: 'IDLE' });
});

test.each([
    { state: 'MOVING' }, { target: [20, 0, 200] }, { camera: [5, 0, 200] }
])('transient proximity cannot pass the settled approach: %j', async patch => {
    const move = jest.fn();
    await expect(approachEarnedMerchant({ settle: async () => {},
        read: async () => ({ ...snapshot(20), ...patch }), move })).rejects.toThrow('after movement');
    expect(move).not.toHaveBeenCalled();
});

test('one fixed deadline cannot be renewed by apparent progress', async () => {
    let time = 0;
    const settle = jest.fn(async deadline => { expect(deadline).toBe(45_000); time += 15_000; });
    const move = jest.fn();
    await expect(approachEarnedMerchant({ settle, read: async () => snapshot(), move, now: () => time }))
        .rejects.toThrow('45 seconds');
    expect(settle).toHaveBeenCalledTimes(3);
    expect(move).toHaveBeenCalledTimes(2);
});

test('eight completed moves without arrival fail instead of opening a remote shop', async () => {
    const move = jest.fn();
    await expect(approachEarnedMerchant({ settle: async () => {}, read: async () => snapshot(), move }))
        .rejects.toThrow('eight moves');
    expect(move).toHaveBeenCalledTimes(8);
});

test('settle and actual input failures propagate without another click', async () => {
    for (const stage of ['settle', 'move']) {
        const cause = new Error(stage), move = jest.fn(async () => { if (stage === 'move') throw cause; });
        await expect(approachEarnedMerchant({ settle: async () => { if (stage === 'settle') throw cause; },
            read: async () => snapshot(), move })).rejects.toBe(cause);
        expect(move).toHaveBeenCalledTimes(stage === 'move' ? 1 : 0);
    }
});

test.each([null, [NaN, 0, 200]])('missing or invalid replicated merchant rejects movement', async merchant => {
    const move = jest.fn();
    await expect(approachEarnedMerchant({ settle: async () => {},
        read: async () => ({ ...snapshot(), merchant }), move })).rejects.toThrow('finite');
    expect(move).not.toHaveBeenCalled();
});
