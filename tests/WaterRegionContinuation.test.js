import { waterChapterContinuation } from './waterRegionContinuation.js';

const quest = overrides => Object.freeze({ id: 'chronicle_water_unmastered_current',
    accepted: false, completed: false, count: 0, maxCount: 70, ...overrides });

test.each([
    [{}, 'offered'],
    [{ accepted: true }, 'accepted'],
    [{ accepted: true, count: 20 }, 'accepted'],
    [{ accepted: true, count: 70 }, 'accepted'],
    [{ accepted: true, completed: true, count: 70 }, 'completed']
])('retains actual Water progress without converting ready into completed: %j', (fields, expected) => {
    const saved = quest(fields), before = JSON.stringify(saved);
    expect(waterChapterContinuation(saved)).toBe(expected);
    expect(JSON.stringify(saved)).toBe(before);
});

test.each([null, undefined,
    quest({ count: -1 }), quest({ count: 71 }), quest({ count: 1.5 }), quest({ count: NaN }),
    quest({ maxCount: 0 }), quest({ maxCount: Infinity }),
    quest({ count: 20 }), quest({ completed: true, count: 70 }),
    quest({ accepted: true, completed: true, count: 69 }),
    quest({ accepted: undefined }), quest({ completed: undefined })
])('rejects missing or inconsistent progress, never fabricates a handoff: %j', saved => {
    expect(() => waterChapterContinuation(saved)).toThrow('Missing or inconsistent saved Water chapter');
});
