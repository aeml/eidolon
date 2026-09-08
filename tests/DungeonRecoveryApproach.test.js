import { reachedRecoveryEncounter } from './dungeonRecoveryApproach.js';

const room = { x: 20055, z: 19820, width: 100, height: 100 };
const player = { x: 20055, z: 19830, state: 'IDLE' };
const enemy = { x: 20055, z: 19820, hostile: true, health: 100, state: 'MOVING' };

test('stop inside the actual encounter and let nearby melee close the final gap', () => {
    expect(reachedRecoveryEncounter(room, player, [enemy])).toBe(true);
});
test.each([
    [{ ...player, z: 19873 }, { ...enemy, z: 19863 }],
    [player, { ...enemy, z: 19800 }],
    [player, { ...enemy, hostile: false }],
    [player, { ...enemy, health: 0 }],
    [player, { ...enemy, state: 'DEAD' }],
    [{ ...player, state: 'DEAD' }, enemy]
])('do not mistake corridor proximity, allies or dead actors for an encounter', (p, e) => {
    expect(reachedRecoveryEncounter(room, p, [e])).toBe(false);
});
