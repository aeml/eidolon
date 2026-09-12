import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { installTripwireObserver } from './e2e/tripwire-observer.js';

afterEach(() => { delete window.game; delete window.__tripwire; });
test('observer forwards once and retains only real owner traps, target hits and root transitions', () => {
    const receive = jest.fn(() => 'forwarded');
    window.game = { player: { id: 'owner', talentRanks: { ROG_23: 5 } }, handleServerMessage: receive };
    installTripwireObserver('enemy');
    expect(window.__tripwire.ranks).toBeNull();
    const wrapped = window.game.handleServerMessage;
    window.game.handleServerMessage = value => wrapped(value);
    installTripwireObserver('enemy');
    const send = window.game.handleServerMessage;
    const trap = { id: 'trap', type: 'Projectile', subType: 'Tripwire', ownerId: 'owner', x: 1, z: 2, damage: 30 };
    expect(send({ type: 'delta', payload: { u: [trap, { ...trap, id: 'foreign', ownerId: 'other' },
        { id: 'owner', talentRanks: { ROG_23: 1 }, talentPoints: 19 }] } })).toBe('forwarded');
    send({ type: 'state', payload: [trap] });
    send({ type: 'damage', payload: { sourceId: 'other', targetId: 'enemy', amount: 99 } });
    send({ type: 'damage', payload: { sourceId: 'owner', targetId: 'enemy', amount: 30 } });
    send({ type: 'delta', payload: { u: [{ id: 'enemy', rooted: true, rootDuration: 2.95 }] } });
    send({ type: 'delta', payload: { u: [{ id: 'enemy', rooted: false, rootDuration: 0 }] } });
    expect(receive).toHaveBeenCalledTimes(6);
    expect(window.__tripwire).toMatchObject({ traps: [{ id: 'trap', x: 1, z: 2, damage: 30 }],
        damage: [{ sourceId: 'owner', targetId: 'enemy', amount: 30 }], ranks: { ROG_23: 1 }, points: 19,
        maxRoot: 2.95, expired: true });
});

test('rejected casts, foreign roots and missing duration cannot fabricate success', () => {
    window.game = { player: { id: 'owner' }, handleServerMessage: jest.fn() };
    installTripwireObserver('enemy');
    const send = window.game.handleServerMessage;
    send({ type: 'ability_result', payload: { skillName: 'Tripwire', accepted: false } });
    send({ type: 'state', payload: [{ id: 'foreign', rooted: true, rootDuration: 3 }, { id: 'enemy', rooted: true }] });
    expect(window.__tripwire).toMatchObject({ results: [{ skillName: 'Tripwire', accepted: false }],
        traps: [], damage: [], maxRoot: 0, expired: false });
});

test('native trap route is explicitly allowlisted and runs once without retries in the full gate', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-tripwire"');
    expect(script).toContain('EIDOLON_E2E_TRIPWIRE=1 npx playwright test --retries=0 tests/e2e/tripwire-gameplay.spec.js');
    expect(script).toContain('  tripwire)\n    run_tripwire\n    ;;');
    const all = script.match(/\n {2}all\)\n([\s\S]*?)\n {4};;/)[1];
    expect(all.match(/run_qa_stage tripwire run_tripwire/g)).toHaveLength(1);
});

test('native root-expiry setup requires a real target able to survive the strongest possible hit', () => {
    const route = readFileSync('tests/e2e/tripwire-gameplay.spec.js', 'utf8');
    expect(route).toContain("command('/qa-waypoint verdant')");
    expect(route).toContain("'InfernoTitan'");
    expect(route).toContain('const minimumHealth = 2 * Math.floor((20 + g.player.stats.dexterity)');
    expect(route).toContain('(e.health ?? e.stats?.hp) > minimumHealth');
    expect(route).toContain('expect(before.hp).toBeGreaterThan(base * 2)');
});
