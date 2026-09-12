import { jest } from '@jest/globals';
import { installTimeWarpObserver } from './e2e/time-warp-observer.js';

function freshDocument() {
    const receive = jest.fn(function () { expect(this).toBe(window.game); return 'forwarded'; });
    window.game = { handleServerMessage: receive, effects: [], player: { hasteTimer: 11.2 } };
    delete window.__timeWarpNative;
    return receive;
}

afterEach(() => { delete window.game; delete window.__timeWarpNative; });

test('a new document needs its own observer and preserves ordinary packet delivery', () => {
    for (let login = 0; login < 2; login++) {
        const receive = freshDocument();
        expect(window.game.handleServerMessage.timeWarpNativeObserver).toBeUndefined();
        installTimeWarpObserver();
        const packet = { type: 'ability_result', payload: { skillName: 'Time Warp', accepted: true } };
        expect(window.game.handleServerMessage(packet)).toBe('forwarded');
        window.game.handleServerMessage({ type: 'state' });
        expect(receive).toHaveBeenCalledTimes(2);
        expect(window.__timeWarpNative.results).toEqual([packet.payload]);
        expect(window.__timeWarpNative.maxDuration).toBe(11.2);
    }
});

test('reinstallation in one document resets receipts without double-wrapping gameplay', () => {
    const receive = freshDocument();
    window.game.effects = [{ abilityShape: { skillName: 'Time Warp', sourceId: 'caster' },
        meshes: [{ children: [{ userData: { normalizedGameplayRadius: 1 }, scale: { x: 18.75 } }] }] }];
    installTimeWarpObserver();
    const wrapper = window.game.handleServerMessage;
    installTimeWarpObserver();
    expect(window.game.handleServerMessage).toBe(wrapper);
    window.game.handleServerMessage({ type: 'ability', payload: { skillName: 'Time Warp', sourceId: 'caster', radius: 18.75 } });
    expect(receive).toHaveBeenCalledTimes(1);
    expect(window.__timeWarpNative.casts).toEqual([{ skillName: 'Time Warp', sourceId: 'caster', radius: 18.75, visibleRadius: 18.75 }]);
});
