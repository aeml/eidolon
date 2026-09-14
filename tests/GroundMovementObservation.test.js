import { groundMovementObserved } from './groundMovementObservation.js';

const before = { x: 19999.86762066857, z: 19957.67491337919, instanceType: 'verdant_bastion_catacombs', instanceId: 'run-a' };
const after = { x: 20000.02804926322, z: 19956.801398267533, state: 'IDLE', health: 929,
    instanceType: before.instanceType, instanceId: before.instanceId };
const arrival = { x: 19999.835235237577, z: 19951.8698252471, radius: 5, instanceId: before.instanceId };
test('recorded1157 Cleric position reached formation after less than one unit', () => {
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeCloseTo(.8881249823491228);
    expect(groundMovementObserved(before, after, 1)).toBe(false);
    expect(groundMovementObserved(before, after, 1, arrival)).toBe(true);
});
test.each([
    { state: 'DEAD' }, { health: 0 }, { instanceType: 'town' }, { instanceId: 'run-b' }, { x: NaN }, { z: before.z }
])('missing arrival, death or another scene cannot satisfy formation: %j', changes => {
    expect(groundMovementObserved(before, { ...after, ...changes }, 1, arrival)).toBe(false);
});
test.each([null, { ...arrival, radius: 0 }, { ...arrival, radius: NaN }, { ...arrival, x: Infinity }])('invalid region never replaces displacement proof: %j', region => {
    expect(groundMovementObserved(before, after, 1, region)).toBe(false);
});
test('ordinary larger displacement retains its existing behavior', () => {
    expect(groundMovementObserved(before, { ...after, x: before.x + 2 }, 1)).toBe(true);
});
test('recorded Pyrax short step remains failed, not reclassified as arrival', () => {
    const start = { x: 29983.39111383558, z: 18623.309917471095, instanceType: 'molten_core', instanceId: 'pyrax-diagnostic' };
    const stopped = { ...start, x: 29983.2178828706, z: 18622.734513238163, state: 'IDLE', health: 3050 };
    const destination = { x: 29983.20366734718, z: 18621.949458051866, radius: .25, instanceId: start.instanceId };
    expect(Math.hypot(stopped.x - start.x, stopped.z - start.z)).toBeCloseTo(.6009151341946743);
    expect(groundMovementObserved(start, stopped, 1)).toBe(false);
    expect(groundMovementObserved(start, stopped, 1, destination)).toBe(false);
});
