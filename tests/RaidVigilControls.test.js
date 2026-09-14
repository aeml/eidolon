import { raidVigilDestination } from './raidVigilControls.js';

const point = (x = 0, radius = 6) => ({ x, z: 0, radius, label: 'marker', state: 'active' });
const crystal = (element, current = 0, hint = '') => ({ stage: 'repairing', element,
    objective: { current, hint, points: [point(0), point(30), point(60), point(90)] } });

test.each(['Earth', 'Water', 'Fire', 'Air'])('%s leaves tank and both healers on combat support', element => {
    for (const index of [0, 1, 4]) expect(raidVigilDestination(crystal(element), index)).toBeNull();
});

test('Earth runner stays inside the ward but off the NPC center', () => {
    const state = crystal('Earth');
    state.objective.points[0] = point(100, 12);
    expect(raidVigilDestination(state, 3)).toEqual({ x: 106, z: 0, tolerance: 1, label: 'marker' });
});

test('Water follows the personal carried-memory state rather than an invented pickup timer', () => {
    expect(raidVigilDestination(crystal('Water'), 3).x).toBe(3);
    expect(raidVigilDestination(crystal('Water', 0, 'You carry a memory. Return to Maelin.'), 3).x).toBe(33);
    expect(raidVigilDestination(crystal('Water', 1), 3).x).toBe(3);
});

test('Fire follows the server current step without skipping a two-second channel', () => {
    for (const step of [0, 1, 2]) expect(raidVigilDestination(crystal('Fire', step), 3).x).toBe(step * 30 + 3);
});

test('Air alternates real runners and respects the personal last-carrier instruction', () => {
    for (const step of [0, 1, 2, 3]) {
        const chosen = 2 + step % 2;
        expect(raidVigilDestination(crystal('Air', step), chosen).x).toBe(step * 30 + 3);
        expect(raidVigilDestination(crystal('Air', step), chosen === 2 ? 3 : 2)).toBeNull();
        expect(raidVigilDestination(crystal('Air', step, 'You passed the wind. Let another raider touch the next bright anchor.'), chosen)).toBeNull();
    }
});

test('completed, paused, missing and malformed objectives never request movement', () => {
    expect(raidVigilDestination(null, 3)).toBeNull();
    for (const change of [{ complete: true }, { paused: true }, { current: 99 }, { points: [] }, { points: [point(NaN)] }]) {
        const state = crystal('Fire');
        Object.assign(state.objective, change);
        expect(raidVigilDestination(state, 3)).toBeNull();
    }
    expect(raidVigilDestination({ ...crystal('Earth'), stage: 'restored' }, 3)).toBeNull();
});
