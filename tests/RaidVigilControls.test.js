import { raidVigilDestination, raidVigilSupportAnchor, raidVigilRecoveryAnchor } from './raidVigilControls.js';

const point = (x = 0, radius = 6) => ({ x, z: 0, radius, label: 'marker', state: 'active' });
const crystal = (element, current = 0, hint = '') => ({ stage: 'repairing', element,
    objective: { current, hint, points: [point(0), point(30), point(60), point(90)] } });

test('Air runner rejoins nearby healing after passing its anchor rather than waiting alone for tank credit', () => {
    const wizard = { x: 109975.1548128499, z: 19280.43283794859, hp: 2700, instance: 'raid' };
    const tankHealer = { x: 109994.13292991625, z: 19318.572248725173, hp: 2975, instance: 'raid' };
    const escort = { x: 110005.69156205864, z: 19280.405858986054, hp: 2338, instance: 'raid' };
    expect(raidVigilRecoveryAnchor(crystal('Air', 3), 2, wizard, [tankHealer, escort])).toBe(escort);
    expect(raidVigilRecoveryAnchor(crystal('Air', 2), 2, wizard, [escort])).toBeNull();
    const completed = crystal('Air', 4);
    completed.objective.complete = true;
    expect(raidVigilRecoveryAnchor(completed, 2, wizard, [escort])).toBe(escort);
    expect(raidVigilRecoveryAnchor(completed, 2, wizard, [{ ...escort, x: wizard.x + 8, z: wizard.z }])).toBeNull();
    for (const changes of [{ dead: true }, { hp: 0 }, { instance: 'town' }, { x: NaN }]) {
        expect(raidVigilRecoveryAnchor(completed, 2, wizard, [{ ...escort, ...changes }])).toBeNull();
    }
    expect(raidVigilRecoveryAnchor(completed, 2, { ...wizard, dead: true }, [escort])).toBeNull();
    expect(raidVigilRecoveryAnchor({ ...completed, stage: 'restored' }, 2, wizard, [escort])).toBeNull();
});

test('second healer accompanies a healthy Fire runner before the recorded out-of-range injury', () => {
    const states = Array.from({ length: 5 }, (_, id) => ({ id, hp: 3050, dead: false, instance: 'raid' }));
    expect(raidVigilSupportAnchor(crystal('Fire'), 4, states)).toBe(states[3]);
    expect(raidVigilSupportAnchor(crystal('Fire'), 1, states)).toBeNull();
    expect(raidVigilSupportAnchor(crystal('Fire'), 4, states.slice(0, 4))).toBeNull();
});

test('runner support follows personal Air turns and releases completed or unavailable objectives', () => {
    const states = Array.from({ length: 5 }, (_, id) => ({ id, hp: 3050, dead: false, instance: 'raid' }));
    expect(raidVigilSupportAnchor(crystal('Air', 0), 4, states)).toBe(states[2]);
    expect(raidVigilSupportAnchor(crystal('Air', 1), 4, states)).toBe(states[3]);
    for (const change of [{ complete: true }, { paused: true }, { points: [] }]) {
        const state = crystal('Fire');
        Object.assign(state.objective, change);
        expect(raidVigilSupportAnchor(state, 4, states)).toBeNull();
    }
    for (const change of [{ hp: 0 }, { dead: true }, { instance: 'town' }]) {
        const changed = states.map(s => ({ ...s }));
        Object.assign(changed[3], change);
        expect(raidVigilSupportAnchor(crystal('Fire'), 4, changed)).toBeNull();
    }
});

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
