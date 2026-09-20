import { jest } from '@jest/globals';
import { partyFormationArrival, gatherPartyFormation } from './partyDungeonControls.js';
import { groundMovementObserved } from './groundMovementObservation.js';

// Exact native93038 geometry: a successful detour stopped before reaching the
// generic one-unit witness, still far from final party formation.
const before = { x: 19998.853166419776, z: 19901.272430616034,
    instanceId: 'recorded-run', instanceType: 'verdant_bastion_catacombs' };
const step = { dx: .4241147920183721, dz: 1.005850293498952 };
const after = { ...before, x: 19999.181221393057, z: 19902.189741240305, state: 'IDLE', health: 845 };
const anchor = { x: 20013.858489897633, z: 19904.96404559492, instance: before.instanceId };

test('recorded short detour reaches its own waypoint without claiming final formation', () => {
    const arrival = partyFormationArrival(before, step, before.instanceId);
    expect(Math.hypot(after.x-before.x, after.z-before.z)).toBeCloseTo(.9742067783042863);
    expect(groundMovementObserved(before, after, 1)).toBe(false);
    expect(groundMovementObserved(before, after, 1, { ...anchor, radius: 5, instanceId: before.instanceId })).toBe(false);
    expect(groundMovementObserved(before, after, 1, arrival)).toBe(true);
    expect(Math.hypot(after.x-anchor.x, after.z-anchor.z)).toBeGreaterThan(14);
    expect(groundMovementObserved(before, { ...before, health: 845, state: 'IDLE' }, 1, arrival)).toBe(false);
});

test.each([
    { x: before.x - 3, z: before.z },
    { instanceId: 'other' },
    { instanceType: 'town' },
    { state: 'DEAD' },
    { health: 0 }
])('long displacement cannot bypass directional/living/same-instance guards: %j', changes => {
    const arrival = partyFormationArrival(before, { dx: 3, dz: 3 }, before.instanceId);
    const moved = { ...before, x: arrival.x, z: arrival.z, state: 'IDLE', health: 845, ...changes };
    expect(Math.hypot(moved.x - before.x, moved.z - before.z)).toBeGreaterThan(1);
    expect(groundMovementObserved(before, moved, 1, arrival)).toBe(false);
});

test('recorded Molten input makes real progress and the separate group check verifies completion', async () => {
    const origin = { x: 30066.646778653987, z: 19866.18200618761,
        instanceId: 'molten-recorded', instanceType: 'molten_core' };
    const arrival = { x: 30066.77768815623, z: 19864.20689388378,
        radius: .25, instanceId: origin.instanceId };
    const moved = { ...origin, x: 30066.63615705585, z: 19863.68996559045, health: 3025, state: 'IDLE' };
    expect(Math.hypot(moved.x - origin.x, moved.z - origin.z)).toBeCloseTo(2.4920632327940346);
    expect(Math.hypot(moved.x - arrival.x, moved.z - arrival.z)).toBeGreaterThan(.25);
    expect(groundMovementObserved(origin, moved, 1, arrival)).toBe(true);
    const positions = [
        { x: 30066.771334127185, z: 19859.706898369746 },
        { x: 30062.741072444645, z: 19861.922746587676 },
        { x: 30070.567444065673, z: 19861.85309248544 }, moved
    ].map(position => ({ ...position, instance: origin.instanceId, dead: false }));
    const move = jest.fn();
    await gatherPartyFormation({ read: async () => positions, move });
    expect(move).not.toHaveBeenCalled();
    // A valid individual movement witness must not count as group completion.
    positions[3] = { ...positions[3], z: positions[0].z + 10 };
    let clock = 0;
    await expect(gatherPartyFormation({ read: async () => positions, now: () => clock,
        timeout: 2000, move: async () => { clock += 1000; } })).rejects.toThrow('failed to gather');
});

test('an unchanged observation inside an arrival region is not a witnessed walking step', () => {
    expect(groundMovementObserved(before, { ...before, state: 'IDLE', health: 845 }, 1,
        { x: before.x, z: before.z, radius: .25, instanceId: before.instanceId })).toBe(false);
});

test('long displacement still succeeds at the required living same-instance waypoint', () => {
    const arrival = partyFormationArrival(before, { dx: 3, dz: 3 }, before.instanceId);
    expect(groundMovementObserved(before, { ...before, x: arrival.x, z: arrival.z, state: 'IDLE', health: 845 },
        1, arrival)).toBe(true);
});

test.each([{ health: 0 }, { state: 'DEAD' }, { instanceId: 'other' },
    { instanceType: 'town' }, { x: NaN }, { x: before.x, z: before.z }])(
    'detour acceptance retains alive/current-instance/real-motion guards: %j', changes => {
        expect(groundMovementObserved(before, { ...after, ...changes }, 1,
            partyFormationArrival(before, step, before.instanceId))).toBe(false);
    });

test.each([[null, step, 'run'], [before, null, 'run'], [before, { dx: 0, dz: 0 }, 'run'],
    [before, { dx: Infinity, dz: 1 }, 'run'], [before, step, ''], [before, step, null]])(
    'invalid waypoint fails closed: %j %j %j', (origin, delta, instance) => {
        expect(() => partyFormationArrival(origin, delta, instance)).toThrow();
    });

test('an accepted detour still requires more walking and cannot silently finish gathering', async () => {
    let clock = 0;
    const move = jest.fn(async () => { clock += 1000; });
    await expect(gatherPartyFormation({ read: async () => [anchor, { ...after, instance: anchor.instance }],
        move, now: () => clock, timeout: 2000 })).rejects.toThrow('failed to gather');
    expect(move).toHaveBeenCalledTimes(2);
});
