import { PlaytestSession } from '../src/ui/PlaytestSession.js';

const active = { connected: true, hidden: false, idle: false, level: 1 };
test('disabled until explicitly started; no second start overwrites a recorded session', () => {
    const session = new PlaytestSession();
    session.tick(1000, active);
    expect(session.elapsed()).toBe(0);
    expect(session.start(1000, active)).toBe(true);
    session.tick(2000, active);
    expect(session.start(3000, active)).toBe(false);
    expect(session.totals.exploring).toBe(1000);
});

test('explicit labels and assisted time remain distinct from hidden, idle and disconnected', () => {
    const session = new PlaytestSession(); session.start(0, active);
    session.activity = 'fighting'; session.assisted = true;
    session.tick(1000, active); session.tick(2000, { ...active, hidden: true });
    session.tick(3000, { ...active, idle: true });
    session.tick(4000, { ...active, connected: false });
    session.tick(5000, active); session.stop(6000, active);
    expect(session.totals).toMatchObject({ exploring: 1000, fighting: 2000, hidden: 1000, idle: 1000, disconnected: 1000 });
    expect(session.assistedMs).toBe(2000);
    expect(session.active()).toBe(3000);
    session.tick(7000, active); expect(session.elapsed()).toBe(6000);
});

test('suspension is unobserved, clock regressions rejected, total lifetime bounded', () => {
    const session = new PlaytestSession(); session.start(1000, active);
    session.tick(500, active); session.tick(NaN, active);
    expect(session.elapsed()).toBe(0);
    session.tick(61000, active);
    expect(session.totals.unobserved).toBe(60000); expect(session.active()).toBe(0);
    session.tick(100000000, { ...active, level: 30 });
    expect(session.elapsed()).toBe(8 * 3600000); expect(session.running).toBe(false);
    expect(session.endLevel).toBe(1); expect(session.level30).toBeNull();
});

test('level-30 observation distinguishes partial sessions and never invents full journey completion', () => {
    const session = new PlaytestSession(); session.start(0, { ...active, level: 29 });
    session.tick(1000, { ...active, level: 30 }); session.tick(2000, { ...active, level: 31 });
    expect(session.level30).toEqual({ elapsedMs: 1000, activeMs: 1000 });
    expect(session.summary()).toContain('29 → 31');
    session.clear(); session.start(0, { ...active, level: 100 });
    session.tick(1000, { ...active, level: 101 });
    expect(session.level30).toBeNull(); expect(session.endLevel).toBe(100);
    expect(session.summary()).toContain('not a fresh level-30 timing');
});

test('only bounded aggregates enter summaries; clearing removes previous observations', () => {
    const session = new PlaytestSession();
    session.start(0, { ...active, username: 'private', chat: ['secret'], position: { x: 100 } });
    session.stop(1000, active);
    expect(session.summary()).not.toMatch(/private|secret|position|username/);
    expect(session.summary().length).toBeLessThan(1500);
    session.clear(); expect(session.started).toBe(false); expect(session.elapsed()).toBe(0);
    expect(session.endLevel).toBeNull(); expect(session.level30).toBeNull();
});
