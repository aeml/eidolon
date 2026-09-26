import fs from 'node:fs';
import { createDungeonExpeditionTiming, createDungeonTargetProgress, dungeonCombatBudget, dungeonExpeditionBudget } from './dungeonExpeditionTiming.js';

test('recorded Water approach makes progress without pretending distant travel is damage', () => {
    const progress = createDungeonTargetProgress({ health: 11550, distance: 112.65549742119684 }, 0);
    for (const [at, distance] of [[0, 112.6555], [20000, 110.1980], [40000, 99.2826], [61000, 79.46]]) {
        expect(progress.observe({ health: 11550, distance, range: 4.3 }, at)).toBeNull();
    }
    expect(progress.observe({ health: 11550, distance: 79.46, range: 4.3 }, 121001)).toBe('approach');
});

test('stationary, oscillating and sub-unit jitter cannot keep an approach alive', () => {
    for (const distances of [[100, 100], [101, 100], [99.8, 99.6]]) {
        const progress = createDungeonTargetProgress({ health: 100, distance: 100 }, 0);
        expect(progress.observe({ health: 100, distance: distances[0], range: 4 }, 30000)).toBeNull();
        expect(progress.observe({ health: 100, distance: distances[1], range: 4 }, 60001)).toBe('approach');
    }
});

test.each(['range', 'damage'])('engagement by %s permanently switches to the60s damage guard', engagement => {
    const progress = createDungeonTargetProgress({ health: 100, distance: 100 }, 0);
    let health = engagement === 'damage' ? 99 : 100;
    expect(progress.observe({ health, distance: engagement === 'range' ? 4 : 90, range: 4 }, 20000)).toBeNull();
    expect(progress.observe({ health, distance: 40, range: 4 }, 60000)).toBeNull();
    expect(progress.observe({ health, distance: 20, range: 4 }, 80001)).toBe('damage');
    health--;
    expect(progress.observe({ health, distance: 4, range: 4 }, 80002)).toBeNull();
    expect(progress.observe({ health, distance: 3, range: 4 }, 140003)).toBe('damage');
});

test('making approach progress never extends the separate fixed encounter budget', () => {
    const progress = createDungeonTargetProgress({ health: 100, distance: 1000 }, 0);
    const deadline = dungeonCombatBudget(true, 'water_crystal_raid', 'FrostGuardian');
    for (let at = 30000; at <= deadline; at += 30000) {
        expect(progress.observe({ health: 100, distance: 1000 - at / 30000, range: 4 }, at)).toBeNull();
    }
    expect(deadline).toBe(480000);
});

test('foreground retargeting neither resets the stall nor mistakes different health for damage', () => {
    for (const engaged of [false, true]) {
        const progress = createDungeonTargetProgress({ health: 100, distance: 100 }, 0);
        if (engaged) progress.observe({ health: 99, distance: 100, range: 4 }, 0);
        progress.retarget({ health: 500, distance: 50 });
        expect(progress.observe({ health: 500, distance: 50, range: 4 }, 60001)).toBe(engaged ? 'damage' : 'approach');
        expect(progress.observe({ health: 490, distance: 50, range: 4 }, 60002)).toBeNull();
    }
});

test.each([
    [true, 'weekly_raid', 'UmbraPrime', 600_000],
    [false, 'weekly_raid', 'UmbraPrime', 120_000],
    [true, 'weekly_raid', 'DemonOrc', 480_000],
    [true, 'tempest_spire', 'Zephyrion', 480_000],
    [true, 'molten_core', 'LordInfernax', 480_000],
    [true, 'umbral_nexus', 'UmbraPrime', 480_000]
])('combat allowance full=%s %s/%s is %i ms', (full, dungeon, target, expected) => {
    expect(dungeonCombatBudget(full, dungeon, target)).toBe(expected);
});

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
    const party = fs.readFileSync('tests/e2e/geared-party-route.js', 'utf8');
    expect(fs.readFileSync('tests/e2e/four-player-dungeon.spec.js', 'utf8')).toContain('runGearedPartyRoute');
    expect(route).toContain("expeditionProfile = 'solo'");
    expect(party).toContain("expeditionProfile: 'party'");
    expect(party).toContain("test.setTimeout(dungeonExpeditionBudget('party') + 300_000)");
    expect(route).toContain('dungeonCombatBudget(fullRun, playthrough.dungeonType, target.type)');
    expect(route).toContain('progress.observe(state, Date.now())');
    expect(route).toContain('while (Date.now() < deadline)');
    expect(route).toContain('let deadline = Date.now() + 180_000');
    expect(route).toContain("timing.report('route-exit')");
    expect(party).toContain('gatherPartyFormation');
    expect(party).toContain('verifyFreshWaterHandoff');
});
