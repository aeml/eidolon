import { jest } from '@jest/globals';
import { acquirePartyAllyPointer, gatherPartyFormation, PARTY_FOLLOW_INPUT_OPTIONS, partyFollowStep, partyFormationStep, partyPathAvoidsActors, partyWarningInputPolicy, planPartyTelegraphEscape } from './partyDungeonControls.js';
import { clipDungeonEffectSegment } from '../src/skills/dungeonEffectGeometry.js';

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

test('formation follows the walked corner instead of cutting an L-shaped hallway', () => {
    const floors = [{ x: -10, z: 0, width: 24, height: 4 }, { x: 0, z: 10, width: 4, height: 24 }];
    const follower = { x: -4, z: 0 }, anchor = { x: 0, z: 14 }, corner = { x: 0, z: 0 };
    const clear = from => step => !clipDungeonEffectSegment(floors, from,
        { x: from.x + step.dx, z: from.z + step.dz }).blocked;
    expect(clear(follower)(partyFollowStep(follower, anchor))).toBe(false);
    const first = partyFormationStep(follower, anchor, corner, clear(follower));
    expect(clear(follower)(first)).toBe(true);
    const second = partyFormationStep(corner, anchor, corner, clear(corner));
    expect(second).toEqual({ dx: 0, dz: 10 });
});

test('a teammate occupying the straight gathering destination gets a verified alternative', () => {
    const follower = { x: 0, z: 5.8 }, tank = { x: 0, z: 0 };
    const bodies = [{ ...tank, radius: 1.25 }, { x: 0, z: 2.5, radius: 1.25 }];
    const clear = step => partyPathAvoidsActors(follower, step, bodies);
    expect(clear(partyFollowStep(follower, tank))).toBe(false);
    const step = partyFormationStep(follower, tank, null, clear);
    expect(clear(step)).toBe(true);
    expect(Math.abs(step.dx)).toBeGreaterThan(1);
});
test('a nearby blocking body can be passed using a checked lateral step', () => {
    const follower = { x: 0, z: 18 }, tank = { x: 0, z: 0 };
    const bodies = [{ x: 0, z: 15, radius: 1.25 }];
    const clear = from => step => partyPathAvoidsActors(from, step, bodies);
    const side = partyFormationStep(follower, tank, { x: 0, z: 14 }, clear(follower));
    expect(Math.abs(side.dx)).toBe(3);
    expect(Math.abs(side.dz)).toBeLessThan(.001);
    const moved = { x: follower.x + side.dx, z: follower.z + side.dz };
    const advance = partyFormationStep(moved, tank, { x: 0, z: 14 }, clear(moved));
    expect(clear(moved)(advance)).toBe(true);
    expect(Math.hypot(moved.x + advance.dx, moved.z + advance.dz)).toBeLessThan(Math.hypot(moved.x, moved.z));
});
test('already-overlapping actors can separate, but not walk through one another', () => {
    const from = { x: 0, z: 0 }, bodies = [{ x: 1, z: 0, radius: 1.25 }];
    expect(partyPathAvoidsActors(from, { dx: -3, dz: 0 }, bodies)).toBe(true);
    expect(partyPathAvoidsActors(from, { dx: 0, dz: 3 }, bodies)).toBe(true);
    expect(partyPathAvoidsActors(from, { dx: 3, dz: 0 }, bodies)).toBe(false);
    expect(partyPathAvoidsActors(from, { dx: 0, dz: 0 }, bodies)).toBe(false);
});

test('coincident spawn positions can separate instead of trapping every planned direction', () => {
    expect(partyPathAvoidsActors({ x: 0, z: 0 }, { dx: 3, dz: 0 }, [{ x: 0, z: 0, radius: 1.25 }])).toBe(true);
});
test('sub-millimetre replicated spawn offsets use the collision system coincident-body rule', () => {
    const from = { x: 19999.907985236892, z: 19990.008490300283 };
    const body = { x: 19999.908203125, z: 19990.0078125, radius: 1.25 };
    expect(partyPathAvoidsActors(from, { dx: 0, dz: -6 }, [body])).toBe(true);
});
test('formation preserves an already-safe direct step and refuses an unverified alternative', () => {
    const follower = { x: 0, z: 0 }, anchor = { x: 14, z: 0 };
    expect(partyFormationStep(follower, anchor, null, () => true)).toEqual({ dx: 10, dz: 0 });
    expect(() => partyFormationStep(follower, anchor, { x: 0, z: 2 }, () => false)).toThrow('no verified walking segment');
});
test('a missing safe plan cannot count an out-of-formation member as gathered', async () => {
    let clock = 0;
    await expect(gatherPartyFormation({ read: async () => { clock += 1000; return [{ x: 0, z: 0 }, { x: 20, z: 0 }]; },
        plan: async () => null, move: jest.fn(), now: () => clock, timeout: 2000 })).rejects.toThrow('failed to gather');
});
test('arrival between position and planning reads is verified again without a false failure', async () => {
    const read = jest.fn().mockResolvedValueOnce([{ x: 0, z: 0 }, { x: 6, z: 0 }])
        .mockResolvedValue([{ x: 0, z: 0 }, { x: 4, z: 0 }]);
    const move = jest.fn();
    await gatherPartyFormation({ read, plan: async () => null, move });
    expect(read).toHaveBeenCalledTimes(2);
    expect(move).not.toHaveBeenCalled();
});

test.each([
    [{ active: false, safe: true }, { holdMelee: false, allowCasts: true, allowApproach: true }],
    [{ active: true, safe: true }, { holdMelee: true, allowCasts: true, allowApproach: false }],
    [{ active: true, safe: false }, { holdMelee: true, allowCasts: false, allowApproach: false }]
])('warning policy preserves safe ranged casts without permitting a chase: %j', (warning, expected) => {
    expect(partyWarningInputPolicy(warning)).toEqual(expected);
});

test('formation waits for observed catch-up instead of counting an issued step as arrival', async () => {
    const tank = { x: 0, z: 0 };
    const read = jest.fn().mockResolvedValueOnce([tank, { x: 30, z: 0 }])
        .mockResolvedValueOnce([tank, { x: 18, z: 0 }]).mockResolvedValueOnce([tank, { x: 4, z: 0 }]);
    const move = jest.fn();
    await gatherPartyFormation({ read, move });
    expect(read).toHaveBeenCalledTimes(3);
    expect(move).toHaveBeenCalledTimes(2);
});

test('followers replan after each settled move instead of choosing a shared destination concurrently', async () => {
    const states = [{ x: 0, z: 0 }, { x: 0, z: 12 }, { x: 0, z: 12 }, { x: 0, z: 12 }];
    let activeMoves = 0, peakMoves = 0;
    const planned = [];
    await gatherPartyFormation({ read: async () => states.map(s => ({ ...s })),
        plan: async (index, state) => {
            planned.push({ index, firstFollower: { ...states[1] }, activeMoves });
            const destination = { x: (index - 2) * 3, z: 3 };
            return { dx: destination.x - state.x, dz: destination.z - state.z };
        },
        move: async (index, step) => {
            peakMoves = Math.max(peakMoves, ++activeMoves);
            await Promise.resolve();
            states[index].x += step.dx;
            states[index].z += step.dz;
            activeMoves--;
        } });
    expect(peakMoves).toBe(1);
    expect(planned.map(p => p.activeMoves)).toEqual([0, 0, 0]);
    expect(planned[1].firstFollower).toEqual({ x: -3, z: 3 });
    expect(states.slice(1).every(s => Math.hypot(s.x, s.z) < 5)).toBe(true);
});

test('blocked followers hit the original bounded gathering deadline', async () => {
    let clock = 0;
    await expect(gatherPartyFormation({ read: async () => [{ x: 0, z: 0 }, { x: 30, z: 0 }],
        move: async () => { clock += 1000; }, now: () => clock, timeout: 2000 })).rejects.toThrow('failed to gather');
});

test('a dead follower fails gathering without moving or disguising a wipe', async () => {
    const move = jest.fn();
    await expect(gatherPartyFormation({ read: async () => [{ x: 0, z: 0 }, { x: 30, z: 0, dead: true }], move }))
        .rejects.toThrow('cannot hide a death');
    expect(move).not.toHaveBeenCalled();
});

test('matching coordinates in different instances cannot satisfy formation', async () => {
    const move = jest.fn();
    await expect(gatherPartyFormation({ read: async () => [
        { x: 0, z: 0, instance: 'run-a' }, { x: 0, z: 0, instance: 'run-b' }
    ], move })).rejects.toThrow('cannot cross instances');
    expect(move).not.toHaveBeenCalled();
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
