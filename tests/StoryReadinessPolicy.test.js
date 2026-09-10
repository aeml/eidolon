import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { earthReadinessChapters, earthReadinessDungeon, storyOnlyReadinessEnabled, storyOnlyDungeonEnabled,
    storyReadinessProblems } from './storyReadinessPolicy.js';

const earned = () => ({ level: 30, quests: [
    ...earthReadinessChapters.map(id => ({ id, accepted: true, completed: true })),
    { id: earthReadinessDungeon, accepted: true, completed: false, count: 0 },
    { id: 'daily_imp', accepted: false, completed: false, count: 0 }
] });
const mode = () => ({ EIDOLON_E2E_FRESH_STORY_READY: '1', EIDOLON_E2E_FRESH_COLLECTION: '1' });

test('story-only dungeon is explicit, requires strict readiness and rejects legacy daily leveling', () => {
    expect(storyOnlyDungeonEnabled({})).toBe(false);
    expect(() => storyOnlyDungeonEnabled({ EIDOLON_E2E_FRESH_STORY_DUNGEON: 'yes' })).toThrow('0 or 1');
    expect(() => storyOnlyDungeonEnabled({ EIDOLON_E2E_FRESH_STORY_DUNGEON: '1' })).toThrow('strict story-only readiness');
    const enabled = { ...mode(), EIDOLON_E2E_FRESH_STORY_DUNGEON: '1' };
    expect(storyOnlyDungeonEnabled(enabled)).toBe(true);
    for (const name of ['FRESH_HUNT', 'FRESH_READY', 'FRESH_DUNGEON']) {
        expect(() => storyOnlyDungeonEnabled({ ...enabled, [`EIDOLON_E2E_${name}`]: '1' })).toThrow(name);
    }
    for (const className of ['Wizard', 'Fighter', 'Rogue', 'Cleric']) {
        expect(storyOnlyDungeonEnabled({ ...enabled, EIDOLON_E2E_CLASS: className })).toBe(true);
    }
    expect(() => storyOnlyDungeonEnabled({ ...enabled, EIDOLON_E2E_CLASS: 'Unknown' })).toThrow('No earned dungeon driver');
});

test('new route extends strict readiness and leaves the existing release gate intact', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('EIDOLON_E2E_FRESH_STORY_DUNGEON=1 run_fresh_story_ready');
    expect(script).toContain('fresh-story-dungeon)\n    run_fresh_story_dungeon');
    expect(script).toContain('run_qa_stage fresh-collection run_fresh_story_ready');
    const opening = readFileSync('tests/e2e/fresh-opening-gameplay.spec.js', 'utf8');
    expect(opening.indexOf('storyOnlyDungeonEnabled();')).toBeLessThan(opening.indexOf('await loginAndEnterWorld('));
    expect(opening).toContain('const storyTimeout = storyOnlyDungeon ? freshStoryDungeonTimeout : freshStoryTimeout;');
    expect(opening).toContain('includeDungeon: storyOnlyDungeon');
    expect(opening).toContain('await clearEarnedVerdant(page, credentials, { runPhase,');
    expect(opening).toContain("captureEntry: receipt => testInfo.attach('earned-dungeon-entry'");
    expect(opening).toContain("expect(usedDailies, 'Dungeon completion must not introduce daily-quest leveling').toEqual([])");
});

test.each(['Wizard', 'Fighter', 'Rogue', 'Cleric'])('story-only dungeon shell route preserves all prerequisite flags for %s', className => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const functions = ['run_fresh_collection', 'run_fresh_story_ready', 'run_fresh_story_dungeon'].map(name =>
        script.match(new RegExp(`${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}`))[0]);
    const result = spawnSync('bash', ['-c', `${functions.join('\n')}
        QA_USERNAME_BASE=story-dungeon-fixture
        npx() {
            printf '%s\\n' "$EIDOLON_E2E_CLASS" "$EIDOLON_E2E_FRESH_COLLECTION" "$EIDOLON_E2E_FRESH_STORY_READY" "$EIDOLON_E2E_FRESH_STORY_DUNGEON" "${'${EIDOLON_E2E_FRESH_HUNT:-unset}'}" "${'${EIDOLON_E2E_FRESH_READY:-unset}'}" "$*"
            return 19
        }
        run_fresh_story_dungeon
    `], { encoding: 'utf8', timeout: 5000, env: { PATH: process.env.PATH, EIDOLON_E2E_FRESH_CLASS: className } });
    expect(result.status).toBe(19);
    expect(result.stdout.trim().split('\n')).toEqual([className, '1', '1', '1', 'unset', 'unset',
        'playwright test tests/e2e/fresh-opening-gameplay.spec.js']);
});

test('complete level30 story evidence qualifies without changing the snapshot', () => {
    const snapshot = earned(), before = JSON.stringify(snapshot);
    expect(storyReadinessProblems(snapshot)).toEqual([]);
    expect(JSON.stringify(snapshot)).toBe(before);
});
test.each([1, 29, 29.9, NaN, undefined])('level %s does not silently qualify after all chapters', level => {
    expect(storyReadinessProblems({ ...earned(), level })).toEqual([expect.stringContaining('requires 30')]);
});
test.each(earthReadinessChapters)('missing manual completion of %s blocks acceptance', id => {
    const snapshot = earned();
    snapshot.quests.find(quest => quest.id === id).completed = false;
    expect(storyReadinessProblems(snapshot)).toEqual([expect.stringContaining(id)]);
});
test.each([{ accepted: false }, { completed: true }, { count: 1 }])('a stale dungeon state %j cannot prove fresh entry', state => {
    const snapshot = earned();
    Object.assign(snapshot.quests.find(quest => quest.id === earthReadinessDungeon), state);
    expect(storyReadinessProblems(snapshot)).toEqual([expect.stringContaining('uncleared')]);
});
test.each([{ accepted: true }, { completed: true }])('daily involvement %j is rejected', state => {
    const snapshot = earned();
    Object.assign(snapshot.quests.find(quest => quest.id === 'daily_imp'), state);
    expect(storyReadinessProblems(snapshot)).toEqual([expect.stringContaining('daily_imp')]);
});
test('missing snapshot fails closed', () => {
    expect(storyReadinessProblems(null)).toHaveLength(earthReadinessChapters.length + 2);
});
test('explicit mode requires complete Earth play and defaults off for diagnostics', () => {
    expect(storyOnlyReadinessEnabled({})).toBe(false);
    expect(storyOnlyReadinessEnabled({ EIDOLON_E2E_FRESH_STORY_READY: '0' })).toBe(false);
    expect(storyOnlyReadinessEnabled(mode())).toBe(true);
    expect(() => storyOnlyReadinessEnabled({ EIDOLON_E2E_FRESH_STORY_READY: '1' })).toThrow('complete fresh Earth');
});
test.each(['true', '', 'off'])('invalid mode %j fails before gameplay', flag => {
    expect(() => storyOnlyReadinessEnabled({ ...mode(), EIDOLON_E2E_FRESH_STORY_READY: flag })).toThrow('0 or 1');
});
test.each(['FRESH_HUNT', 'FRESH_READY', 'FRESH_DUNGEON', 'FRESH_STORY_HUNT',
    'FRESH_EARLY_PREPARATION', 'PREPARED_COLLECTION'])('rejects incompatible %s mode', name => {
    expect(() => storyOnlyReadinessEnabled({ ...mode(), [`EIDOLON_E2E_${name}`]: '1' })).toThrow(name);
});
test('the complete release chain requires story readiness while collection diagnostics stay available', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const opening = readFileSync('tests/e2e/fresh-opening-gameplay.spec.js', 'utf8');
    expect(script).toContain('run_qa_stage fresh-collection run_fresh_story_ready');
    expect(script).toContain('EIDOLON_E2E_FRESH_STORY_READY=1 run_fresh_collection');
    expect(script).toContain('fresh-story-ready)\n    run_fresh_story_ready');
    expect(script).toContain('fresh-collection)\n    run_fresh_collection');
    expect(opening.indexOf('storyOnlyReadinessEnabled();')).toBeGreaterThan(0);
    expect(opening.indexOf('storyOnlyReadinessEnabled();')).toBeLessThan(opening.indexOf('await loginAndEnterWorld('));
    expect(opening).toContain("await runPhase('readiness', () => verifyStoryOnlyEarthReadiness(page));");
    expect(opening).toContain('runPhase.assertComplete();');
});

test.each(['Wizard', 'Fighter', 'Rogue', 'Cleric'])('actual shell wrapper passes story-only flags for %s and propagates failure', className => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const functions = ['run_fresh_collection', 'run_fresh_story_ready'].map(name => {
        const match = script.match(new RegExp(`${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}`));
        expect(match).not.toBeNull();
        return match[0];
    });
    const result = spawnSync('bash', ['-c', `${functions.join('\n')}
        QA_USERNAME_BASE=story-ready-fixture
        npx() {
            printf '%s\\n' "$EIDOLON_E2E_CLASS" "$EIDOLON_E2E_FRESH_COLLECTION" "$EIDOLON_E2E_FRESH_STORY_READY" "${'${EIDOLON_E2E_FRESH_HUNT:-unset}'}" "$*"
            return 19
        }
        run_fresh_story_ready
    `], { encoding: 'utf8', timeout: 5000,
        env: { PATH: process.env.PATH, EIDOLON_E2E_FRESH_CLASS: className } });
    expect(result.status).toBe(19);
    expect(result.stdout.trim().split('\n')).toEqual([className, '1', '1', 'unset',
        'playwright test tests/e2e/fresh-opening-gameplay.spec.js']);
});
