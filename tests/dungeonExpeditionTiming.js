// Harness allowances, not gameplay balance or target human session lengths.
// Four real browser clients retrace the same cleared route after town recovery.
const MINUTE = 60_000;
const BUDGETS = Object.freeze({ solo: 40 * MINUTE, party: 120 * MINUTE });
const PHASES = ['entry', 'traversal', 'combat', 'recovery', 'verification'];

export function dungeonExpeditionBudget(profile = 'solo') {
    if (!Object.hasOwn(BUDGETS, profile)) throw new Error(`Unknown dungeon expedition profile: ${profile}`);
    return BUDGETS[profile];
}

export function createDungeonExpeditionTiming({ profile = 'solo', now = () => performance.now(), onReport = () => {} } = {}) {
    const budgetMs = dungeonExpeditionBudget(profile), started = now();
    let phase = 'entry', phaseStarted = started, lastReport = started;
    const totalsMs = Object.fromEntries(PHASES.map(name => [name, 0]));
    const counters = { leaderGroundSteps: 0, roomTraversals: 0, townReturns: 0 };
    const snapshot = (at = now()) => ({ profile, budgetMs, elapsedMs: at - started, phase,
        phaseElapsedMs: at - phaseStarted, totalsMs: { ...totalsMs, [phase]: totalsMs[phase] + at - phaseStarted },
        counters: { ...counters } });
    const report = reason => { const at = now(); lastReport = at; onReport({ reason, ...snapshot(at) }); };
    return {
        snapshot,
        report,
        enter(next) {
            if (!PHASES.includes(next)) throw new Error(`Unknown expedition phase: ${next}`);
            if (phase === next) return;
            const at = now(); totalsMs[phase] += at - phaseStarted; phaseStarted = at; phase = next;
            report('phase');
        },
        count(name) {
            if (!Object.hasOwn(counters, name)) throw new Error(`Unknown expedition counter: ${name}`);
            counters[name]++;
        },
        assertActive() {
            const at = now();
            if (at - started >= budgetMs) {
                report('deadline');
                throw new Error(`Dungeon expedition exceeded${budgetMs / MINUTE} minutes including town recovery (${profile})`);
            }
            if (at - lastReport >= 30_000) report('heartbeat');
        }
    };
}
