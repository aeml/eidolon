import { jest } from '@jest/globals';
import fs from 'node:fs';
import { earthReadinessChapters } from './storyReadinessPolicy.js';
import { earnEarthHuntsBefore } from './earthFunctionalPrerequisites.js';

test('all three required Earth hunts are dispatched in authored order with actual eligibility', async () => {
    const earn = jest.fn();
    for (const next of ['chronicle_02_seeds_first_grove', 'chronicle_earth_returning_scar', 'chronicle_03_roots_remember']) {
        await earnEarthHuntsBefore(next, earn);
    }
    const hunts = earn.mock.calls.map(([hunt]) => hunt);
    expect(hunts.map(hunt => hunt.id)).toEqual(earthReadinessChapters.filter(id =>
        ['chronicle_earth_kept_watch', 'chronicle_earth_walking_ink', 'chronicle_earth_borrowed_oath'].includes(id)));
    expect(hunts.map(({ enemy, minEnemyLevel, count, huntingRealm }) => ({ enemy, minEnemyLevel, count, huntingRealm })))
        .toEqual([
            { enemy: 'Skeleton', minEnemyLevel: 3, count: 40, huntingRealm: 'earth' },
            { enemy: 'Imp', minEnemyLevel: 20, count: 60, huntingRealm: 'earth' },
            { enemy: 'DemonOrc', minEnemyLevel: 30, count: 50, huntingRealm: 'earth' }
        ]);
});

test('a failed actual hunt cannot be treated as a completed prerequisite', async () => {
    await expect(earnEarthHuntsBefore('chronicle_02_seeds_first_grove', async () => {
        throw new Error('qualifying kills missing');
    })).rejects.toThrow('qualifying kills missing');
});

test('unrelated and non-Earth chapters do not launch Earth hunts', async () => {
    const earn = jest.fn();
    await earnEarthHuntsBefore('chronicle_04_tears_sea', earn);
    await earnEarthHuntsBefore('unrelated', earn);
    expect(earn).not.toHaveBeenCalled();
});

test('the actual functional route invokes each prerequisite before its formerly skipped next chapter', () => {
    const source = fs.readFileSync('tests/e2e/chronicle-earth-route.js', 'utf8');
    for (const [prerequisite, next] of [
        ['await earnRequiredHunts(SEED_CHAPTER)', 'await acceptOfferedChapter(page, SEED_CHAPTER)'],
        ["await earnRequiredHunts('chronicle_earth_returning_scar')", "await earnEarthInvestigation(page, 'chronicle_earth_returning_scar', openIlyra)"],
        ['await earnRequiredHunts(EARTH_DUNGEON_CHAPTER)', 'await acceptOfferedChapter(page, EARTH_DUNGEON_CHAPTER)']
    ]) {
        expect(source.indexOf(prerequisite)).toBeGreaterThan(-1);
        expect(source.indexOf(prerequisite)).toBeLessThan(source.indexOf(next));
    }
    expect(source).toContain('target = await findExpeditionTarget(page, hunt)');
    expect(source).toContain('await claimChapterAndContinue(page, hunt.id)');
    expect(source).toContain('await maintainEarnedInventory(page');
    expect(source).toContain('seedsBeforeTurnIn - required');
});
