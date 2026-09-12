import { jest } from '@jest/globals';
import { installFighterBuffObserver } from './e2e/fighter-buff-observer.js';

const configs = [
    { skill: 'Berserker Edge', active: 'berserkerModeActive', duration: 'berserkerModeDuration', multiplier: 'berserkerModeMultiplier' },
    { skill: 'Last Stand Rampage', active: 'lastStandActive', duration: 'lastStandDuration', multiplier: 'lastStandMultiplier' }
];
afterEach(() => { delete window.game; delete window.__fighterBuffNative; });
test.each(configs)('$skill observes only real owner fields and preserves delivery and rejection', config => {
    const receive = jest.fn(function () { expect(this).toBe(window.game); return 'received'; });
    window.game = { player: { id: 'owner' }, handleServerMessage: receive };
    installFighterBuffObserver(config);
    const deliver = message => window.game.handleServerMessage(message);
    const result = { skillName: config.skill, accepted: false };
    expect(deliver({ type: 'ability_result', payload: result })).toBe('received');
    expect(window.__fighterBuffNative.results).toEqual([result]);
    deliver({ type: 'delta', payload: { u: { a: { id: 'other', [config.active]: true, [config.duration]: 100 } } } });
    deliver({ type: 'state', payload: { a: { id: 'owner', [config.multiplier]: 3.6 } } });
    expect(window.__fighterBuffNative.states).toEqual([]);
    expect(window.__fighterBuffNative.maxDuration).toBe(0);
    const active = { id: 'owner', [config.active]: true, [config.duration]: 9.8,
        [config.multiplier]: 1.8, damage: 45, defense: 8 };
    deliver({ type: 'delta', payload: { u: { a: active } } });
    expect(window.__fighterBuffNative.states).toEqual([{ multiplier: 1.8, duration: 9.8, damage: 45, defense: 8 }]);
    deliver({ type: 'state', payload: { a: { id: 'owner', [config.duration]: 0 } } });
    expect(window.__fighterBuffNative.expired).toBe(false);
    deliver({ type: 'delta', payload: { u: { a: { id: 'owner', [config.active]: false } } } });
    expect(window.__fighterBuffNative.expired).toBe(true);
    expect(receive).toHaveBeenCalledTimes(6);
});

test('reset switches the observed skill without nested wrappers or stale successes', () => {
    const receive = jest.fn(); window.game = { player: { id: 'owner' }, handleServerMessage: receive };
    installFighterBuffObserver(configs[0]); const wrapper = window.game.handleServerMessage;
    installFighterBuffObserver(configs[1]); expect(window.game.handleServerMessage).toBe(wrapper);
    wrapper({ type: 'ability_result', payload: { skillName: 'Berserker Edge', accepted: true } });
    expect(window.__fighterBuffNative.results).toEqual([]);
    expect(window.__fighterBuffNative.expired).toBe(false);
    expect(receive).toHaveBeenCalledTimes(1);
});
