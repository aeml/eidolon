import { chooseExpeditionCombatTarget, levelAppropriateExpeditionTargets } from './expeditionCombatTargets.js';

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
