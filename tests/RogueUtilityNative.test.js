import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { installRogueUtilityObserver } from './e2e/rogue-utility-observer.js';

const configs = [
    { skill: 'Weak Point Mark', targetId: 'enemy', active: 'weakPointMarked', duration: 'weakPointDuration' },
    { skill: 'Smoke Bomb', targetId: 'enemy', active: 'slowed', duration: 'slowDuration' },
    { skill: 'Cloak & Vanish', targetId: 'owner', active: 'stealthActive', duration: 'stealthDuration' }
];
afterEach(() => { delete window.game; delete window.__rogueUtility; });
test.each(configs)('$skill observes exact targets, actual deadlines and explicit expiry without changing delivery', cfg => {
    const receive = jest.fn(function () { expect(this).toBe(window.game); return 'forwarded'; });
    window.game = { player: { id: 'owner' }, handleServerMessage: receive };
    installRogueUtilityObserver(cfg);
    const send = message => window.game.handleServerMessage(message);
    expect(send({ type: 'ability_result', payload: { skillName: cfg.skill, accepted: false } })).toBe('forwarded');
    expect(window.__rogueUtility.results[0].accepted).toBe(false);
    send({ type: 'ability', payload: { skillName: cfg.skill, sourceId: 'other' } });
    send({ type: 'delta', payload: { u: { a: { id: 'other', [cfg.active]: true, [cfg.duration]: 500 } } } });
    send({ type: 'state', payload: { a: { id: cfg.targetId, [cfg.duration]: 100 } } });
    expect(window.__rogueUtility.casts).toEqual([]); expect(window.__rogueUtility.maxDuration).toBe(0);
    send({ type: 'delta', payload: { u: { a: { id: cfg.targetId, [cfg.active]: true, [cfg.duration]: 6.8 } } } });
    expect(window.__rogueUtility.maxDuration).toBe(6.8);
    send({ type: 'delta', payload: { u: { a: { id: cfg.targetId, [cfg.duration]: 0 } } } });
    expect(window.__rogueUtility.expired).toBe(false);
    send({ type: 'delta', payload: { u: { a: { id: cfg.targetId, [cfg.active]: false } } } });
    expect(window.__rogueUtility.expired).toBe(true); expect(receive).toHaveBeenCalledTimes(7);
});
test('purchase evidence excludes local optimistic ranks, and resets do not nest wrappers', () => {
    const receive = jest.fn(() => true);
    window.game = { player: { id: 'owner', talentRanks: { ROG_05: 5 } }, handleServerMessage: receive };
    installRogueUtilityObserver(); const wrapper = window.game.handleServerMessage;
    expect(window.__rogueUtility.ranks).toBeNull();
    wrapper({ type: 'state', payload: { a: { id: 'owner', talentRanks: { ROG_05: 1 }, talentPoints: 19 } } });
    expect(window.__rogueUtility).toMatchObject({ ranks: { ROG_05: 1 }, points: 19 });
    installRogueUtilityObserver(configs[1]); expect(window.game.handleServerMessage).toBe(wrapper);
    expect(window.__rogueUtility.ranks).toBeNull();
    wrapper({ type: 'ability_result', payload: { skillName: configs[0].skill, accepted: true } });
    expect(window.__rogueUtility.results).toEqual([]); expect(receive).toHaveBeenCalledTimes(2);
});
test('utility mastery native gate is isolated, non-retrying and included once in the full route', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(script).toContain('qa_allowlist+=",${QA_USERNAME_BASE}-rogue-utility"');
    expect(script).toContain('EIDOLON_E2E_ROGUE_UTILITY=1 npx playwright test --retries=0 tests/e2e/rogue-utility-mastery-gameplay.spec.js');
    expect(script).toContain('  rogue-utility)\n    run_rogue_utility\n    ;;');
    const all = script.match(/\n {2}all\)\n([\s\S]*?)\n {4};;/)[1];
    expect(all.match(/run_qa_stage rogue-utility run_rogue_utility/g)).toHaveLength(1);
});
test('a ground-input observer layered around the receiver cannot cause duplicate installation', () => {
    const receive = jest.fn(() => 'delivered');
    window.game = { player: { id: 'owner' }, handleServerMessage: receive };
    installRogueUtilityObserver(configs[0]);
    const original = window.game.handleServerMessage.bind(window.game);
    // moveByGroundClick installs the entrance-click observer around this
    // receiver. It forwards messages but does not copy function properties.
    const movementObserver = message => original(message);
    window.game.handleServerMessage = movementObserver;
    installRogueUtilityObserver(configs[0]);
    const payload = { skillName: 'Weak Point Mark', accepted: true, mana: 1718 };
    expect(window.game.handleServerMessage({ type: 'ability_result', payload })).toBe('delivered');
    expect(window.__rogueUtility.results).toEqual([payload]);
    expect(window.game.handleServerMessage).toBe(movementObserver);
    expect(receive).toHaveBeenCalledTimes(1);
});
