// QA observation budgets, not targets for enjoyable gameplay. The first actual
// full attempt spent 36 minutes in the Imp chapter and hit the old one-hour
// session limit at Orc4/50. Keep each encounter's existing watchdog unchanged.
export const freshStoryPhases = Object.freeze([
    ['opening', 10], ['watch', 30], ['seeds', 20], ['imps', 45],
    ['scars', 10], ['orcs', 60], ['handoff', 5], ['readiness', 5]
].map(([id, minutes]) => Object.freeze({ id, timeout: minutes * 60_000 })));

export const freshStoryTimeout = freshStoryPhases.reduce((total, phase) => total + phase.timeout, 0);
// Preserve the existing eight-phase readiness gate. The explicit dungeon route
// adds the existing full-run 40-minute ceiling and five minutes for manual
// turn-in/access/save verification; these are observation caps, not pacing goals.
export const freshStoryDungeonPhases = Object.freeze([...freshStoryPhases,
    Object.freeze({ id: 'dungeon', timeout: 40 * 60_000 }),
    Object.freeze({ id: 'dungeon-turn-in', timeout: 5 * 60_000 })]);
export const freshStoryDungeonTimeout = freshStoryDungeonPhases.reduce((total, phase) => total + phase.timeout, 0);

// One runner per attempt, with the same earned character throughout. A failed
// phase cannot be retried/skipped locally or reported as completed. The caller's
// test.step enforces each timeout; the enclosing test enforces the fixed sum.
export function createFreshStoryPhaseRunner({ step, record, now = Date.now, includeDungeon = false }) {
    const phases = includeDungeon ? freshStoryDungeonPhases : freshStoryPhases;
    let index = 0, running = false, failed = false;
    const run = async (id, body) => {
        const phase = phases[index];
        if (failed || running || phase?.id !== id) throw new Error(`Fresh story phase order: expected ${phase?.id || 'finished'}, received ${id}`);
        running = true;
        const started = now();
        record({ id, status: 'started', timeout: phase.timeout });
        try {
            const result = await step(`Earned Earth: ${id}`, body, { timeout: phase.timeout });
            record({ id, status: 'passed', elapsed: now() - started, timeout: phase.timeout });
            index++;
            return result;
        } catch (error) {
            failed = true;
            record({ id, status: 'failed', elapsed: now() - started, timeout: phase.timeout });
            throw error;
        } finally {
            running = false;
        }
    };
    run.assertComplete = () => {
        if (failed || running || index !== phases.length) throw new Error('Fresh story phase evidence is incomplete');
    };
    return run;
}
