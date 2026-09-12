import { planPartyRangedSpacing } from './partyRangedSpacing.js';

const state = { x: 7.5, z: 0, radius: 1.25 };
const enemy = { x: 0, z: 0, range: 20.5 };
const healer = { x: 12, z: 4, range: 14 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('a ranged actor leaves melee while remaining inside actual attack and heal ranges', () => {
    const step = planPartyRangedSpacing(state, enemy, healer);
    const end = { x: state.x + step.dx, z: state.z + step.dz };
    expect(distance(end, enemy)).toBeGreaterThan(15);
    expect(distance(end, enemy)).toBeLessThan(enemy.range);
    expect(distance(end, healer)).toBeLessThan(healer.range);
    expect(Math.hypot(step.dx, step.dz)).toBeLessThanOrEqual(12);
});
test('already well-spaced damage roles do not continuously kite instead of attacking', () => {
    expect(planPartyRangedSpacing({ x: 17, z: 0 }, enemy, healer)).toBeNull();
});
test('a role outside healer reach moves toward a jointly reachable attack position', () => {
    const start = { x: 8, z: 15 }, support = { x: 14, z: 0, range: 14 };
    const step = planPartyRangedSpacing(start, enemy, support);
    expect(step).not.toBeNull();
    const end = { x: start.x + step.dx, z: start.z + step.dz };
    expect(distance(end, support)).toBeLessThan(support.range);
    expect(distance(end, enemy)).toBeLessThan(enemy.range);
});
test('blocked full paths and unreachable healer geometry never fabricate a legal move', () => {
    expect(planPartyRangedSpacing(state, enemy, healer, () => false)).toBeNull();
    expect(planPartyRangedSpacing(state, enemy, { x: -80, z: 0, range: 14 })).toBeNull();
});
test('actor bodies exclude a direct route while permitting a verified side step', () => {
    const blocker = { x: 12, z: 0, radius: 2 };
    const step = planPartyRangedSpacing(state, enemy, healer, () => true, [blocker]);
    expect(step).not.toBeNull();
    expect(Math.abs(step.dz)).toBeGreaterThan(1);
});
test('every candidate is checked against complete floor and encounter geometry', () => {
    const step = planPartyRangedSpacing(state, enemy, healer, delta => delta.dz < -3);
    expect(step.dz).toBeLessThan(-3);
});
test.each([
    [{ x: NaN, z: 0 }, enemy, healer],
    [state, { ...enemy, range: 4 }, healer],
    [state, enemy, { ...healer, range: 0 }],
    [state, enemy, null],
])('invalid or melee-only observations do not authorize movement', (origin, target, support) => {
    expect(planPartyRangedSpacing(origin, target, support)).toBeNull();
});
