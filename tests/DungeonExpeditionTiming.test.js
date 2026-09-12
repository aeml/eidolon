import fs from 'node:fs';
import { createDungeonExpeditionTiming, dungeonExpeditionBudget } from './dungeonExpeditionTiming.js';

test('solo retains forty minutes; the party allowance is explicit and bounded', () => {
    expect(dungeonExpeditionBudget()).toBe(2_400_000);
    expect(dungeonExpeditionBudget('party')).toBe(7_200_000);
    for (const profile of ['part', 'constructor', Infinity, null]) expect(() => dungeonExpeditionBudget(profile)).toThrow();
});

test.each(['solo', 'party'])('%s phase changes and repeated town visits cannot reset the overall deadline', profile => {
    let time = 100; const reports = [];
    const clock = createDungeonExpeditionTiming({ profile, now: () => time, onReport: event => reports.push(event) });
    time += 10; clock.enter('traversal'); time += 20; clock.enter('combat');
    time += 30; clock.enter('recovery'); clock.count('townReturns');
    time += 40; clock.enter('traversal'); clock.count('leaderGroundSteps'); clock.count('roomTraversals');
    const state = clock.snapshot();
    expect(state.elapsedMs).toBe(100);
    expect(state.totalsMs).toEqual({ entry: 10, traversal: 20, combat: 30, recovery: 40, verification: 0 });
    expect(state.counters).toEqual({ leaderGroundSteps: 1, roomTraversals: 1, townReturns: 1 });
    state.totalsMs.combat = 1000; state.counters.townReturns = 1000;
    expect(clock.snapshot().totalsMs.combat).toBe(30); expect(clock.snapshot().counters.townReturns).toBe(1);
    time = 100 + dungeonExpeditionBudget(profile) - 1; expect(() => clock.assertActive()).not.toThrow();
    clock.enter('recovery'); time++; expect(() => clock.assertActive()).toThrow(`exceeded${profile === 'solo' ? 40 : 120} minutes`);
    expect(reports.at(-1).reason).toBe('deadline');
});

test('reports use the existing polling loop, without timers or saved character identifiers', () => {
    let time = 0; const reports = [];
    const clock = createDungeonExpeditionTiming({ now: () => time, onReport: event => reports.push(event) });
    time = 29_999; clock.assertActive(); expect(reports).toHaveLength(0);
    time = 30_000; clock.assertActive(); expect(reports).toHaveLength(1);
    clock.assertActive(); expect(reports).toHaveLength(1);
    expect(Object.keys(reports[0]).sort()).toEqual(['activitiesMs', 'budgetMs', 'counters', 'elapsedMs', 'phase', 'phaseElapsedMs', 'profile', 'reason', 'totalsMs'].sort());
    expect(() => clock.enter('teleport-ahead')).toThrow(); expect(() => clock.count('kills')).toThrow();
});

test('input and formation timings distinguish harness work without removing it from the deadline', async () => {
    let time = 0;
    const clock = createDungeonExpeditionTiming({ profile: 'party', now: () => time });
    clock.enter('traversal');
    expect(await clock.measure('leaderInput', async () => { time += 150; return 'arrived'; })).toBe('arrived');
    await clock.measure('formation', async () => { time += 350; });
    time += 40; // Other path planning and observations remain in traversal.
    const state = clock.snapshot();
    expect(state.activitiesMs).toEqual({ leaderInput: 150, formation: 350 });
    expect(state.totalsMs.traversal).toBe(540);
    expect(state.elapsedMs).toBe(540);
    state.activitiesMs.formation = 0;
    expect(clock.snapshot().activitiesMs.formation).toBe(350);
    await expect(clock.measure('formation', async () => {
        time = dungeonExpeditionBudget('party'); clock.assertActive();
    })).rejects.toThrow('exceeded120 minutes');
});

test('failed measured actions retain their timing and original failure without retrying', async () => {
    let time = 0, calls = 0;
    const clock = createDungeonExpeditionTiming({ now: () => time });
    const failure = new Error('Follower could not reach the waypoint');
    await expect(clock.measure('formation', async () => { calls++; time += 420; throw failure; })).rejects.toBe(failure);
    expect(calls).toBe(1);
    expect(clock.snapshot().activitiesMs).toEqual({ leaderInput: 0, formation: 420 });
    await expect(clock.measure('invented', () => { calls++; })).rejects.toThrow('Unknown expedition activity');
    expect(calls).toBe(1);
});

test('party selects its own allowance without changing encounter, damage-stall, formation or claim checks', () => {
    const route = fs.readFileSync('tests/e2e/dungeon-playthrough-route.js', 'utf8');
    const party = fs.readFileSync('tests/e2e/four-player-dungeon.spec.js', 'utf8');
    expect(route).toContain("expeditionProfile = 'solo'");
    expect(party).toContain("expeditionProfile: 'party'");
    expect(party).toContain("test.setTimeout(dungeonExpeditionBudget('party') + 300_000)");
    expect(route).toContain('fullRun ? 480_000 : 120_000');
    expect(route).toContain('Date.now() - lastDamageAt > 60_000');
    expect(route).toContain('let deadline = Date.now() + 180_000');
    expect(route).toContain("timing.report('route-exit')");
    expect(party).toContain('gatherPartyFormation');
    expect(party).toContain('verifyFreshWaterHandoff');
});
