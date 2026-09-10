import { DUNGEON_UNLOCK_LEVEL } from '../src/data/dungeonProgression.js';

export const earthReadinessChapters = Object.freeze([
    'chronicle_01_bell_below', 'chronicle_earth_keepers_house',
    'chronicle_earth_kept_watch', 'chronicle_02_seeds_first_grove',
    'chronicle_earth_walking_ink', 'chronicle_earth_returning_scar',
    'chronicle_earth_borrowed_oath'
]);
export const earthReadinessDungeon = 'chronicle_03_roots_remember';

export function storyOnlyDungeonEnabled(env = process.env) {
    const flag = env.EIDOLON_E2E_FRESH_STORY_DUNGEON;
    if (flag !== undefined && flag !== '0' && flag !== '1') throw new Error('EIDOLON_E2E_FRESH_STORY_DUNGEON must be 0 or 1');
    if (flag !== '1') return false;
    if (!storyOnlyReadinessEnabled(env)) throw new Error('Story-only dungeon requires strict story-only readiness first');
    if (!['Wizard', 'Fighter'].includes(env.EIDOLON_E2E_CLASS || 'Wizard')) {
        throw new Error('Earned dungeon driver currently supports Wizard or Fighter; other classes require their own verification');
    }
    return true;
}

export function storyOnlyReadinessEnabled(env = process.env) {
    const flag = env.EIDOLON_E2E_FRESH_STORY_READY;
    if (flag !== undefined && flag !== '0' && flag !== '1') {
        throw new Error('EIDOLON_E2E_FRESH_STORY_READY must be 0 or 1');
    }
    if (flag !== '1') return false;
    if (env.EIDOLON_E2E_FRESH_COLLECTION !== '1') {
        throw new Error('Story-only readiness requires the complete fresh Earth collection route');
    }
    for (const name of ['FRESH_HUNT', 'FRESH_READY', 'FRESH_DUNGEON',
        'FRESH_STORY_HUNT', 'FRESH_EARLY_PREPARATION', 'PREPARED_COLLECTION']) {
        if (env[`EIDOLON_E2E_${name}`] === '1') {
            throw new Error(`Story-only readiness cannot include ${name} comparison or legacy daily routes`);
        }
    }
    return true;
}

// Diagnose missing earned evidence; never manufacture progress to make entry
// possible. This deliberately fails an otherwise complete but underlevel route.
export function storyReadinessProblems(snapshot) {
    const problems = [];
    if (!Number.isInteger(snapshot?.level) || snapshot.level < DUNGEON_UNLOCK_LEVEL) {
        problems.push(`Authored Earth route reached level ${snapshot?.level}; requires ${DUNGEON_UNLOCK_LEVEL}`);
    }
    const quests = snapshot?.quests || [];
    for (const id of earthReadinessChapters) {
        if (!quests.some(quest => quest.id === id && quest.completed === true)) {
            problems.push(`Missing manually completed chapter ${id}`);
        }
    }
    const dungeon = quests.find(quest => quest.id === earthReadinessDungeon);
    if (dungeon?.accepted !== true || dungeon.completed !== false || dungeon.count !== 0) {
        problems.push('The Earth dungeon must be accepted, uncompleted and uncleared');
    }
    for (const quest of quests) {
        if (quest.id?.startsWith('daily_') && (quest.accepted || quest.completed)) {
            problems.push(`Daily contract ${quest.id} contaminated the story-only route`);
        }
    }
    return problems;
}
