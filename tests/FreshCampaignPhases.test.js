import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { createFreshStoryPhaseRunner, freshStoryPhases, freshStoryTimeout,
    freshStoryDungeonPhases, freshStoryDungeonTimeout } from './freshCampaignPhases.js';

test('the complete story has a fixed sum of explicit phase caps, not a renewable session timeout', () => {
    expect(freshStoryPhases.map(({ id, timeout }) => [id, timeout / 60_000])).toEqual([
        ['opening', 10], ['watch', 30], ['seeds', 20], ['imps', 45],
        ['scars', 10], ['orcs', 60], ['handoff', 5], ['readiness', 5]
    ]);
    expect(freshStoryTimeout).toBe(185 * 60_000);
    expect(Object.isFrozen(freshStoryPhases)).toBe(true);
    expect(freshStoryPhases.every(Object.isFrozen)).toBe(true);
});

test('each phase runs once with its own cap and retains the body result and timing evidence', async () => {
    let time = 0;
    const record = jest.fn(), step = jest.fn(async (_name, body) => body());
    const run = createFreshStoryPhaseRunner({ step, record, now: () => time });
    const earnedCharacter = { level: 1 };
    expect(() => run.assertComplete()).toThrow('incomplete');
    for (const phase of freshStoryPhases) {
        const body = jest.fn(async () => { time += 200; return earnedCharacter; });
        expect(await run(phase.id, body)).toBe(earnedCharacter);
        expect(body).toHaveBeenCalledTimes(1);
        expect(step).toHaveBeenLastCalledWith(`Earned Earth: ${phase.id}`, body, { timeout: phase.timeout });
        expect(record).toHaveBeenLastCalledWith({ id: phase.id, status: 'passed', elapsed: 200, timeout: phase.timeout });
    }
    expect(() => run.assertComplete()).not.toThrow();
    expect(record).toHaveBeenCalledTimes(16);
    expect(earnedCharacter).toEqual({ level: 1 });
});

test('unknown, skipped and repeated phases cannot execute a body', async () => {
    const body = jest.fn(), step = jest.fn(async (_name, work) => work());
    const run = createFreshStoryPhaseRunner({ step, record: jest.fn() });
    await expect(run('watch', body)).rejects.toThrow('expected opening');
    await expect(run('unknown', body)).rejects.toThrow('expected opening');
    expect(body).not.toHaveBeenCalled();
    await run('opening', body);
    await expect(run('opening', body)).rejects.toThrow('expected watch');
    expect(body).toHaveBeenCalledTimes(1);
});

test('phase timeout or body failure is retained and cannot be retried into success', async () => {
    const cause = new Error('phase deadline'), record = jest.fn();
    const run = createFreshStoryPhaseRunner({ step: async () => { throw cause; }, record });
    await expect(run('opening', jest.fn())).rejects.toBe(cause);
    expect(record).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'opening', status: 'failed' }));
    expect(record.mock.calls.some(([event]) => event.status === 'passed')).toBe(false);
    await expect(run('opening', jest.fn())).rejects.toThrow('phase order');
    await expect(run('watch', jest.fn())).rejects.toThrow('phase order');
    expect(() => run.assertComplete()).toThrow('incomplete');
});

test('concurrent phase calls cannot spend or renew the active phase budget', async () => {
    let finish;
    const step = jest.fn((_name, body) => body());
    const run = createFreshStoryPhaseRunner({ step, record: jest.fn() });
    const pending = run('opening', () => new Promise(resolve => { finish = resolve; }));
    await expect(run('opening', jest.fn())).rejects.toThrow('phase order');
    await expect(run('watch', jest.fn())).rejects.toThrow('phase order');
    expect(() => run.assertComplete()).toThrow('incomplete');
    expect(step).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    await run('watch', async () => {});
    expect(step.mock.calls.map(call => call[2].timeout)).toEqual([600_000, 1_800_000]);
});

test('the final readiness phase cannot be omitted after the seven earlier phases', async () => {
    const run = createFreshStoryPhaseRunner({ step: (_name, body) => body(), record: jest.fn() });
    for (const phase of freshStoryPhases.slice(0, -1)) await run(phase.id, async () => {});
    expect(() => run.assertComplete()).toThrow('incomplete');
});

test('native wiring keeps explicit story-only opt-in and all combat/save/readiness requirements', () => {
    const opening = readFileSync('tests/e2e/fresh-opening-gameplay.spec.js', 'utf8');
    const collection = readFileSync('tests/e2e/fresh-collection-route.js', 'utf8');
    const hunt = readFileSync('tests/e2e/fresh-story-hunt-route.js', 'utf8');
    expect(opening).toContain('const runPhase = storyOnlyReadiness ? createFreshStoryPhaseRunner(');
    expect(opening).toContain('test.step(name, body, options)');
    expect(opening).toContain('test.setTimeout(storyOnlyReadiness ? storyTimeout :');
    expect(opening.match(/test\.setTimeout\(/g)).toHaveLength(1);
    expect(opening).toContain("await runPhase('opening', async () => {");
    expect(opening).toContain("await runPhase('watch', () => earnFreshStoryHunt");
    expect(opening).toContain("await runPhase('readiness', () => verifyStoryOnlyEarthReadiness(page));");
    expect(opening).toContain('runPhase.assertComplete();');
    for (const id of ['seeds', 'imps', 'scars', 'orcs', 'handoff']) expect(collection).toContain(`await runPhase('${id}',`);
    for (const route of [opening, collection, hunt]) expect(route).toContain('const deadline = Date.now() + 120_000');
    expect(collection).toContain('expect(required).toBe(8)');
    expect(collection).toContain('expect((await equipmentSnapshot(page)).gear,');
    expect(collection).toContain(".toContainText('unlocks at level 30')");
    expect(hunt).toContain('Expedition exceeded two ordinary respawns');
});

test('story-only dungeon adds bounded clear and manual-turn-in phases without changing readiness caps', async () => {
    expect(freshStoryDungeonTimeout).toBe(230 * 60_000);
    expect(freshStoryDungeonPhases.slice(0, 8)).toEqual(freshStoryPhases);
    expect(freshStoryDungeonPhases.slice(8)).toEqual([
        { id: 'dungeon', timeout: 40 * 60_000 }, { id: 'dungeon-turn-in', timeout: 5 * 60_000 }
    ]);
    expect(Object.isFrozen(freshStoryDungeonPhases)).toBe(true);
    expect(freshStoryDungeonPhases.every(Object.isFrozen)).toBe(true);
    const step = jest.fn((_name, body) => body());
    const run = createFreshStoryPhaseRunner({ step, record: jest.fn(), includeDungeon: true });
    for (const phase of freshStoryPhases) await run(phase.id, async () => {});
    expect(() => run.assertComplete()).toThrow('incomplete');
    await expect(run('dungeon-turn-in', jest.fn())).rejects.toThrow('expected dungeon');
    await run('dungeon', async () => {});
    expect(() => run.assertComplete()).toThrow('incomplete');
    await run('dungeon-turn-in', async () => {});
    expect(() => run.assertComplete()).not.toThrow();
    expect(step.mock.calls.slice(-2).map(call => call[2].timeout)).toEqual([2400000, 300000]);
});

test('failed dungeon clearance cannot skip to manual reward or report all phases complete', async () => {
    const run = createFreshStoryPhaseRunner({ step: (_name, body) => body(), record: jest.fn(), includeDungeon: true });
    for (const phase of freshStoryPhases) await run(phase.id, async () => {});
    const failure = new Error('boss remains alive');
    await expect(run('dungeon', async () => { throw failure; })).rejects.toBe(failure);
    await expect(run('dungeon-turn-in', jest.fn())).rejects.toThrow('phase order');
    expect(() => run.assertComplete()).toThrow('incomplete');
});
