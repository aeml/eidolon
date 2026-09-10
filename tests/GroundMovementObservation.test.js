import { groundMovementObserved } from './groundMovementObservation.js';

const before = { x: 19999.86762066857, z: 19957.67491337919, instanceType: 'verdant_bastion_catacombs' };
const after = { x: 20000.02804926322, z: 19956.801398267533, state: 'IDLE', health: 929,
    instanceType: before.instanceType };
const arrival = { x: 19999.835235237577, z: 19951.8698252471, radius: 5 };
test('recorded1157 Cleric position reached formation after less than one unit', () => {
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeCloseTo(.8881249823491228);
    expect(groundMovementObserved(before, after, 1)).toBe(false);
    expect(groundMovementObserved(before, after, 1, arrival)).toBe(true);
});
test.each([
    { state: 'DEAD' }, { health: 0 }, { instanceType: 'town' }, { x: NaN }, { z: before.z }
])('missing arrival, death or another scene cannot satisfy formation: %j', changes => {
    expect(groundMovementObserved(before, { ...after, ...changes }, 1, arrival)).toBe(false);
});
test.each([null, { ...arrival, radius: 0 }, { ...arrival, radius: NaN }, { ...arrival, x: Infinity }])('invalid region never replaces displacement proof: %j', region => {
    expect(groundMovementObserved(before, after, 1, region)).toBe(false);
});
test('ordinary larger displacement retains its existing behavior', () => {
    expect(groundMovementObserved(before, { ...after, x: before.x + 2 }, 1)).toBe(true);
});
