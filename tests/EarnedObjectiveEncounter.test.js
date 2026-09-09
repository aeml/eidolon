import { jest } from '@jest/globals';
import { selectUnfinishedObjectiveTarget } from './earnedObjectiveEncounter.js';

test('credit arriving during real target selection does not request an impossible fourth opening kill', async () => {
    let count = 2;
    const select = jest.fn(async () => { count = 3; return { id: 'next-skeleton' }; });
    expect(await selectUnfinishedObjectiveTarget(async () => count, select, 3)).toBeNull();
    expect(select).toHaveBeenCalledTimes(1);
    expect(count).toBe(3);
});

test('an already-ready objective does not select or attack another target', async () => {
    const select = jest.fn();
    expect(await selectUnfinishedObjectiveTarget(async () => 3, select, 3)).toBeNull();
    expect(select).not.toHaveBeenCalled();
});

test('partial progress during selection uses the new baseline and still needs another earned credit', async () => {
    let count = 1;
    const target = { id: 'skeleton' };
    const result = await selectUnfinishedObjectiveTarget(async () => count,
        async () => { count = 2; return target; }, 3);
    expect(result).toEqual({ target, before: 2 });
});

test('an unfinished objective preserves the chosen target and existing credit', async () => {
    const target = { id: 'skeleton' };
    expect(await selectUnfinishedObjectiveTarget(async () => 0, async () => target, 3))
        .toEqual({ target, before: 0 });
});

test('target input failures still propagate', async () => {
    await expect(selectUnfinishedObjectiveTarget(async () => 1,
        async () => { throw new Error('input blocked'); }, 3)).rejects.toThrow('input blocked');
});

test.each([undefined, NaN, -1, 1.5])('invalid replicated count %s cannot be treated as completion', async count => {
    await expect(selectUnfinishedObjectiveTarget(async () => count, jest.fn(), 3)).rejects.toThrow('Invalid objective credit');
});
