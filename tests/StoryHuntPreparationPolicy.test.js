import { storyHuntTrainingDue } from './storyHuntPreparationPolicy.js';

test.each([[3, 9, false], [9, 10, true], [10, 10, false], [10, 19, false],
    [10, 20, true], [19, 21, true], [20, 30, true], [30, 29, false]])(
    'earned training after preparation at %i and current level %i is %s', (prepared, current, expected) => {
        expect(storyHuntTrainingDue(prepared, current)).toBe(expected);
    });
test.each([0, -1, 1.5, NaN, Infinity])('rejects invalid level %p', level => {
    expect(() => storyHuntTrainingDue(level, 10)).toThrow();
    expect(() => storyHuntTrainingDue(9, level)).toThrow();
});
