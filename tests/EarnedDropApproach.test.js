import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { approachEarnedDrop } from './earnedDropApproach.js';

test('a ranged death needs the full ground approach, not one short move followed by another waypoint', async () => {
    let position = { x: 0, z: 0 };
    const move = jest.fn(async (x, z) => { position = { x: position.x + x, z: position.z + z }; });
    const result = await approachEarnedDrop({ destination: { x: 24, z: 0 }, readPosition: async () => position, move });
    expect(move).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ x: 24, z: 0 });
});

test('already being in pickup approach range requires no extra movement', async () => {
    const move = jest.fn();
    await approachEarnedDrop({ destination: { x: 1, z: 0 }, readPosition: async () => ({ x: 0, z: 0 }), move });
    expect(move).not.toHaveBeenCalled();
});

test('blocked walking fails within the original bounded movement allowance', async () => {
    const move = jest.fn();
    await expect(approachEarnedDrop({ destination: { x: 24, z: 0 },
        readPosition: async () => ({ x: 0, z: 0 }), move, maxSteps: 3 })).rejects.toThrow('within 3 steps');
    expect(move).toHaveBeenCalledTimes(3);
});

test.each([{ destination: { x: NaN, z: 0 } }, { radius: 0 }, { maxSteps: 0 }])('invalid drop approach is rejected: %j', overrides => {
    return expect(approachEarnedDrop({ destination: { x: 0, z: 0 }, readPosition: jest.fn(),
        move: jest.fn(), ...overrides })).rejects.toThrow('Invalid earned drop approach');
});

test('functional collection waits for real nearby fragments and checks completion after the last allowed encounter', () => {
    const route = readFileSync('tests/e2e/chronicle-earth-route.js', 'utf8');
    expect(route).toContain('await approachEarnedDrop({');
    expect(route).toContain('{ moveOnly: true, allowJumpFallback: false }');
    expect(route).toContain('await page.waitForTimeout(900)');
    expect(route).toContain('game.canAttemptLootPickup(entity)');
    expect(route).toContain('if (final.count >= final.maxCount) return;');
    expect(route).not.toContain('/qa-loot-next');
    expect(route).toContain('Math.max(30, (await readChronicleChapter(page, id)).maxCount * 5)');
});
