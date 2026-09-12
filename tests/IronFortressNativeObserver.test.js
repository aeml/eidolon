import { jest } from '@jest/globals';
import { installIronFortressObserver } from './e2e/iron-fortress-observer.js';

function documentFixture() {
    const receive = jest.fn(function () { expect(this).toBe(window.game); return 'forwarded'; });
    window.game = { player: { id: 'owner' }, handleServerMessage: receive };
    return receive;
}
afterEach(() => { delete window.game; delete window.__fortressNative; });

test('each fresh document observes real paid casts without changing delivery', () => {
    for (let login = 0; login < 2; login++) {
        const receive = documentFixture(); installIronFortressObserver();
        const result = { skillName: 'Iron Fortress', accepted: true, mana: 200 };
        expect(window.game.handleServerMessage({ type: 'ability_result', payload: result })).toBe('forwarded');
        expect(receive).toHaveBeenCalledTimes(1);
        expect(window.__fortressNative.results).toEqual([result]);
    }
});

test('reinstall resets observations without wrapping the same handler twice', () => {
    const receive = documentFixture(); installIronFortressObserver();
    const wrapper = window.game.handleServerMessage;
    installIronFortressObserver(); expect(window.game.handleServerMessage).toBe(wrapper);
    window.game.handleServerMessage({ type: 'state', payload: [
        { id: 'owner', ironFortressActive: true, ironFortressDuration: 35.9 }
    ] });
    expect(receive).toHaveBeenCalledTimes(1);
    expect(window.__fortressNative.maxDuration).toBe(35.9);
    installIronFortressObserver();
    expect(window.__fortressNative).toMatchObject({ results: [], maxDuration: 0, expired: false, incoming: [] });
});

test('only explicit owner state establishes duration and subsequent expiry', () => {
    documentFixture(); installIronFortressObserver();
    const send = update => window.game.handleServerMessage({ type: 'delta', payload: { u: [update] } });
    send({ id: 'other', ironFortressActive: true, ironFortressDuration: 99 });
    send({ id: 'owner', ironFortressActive: false });
    send({ id: 'owner', ironFortressActive: true });
    send({ id: 'owner', ironFortressActive: true, ironFortressDuration: Infinity });
    expect(window.__fortressNative).toMatchObject({ maxDuration: 0, expired: false });
    send({ id: 'owner', ironFortressActive: true, ironFortressDuration: 53.9 });
    send({ id: 'owner', ironFortressDuration: 0 });
    send({ id: 'other', ironFortressActive: false });
    expect(window.__fortressNative).toMatchObject({ maxDuration: 53.9, expired: false });
    send({ id: 'owner', ironFortressActive: false, ironFortressDuration: 0 });
    expect(window.__fortressNative).toMatchObject({ maxDuration: 53.9, expired: true });
});

test('rejected casts remain rejected and cannot fabricate a duration', () => {
    documentFixture(); installIronFortressObserver();
    window.game.handleServerMessage({ type: 'ability_result', payload: { skillName: 'Iron Fortress', accepted: false } });
    window.game.handleServerMessage({ type: 'ability_result', payload: { skillName: 'Charge', accepted: true } });
    expect(window.__fortressNative).toMatchObject({ results: [{ skillName: 'Iron Fortress', accepted: false }], maxDuration: 0, expired: false });
});

test('incoming receipts retain real source, amount and post-delivery protection without fabricating HP changes', () => {
    const receive = documentFixture();
    Object.assign(window.game.player, { stats: { hp: 900, defense: 6 }, ironFortressTimer: 20,
        attachedStatusEffects: new Map([['iron_fortress', {}]]) });
    installIronFortressObserver();
    const payload = { sourceId: 'skeleton', targetId: 'owner', amount: 24, kind: 'physical' };
    window.game.handleServerMessage({ type: 'damage', payload });
    window.game.handleServerMessage({ type: 'damage', payload: { ...payload, targetId: 'other' } });
    expect(receive).toHaveBeenCalledTimes(2);
    expect(window.game.player.stats.hp).toBe(900);
    expect(window.__fortressNative.incoming).toEqual([expect.objectContaining({ ...payload,
        defense: 6, timer: 20, effectAttached: true, health: 900 })]);
});

test('layered movement observation cannot install duplicate combat observers', () => {
    const receive = documentFixture(); installIronFortressObserver();
    const inner = window.game.handleServerMessage;
    window.game.handleServerMessage = message => inner(message);
    installIronFortressObserver();
    window.game.handleServerMessage({ type: 'ability_result', payload: { skillName: 'Iron Fortress', accepted: true } });
    expect(receive).toHaveBeenCalledTimes(1);
    expect(window.__fortressNative.results).toHaveLength(1);
});

test('an original handler error is not converted to success', () => {
    documentFixture(); const failure = new Error('original handler failed');
    window.game.handleServerMessage = () => { throw failure; };
    installIronFortressObserver();
    expect(() => window.game.handleServerMessage({ type: 'state' })).toThrow(failure);
});

test('Roar uses its own real receipt, timer and expiry without inheriting Fortress evidence', () => {
    const receive = documentFixture();
    Object.assign(window.game.player, { stats: { hp: 800, defense: 20 }, guardianRoarTimer: 12,
        attachedStatusEffects: new Map([['guardian_roar', {}]]) });
    installIronFortressObserver({ skill: 'Guardian Roar', timer: 'guardianRoarTimer', effect: 'guardian_roar',
        active: 'guardianRoarActive', duration: 'guardianRoarDuration' });
    const send = window.game.handleServerMessage;
    send({ type: 'ability_result', payload: { skillName: 'Iron Fortress', accepted: true } });
    send({ type: 'ability_result', payload: { skillName: 'Guardian Roar', accepted: true, mana: 65 } });
    send({ type: 'damage', payload: { sourceId: 'enemy', targetId: 'owner', amount: 70, kind: 'physical' } });
    send({ type: 'delta', payload: { u: [{ id: 'owner', guardianRoarActive: true, guardianRoarDuration: 12 }] } });
    send({ type: 'delta', payload: { u: [{ id: 'owner', guardianRoarActive: false, guardianRoarDuration: 0 }] } });
    expect(receive).toHaveBeenCalledTimes(5);
    expect(window.__fortressNative).toMatchObject({ results: [{ skillName: 'Guardian Roar', accepted: true, mana: 65 }],
        maxDuration: 12, expired: true, incoming: [expect.objectContaining({ amount: 70, timer: 12, effectAttached: true, defense: 20 })] });
});
