import { jest } from '@jest/globals';
import { acquirePartyAllyPointer, PARTY_FOLLOW_INPUT_OPTIONS, partyFollowStep, planPartyTelegraphEscape } from './partyDungeonControls.js';

test('healer stops seven units short of the tank rather than aiming into the boss', () => {
    expect(partyFollowStep({ x: 0, z: 0 }, { x: 0, z: -12 }, 7)).toEqual({ dx: 0, dz: -5 });
});
test('long diagonal approaches preserve direction and the twelve-unit input bound', () => {
    const step = partyFollowStep({ x: 10, z: 20 }, { x: 40, z: 60 }, 7);
    expect(Math.hypot(step.dx, step.dz)).toBeCloseTo(12);
    expect(step.dx / step.dz).toBeCloseTo(3 / 4);
});
test.each([0, 3, 4, 4.9])('no invalid sub-unit input within the formation margin: %s', x => {
    expect(partyFollowStep({ x: 0, z: 0 }, { x, z: 0 }, 4)).toBeNull();
});
test.each([NaN, Infinity, -1])('invalid spacing fails closed: %s', spacing => {
    expect(() => partyFollowStep({ x: 0, z: 0 }, { x: 10, z: 10 }, spacing)).toThrow();
});

test('following uses real move-only walking, never a covered-ground jump', () => {
    expect(PARTY_FOLLOW_INPUT_OPTIONS).toEqual({ moveOnly: true, allowJumpFallback: false });
});

test('healing pointer skips a boss-covered center and confirms an exposed ally hitbox', async () => {
    const input = { project: jest.fn().mockResolvedValue({ x: 100, y: 100, visible: true }),
        move: jest.fn(), settle: jest.fn(), hoveredId: jest.fn().mockResolvedValueOnce('boss').mockResolvedValue('ally') };
    expect(await acquirePartyAllyPointer(input, 'ally')).toBe(true);
    expect(input.project).toHaveBeenCalledTimes(2);
    expect(input.project).toHaveBeenLastCalledWith('ally', { x: .5, y: .85, z: .5 });
    expect(input.move).toHaveBeenCalledTimes(2);
});

test('a completely covered ally does not authorize a misdirected heal', async () => {
    const input = { project: jest.fn().mockResolvedValue({ x: 100, y: 100, visible: true }),
        move: jest.fn(), settle: jest.fn(), hoveredId: jest.fn().mockResolvedValue('boss') };
    expect(await acquirePartyAllyPointer(input, 'ally')).toBe(false);
    expect(input.move).toHaveBeenCalledTimes(6);
});

test('offscreen allies cause no pointer input, and projection errors still fail', async () => {
    const input = { project: jest.fn().mockResolvedValue(null), move: jest.fn(), settle: jest.fn(), hoveredId: jest.fn() };
    expect(await acquirePartyAllyPointer(input, 'ally')).toBe(false);
    expect(input.move).not.toHaveBeenCalled();
    input.project.mockRejectedValueOnce(new Error('projection failed'));
    await expect(acquirePartyAllyPointer(input, 'ally')).rejects.toThrow('projection failed');
});

test('a melee tank walks beyond the full visible quake with a safety margin', () => {
    const step = planPartyTelegraphEscape({ x: 8, z: 0 }, [{ x: 0, z: 0, radius: 12.5 }]);
    expect(step.x).toBeCloseTo(6.5);
    expect(step.z).toBeCloseTo(0);
});
test('already-safe players hold position instead of issuing unnecessary movement', () => {
    expect(planPartyTelegraphEscape({ x: 16, z: 0 }, [{ x: 0, z: 0, radius: 12.5 }])).toBeNull();
});
test('blocked radial routes use only a fully validated alternative', () => {
    const canStep = jest.fn(step => step.z > 1);
    const step = planPartyTelegraphEscape({ x: 8, z: 0 }, [{ x: 0, z: 0, radius: 12.5 }], canStep);
    expect(step.z).toBeGreaterThan(1);
    expect(canStep).toHaveBeenCalledWith(step);
});
test('no legal escape is not fabricated as a successful move', () => {
    expect(planPartyTelegraphEscape({ x: 8, z: 0 }, [{ x: 0, z: 0, radius: 12.5 }], () => false)).toBeNull();
});
test('escaping one warning must not walk into another', () => {
    const warnings = [{ x: 0, z: 0, radius: 12.5 }, { x: 15, z: 0, radius: 3 }];
    const step = planPartyTelegraphEscape({ x: 8, z: 0 }, warnings);
    expect(step).not.toBeNull();
    for (const warning of warnings) expect(Math.hypot(8 + step.x - warning.x, step.z - warning.z)).toBeGreaterThanOrEqual(warning.radius + 1.5);
});
