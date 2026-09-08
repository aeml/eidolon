import { chooseExpeditionCombatTarget } from './expeditionCombatTargets.js';

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
