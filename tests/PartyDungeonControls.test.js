import { jest } from '@jest/globals';
import { acquirePartyAllyPointer, gatherPartyFormation, PARTY_FOLLOW_INPUT_OPTIONS, partyFollowStep, partyFormationStep, partyPathAvoidsActors, partyFormationPathsDisjoint, partyWarningInputPolicy, planPartyTelegraphEscape } from './partyDungeonControls.js';
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
    const first = partyFormationStep(follower, anchor, corner, (step, from) => clear(from)(step));
    expect(clear(follower)(first)).toBe(true);
    const second = partyFormationStep(corner, anchor, corner, (step, from) => clear(from)(step));
    expect(second).toEqual({ dx: 0, dz: 10 });
});

test('a teammate occupying the straight gathering destination gets a verified alternative', () => {
    const follower = { x: 0, z: 5.8 }, tank = { x: 0, z: 0 };
    const bodies = [{ ...tank, radius: 1.25 }, { x: 0, z: 2.5, radius: 1.25 }];
    const clear = (step, from = follower) => partyPathAvoidsActors(from, step, bodies);
    expect(clear(partyFollowStep(follower, tank))).toBe(false);
    const step = partyFormationStep(follower, tank, null, clear, 4, null, bodies);
    expect(clear(step)).toBe(true);
    expect(Math.abs(step.dx)).toBeGreaterThan(1);
});
test('side and rear slots leave a clear arrival lane inside the unchanged five-unit boundary', () => {
    const anchor = { x: 0, z: 0 }, previous = { x: 0, z: 12 };
    const followers = [0, 1, 2].map(() => ({ ...previous }));
    for (const [index, offset] of [Math.PI / 3, -Math.PI / 3, 0].entries()) {
        const follower = followers[index];
        const bodies = [anchor, ...followers.filter(other => other !== follower)];
        const step = partyFormationStep(follower, anchor, previous,
            (candidate, from) => partyPathAvoidsActors(from, candidate, bodies), 4, offset, bodies);
        follower.x += step.dx;
        follower.z += step.dz;
        expect(Math.hypot(follower.x, follower.z)).toBeCloseTo(4.5);
    }
    for (const [index, follower] of followers.entries()) {
        for (const other of followers.slice(index + 1)) {
            expect(Math.hypot(follower.x - other.x, follower.z - other.z)).toBeGreaterThan(2.6);
        }
    }
});
test('a nearby blocking body can be passed using a complete checked detour', () => {
    const follower = { x: 0, z: 18 }, tank = { x: 0, z: 0 };
    const bodies = [{ x: 0, z: 15, radius: 1.25 }];
    const clear = (step, from = follower) => partyPathAvoidsActors(from, step, bodies);
    for (let count = 0; partyFollowStep(follower, tank) && count < 8; count++) {
        const step = partyFormationStep(follower, tank, { x: 0, z: 14 }, clear, 4, null, bodies);
        expect(clear(step)).toBe(true);
        expect(Math.hypot(step.dx, step.dz)).toBeLessThanOrEqual(12.00001);
        follower.x += step.dx;
        follower.z += step.dz;
    }
    expect(partyFollowStep(follower, tank)).toBeNull();
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
test('recorded post-rest body barrier reaches formation without cycling through the previous anchor', () => {
    const follower = { x: 19957.501629686893, z: 19887.593814190874 };
    const anchor = { x: 19949.62800608872, z: 19887.402609344314 };
    const previous = { x: 19957.589265926803, z: 19887.585694589347 };
    const bodies = [anchor, { x: 19953.934357986913, z: 19884.873595691028 },
        { x: 19953.408112250418, z: 19889.393467331647 }];
    for (let count = 0; partyFollowStep(follower, anchor) && count < 8; count++) {
        const clear = (step, from = follower) => partyPathAvoidsActors(from, step, bodies);
        const step = partyFormationStep(follower, anchor, previous, clear, 4, -Math.PI / 3, bodies);
        expect(clear(step)).toBe(true);
        follower.x += step.dx;
        follower.z += step.dz;
    }
    expect(partyFollowStep(follower, anchor)).toBeNull();
});
test('recorded post-Warden follower positions have a complete body-clear route', () => {
    const follower = { x: 19959.79135649875, z: 19507.19396907301 };
    const anchor = { x: 19971.456330809397, z: 19499.363238894413 };
    const previous = { x: 19959.886184897914, z: 19507.23852946556 };
    const bodies = [anchor, { x: 19970.771101265793, z: 19503.25162702815 },
        { x: 19966.867154454183, z: 19500.528392315224 }];
    for (let count = 0; partyFollowStep(follower, anchor) && count < 8; count++) {
        const clear = (step, from = follower) => partyPathAvoidsActors(from, step, bodies);
        const step = partyFormationStep(follower, anchor, previous, clear, 4, 0, bodies);
        expect(clear(step)).toBe(true);
        follower.x += step.dx;
        follower.z += step.dz;
    }
    expect(partyFollowStep(follower, anchor)).toBeNull();
});
test('a legal intermediate sidestep without an onward route is not accepted', () => {
    const state = { x: 20, z: 0 }, anchor = { x: 0, z: 0 }, previous = { x: 20, z: 3 };
    const clear = (step, from) => from.x + step.dx >= 10;
    expect(clear({ dx: 0, dz: 3 }, state)).toBe(true);
    expect(() => partyFormationStep(state, anchor, previous, clear)).toThrow('no verified walking route');
});
test('an impassable crowded scene has bounded search rather than unchecked fallback input', () => {
    const bodies = Array.from({ length: 100 }, (_, index) => ({ x: 10 + index / 100, z: index / 100 }));
    const clear = jest.fn(() => false);
    expect(() => partyFormationStep({ x: 20, z: 0 }, { x: 0, z: 0 }, { x: 20, z: 3 }, clear, 4, 0, bodies))
        .toThrow('no verified walking route');
    expect(clear.mock.calls.length).toBeLessThan(150);
});
test('sub-millimetre replicated spawn offsets use the collision system coincident-body rule', () => {
    const from = { x: 19999.907985236892, z: 19990.008490300283 };
    const body = { x: 19999.908203125, z: 19990.0078125, radius: 1.25 };
    expect(partyPathAvoidsActors(from, { dx: 0, dz: -6 }, [body])).toBe(true);
});
test('formation preserves an already-safe direct step and refuses an unverified alternative', () => {
    const follower = { x: 0, z: 0 }, anchor = { x: 14, z: 0 };
    expect(partyFormationStep(follower, anchor, null, () => true)).toEqual({ dx: 10, dz: 0 });
    expect(() => partyFormationStep(follower, anchor, { x: 0, z: 2 }, () => false)).toThrow('no verified walking route');
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
    expect(planned.every(p => p.activeMoves === 0)).toBe(true);
    expect(planned.filter(p => p.index === 2).at(-1).firstFollower).toEqual({ x: -3, z: 3 });
    expect(states.slice(1).every(s => Math.hypot(s.x, s.z) < 5)).toBe(true);
});

test('disjoint follower lanes move together without extending the original gathering deadline', async () => {
    const states = [{ x: 0, z: 0 }, { x: -4, z: 12 }, { x: 4, z: 12 }, { x: 0, z: 16 }];
    const destinations = [null, { x: -4, z: 1 }, { x: 4, z: 1 }, { x: 0, z: 4 }];
    let clock = 0, active = 0, peak = 0;
    await gatherPartyFormation({ read: async () => states.map(s => ({ ...s })), now: () => clock,
        plan: async (index, state) => ({ dx: destinations[index].x - state.x, dz: destinations[index].z - state.z }),
        move: async (index, step) => {
            const began = clock;
            peak = Math.max(peak, ++active);
            await Promise.resolve();
            clock = Math.max(clock, began + 6000);
            Object.assign(states[index], { x: states[index].x + step.dx, z: states[index].z + step.dz });
            active--;
        } });
    expect(peak).toBe(3);
    expect(clock).toBe(6000);
    expect(states.slice(1).every(s => Math.hypot(s.x, s.z) < 5)).toBe(true);
});

test.each([
    [{ x: 0, z: 0 }, { dx: 12, dz: 0 }, { x: 0, z: 3 }, { dx: 12, dz: 0 }, true],
    [{ x: 0, z: 0 }, { dx: 12, dz: 0 }, { x: 0, z: 2.59 }, { dx: 12, dz: 0 }, false],
    [{ x: 0, z: 0 }, { dx: 12, dz: 0 }, { x: 6, z: -5 }, { dx: 0, dz: 10 }, false],
    [{ x: 0, z: 0 }, { dx: 4, dz: 12 }, { x: 0, z: 0 }, { dx: -4, dz: 12 }, false],
    [{ x: 0, z: 0 }, { dx: 12, dz: 0 }, { x: 10, z: 0 }, { dx: -4, dz: 0 }, false],
    [{ x: 0, z: 0 }, { dx: 4, dz: 0 }, { x: 10, z: 0 }, { dx: 4, dz: 0 }, true],
    [{ x: 0, z: 0 }, { dx: 4, dz: 0 }, { x: 5, z: 2 }, { dx: 0, dz: 4 }, false],
    [{ x: 0, z: 0, radius: 3 }, { dx: 12, dz: 0 }, { x: 0, z: 5, radius: 3 }, { dx: 12, dz: 0 }, false]
])('concurrent paths reserve the whole actor capsule: %j %j %j %j', (first, a, second, b, expected) => {
    expect(partyFormationPathsDisjoint(first, a, second, b)).toBe(expected);
    expect(partyFormationPathsDisjoint(second, b, first, a)).toBe(expected);
});
test.each([{ dx: 0, dz: 0 }, { dx: NaN, dz: 1 }, { dx: Infinity, dz: 0 }])('invalid reservations fail closed: %j', step => {
    expect(partyFormationPathsDisjoint({ x: 0, z: 0 }, step, { x: 5, z: 5 }, { dx: 2, dz: 0 })).toBe(false);
});
test('a failed batch waits for every issued move and records the failure without accepting formation', async () => {
    let finishedOther = false;
    const trace = jest.fn();
    await expect(gatherPartyFormation({ read: async () => [{ x: 0, z: 0 }, { x: -4, z: 12 }, { x: 4, z: 12 }],
        plan: async () => ({ dx: 0, dz: -10 }), trace,
        move: async index => {
            if (index === 1) throw new Error('real input failed');
            await Promise.resolve();
            await Promise.resolve();
            finishedOther = true;
        } })).rejects.toThrow('real input failed');
    expect(finishedOther).toBe(true);
    expect(trace.mock.calls.map(([entry]) => entry.phase)).toEqual(['planned', 'settled']);
    expect(trace.mock.calls[1][0].members).toEqual([{ index: 1, outcome: 'rejected' }, { index: 2, outcome: 'fulfilled' }]);
});
test('reservations use the actual planning origin rather than an older group snapshot', async () => {
    const states = [{ x: 0, z: 0 }, { x: -4, z: 12 }, { x: 4, z: 12 }];
    const trace = jest.fn();
    let active = 0, peak = 0;
    await gatherPartyFormation({ read: async () => states.map(s => ({ ...s })), trace,
        plan: async () => ({ dx: 0, dz: -10, origin: { x: 0, z: 12 } }),
        move: async index => {
            peak = Math.max(peak, ++active);
            await Promise.resolve();
            states[index].z = 2;
            active--;
        } });
    expect(peak).toBe(1);
    expect(trace.mock.calls[0][0].members[0].from).toEqual({ x: 0, z: 12 });
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
