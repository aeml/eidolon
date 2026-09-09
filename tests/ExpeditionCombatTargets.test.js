import { chooseExpeditionCombatTarget, earthExpeditionSearchAnchor, levelAppropriateExpeditionTargets } from './expeditionCombatTargets.js';
import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';

test.each([
    ['Skeleton', 3, { x: 175, z: 200 }],
    ['Skeleton', 10, { x: 125, z: -150 }],
    ['Imp', 20, { x: -300, z: 200 }],
    ['DemonOrc', 30, { x: 300, z: 200 }],
    ['Construct', 40, { x: -800, z: 200 }]
])('Earth %s level%s search points into its authored sector', (enemy, minEnemyLevel, point) => {
    expect(earthExpeditionSearchAnchor({ huntingRealm: 'earth', enemy, minEnemyLevel })).toEqual(point);
});

test('the missing-ferry chapter searches western Earth, even though it belongs to Water story', () => {
    const hunt = chronicleHunts.find(hunt => hunt.id === 'chronicle_water_missing_ferry');
    expect(hunt.realm).toBe('water');
    expect(hunt.huntingRealm).toBe('earth');
    expect(earthExpeditionSearchAnchor(hunt)).toEqual({ x: -800, z: 200 });
});

test('unsupported realms or enemies never silently search the Demon Orc sector', () => {
    expect(() => earthExpeditionSearchAnchor({ huntingRealm: 'water', enemy: 'MountainTroll' })).toThrow();
    expect(() => earthExpeditionSearchAnchor({ huntingRealm: 'earth', enemy: 'Unknown' })).toThrow();
});

test('quest travel seeks an appropriate fight rather than the closest much stronger enemy', () => {
    const candidates = Object.freeze([
        Object.freeze({ level: 7, distance: 3 }), Object.freeze({ level: 3, distance: 10 }),
        Object.freeze({ level: 1, distance: 2 }), Object.freeze({ level: 4, distance: 6 })
    ]);
    expect(levelAppropriateExpeditionTargets(candidates, 3, 3)).toEqual([candidates[3], candidates[1]]);
    expect(candidates[0].level).toBe(7);
});

test('level-aware travel never lowers the server quest minimum', () => {
    expect(levelAppropriateExpeditionTargets([{ level: 9 }, { level: 10, distance: 5 }], 10, 3))
        .toEqual([{ level: 10, distance: 5 }]);
    expect(levelAppropriateExpeditionTargets([{ level: 7, distance: 3 }], 3, 3)).toEqual([]);
});

const target = Object.freeze({ id: 'quest-skeleton', level: 3, alive: true, distance: 15 });
test('nearby lower-level pursuer can be fought without changing quest eligibility', () => {
    const blocker = Object.freeze({ id: 'pursuer', level: 1, alive: true, distance: 5 });
    expect(chooseExpeditionCombatTarget(target, Object.freeze([blocker]))).toBe(blocker);
    expect(target.level).toBe(3);
});
test('keep the quest target when it is already the nearby threat', () => {
    const close = { ...target, distance: 6 };
    expect(chooseExpeditionCombatTarget(close, [{ id: 'other', alive: true, distance: 5 }])).toBe(close);
});
test('do not engage distant, dead or invalid bystanders', () => {
    expect(chooseExpeditionCombatTarget(target, [null, { alive: true, distance: NaN },
        { alive: false, distance: 2 }, { alive: true, distance: 8 }])).toBe(target);
});
test('select closest immediate threat independent of input order', () => {
    const near = { id: 'near', alive: true, distance: 3 }, far = { id: 'far', alive: true, distance: 7 };
    expect(chooseExpeditionCombatTarget(target, [far, near])).toBe(near);
    expect(chooseExpeditionCombatTarget(target, [near, far])).toBe(near);
});
test('a dead quest target is not repeatedly attacked', () => {
    expect(chooseExpeditionCombatTarget({ ...target, alive: false }, [])).toBeNull();
});
