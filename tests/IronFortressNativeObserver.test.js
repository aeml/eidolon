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
    expect(window.__fortressNative).toEqual({ results: [], maxDuration: 0, expired: false });
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
    expect(window.__fortressNative).toEqual({ results: [{ skillName: 'Iron Fortress', accepted: false }], maxDuration: 0, expired: false });
});

test('an original handler error is not converted to success', () => {
    documentFixture(); const failure = new Error('original handler failed');
    window.game.handleServerMessage = () => { throw failure; };
    installIronFortressObserver();
    expect(() => window.game.handleServerMessage({ type: 'state' })).toThrow(failure);
});
