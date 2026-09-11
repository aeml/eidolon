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
