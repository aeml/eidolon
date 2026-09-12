import { jest } from '@jest/globals';
import { installTeleportNativeObserver } from './e2e/teleport-native-observer.js';

function fixture(remote = false) {
    const source = { id: 'wizard', invulnerableActive: true, invulnerabilityTimer: 1.2,
        attachedStatusEffects: new Map([['invulnerable', { isActive: true, quality: 'low',
            group: { parent: {}, traverse: callback => callback({ isMesh: true, geometry: { type: 'RingGeometry' } }) } }]]) };
    const receive = jest.fn(function () { expect(this).toBe(window.game); return 'forwarded'; });
    window.game = { player: remote ? { id: 'peer' } : source, remotePlayers: new Map([['wizard', source]]),
        effects: [], handleServerMessage: receive, getActiveBuffs: () => [{ id: 'invulnerable', name: 'Protected' }] };
    return { source, receive };
}
afterEach(() => { delete window.game; delete window.__teleportNative; });

test.each([false, true])('fresh-document observer forwards packets and records actual owner/peer effects: remote=%s', remote => {
    for (let login = 0; login < 2; login++) {
        const f = fixture(remote);
        installTeleportNativeObserver('wizard');
        const packet = { type: 'delta' };
        expect(window.game.handleServerMessage(packet)).toBe('forwarded');
        expect(f.receive).toHaveBeenCalledWith(packet);
        expect(window.__teleportNative.protection).toEqual([{ active: true, duration: 1.2,
            attached: true, solidShells: 0, quality: 'low', buff: remote ? null : 'Protected' }]);
        expect(f.source.invulnerabilityTimer).toBe(1.2);
    }
});

test('reinstallation does not double wrap and boundaries are filtered by source and active state', () => {
    const f = fixture();
    const shape = (sourceId, isActive = true) => ({ isActive,
        abilityShape: { sourceId, skillName: 'Teleport', x: 4, z: 8, radius: 5 },
        meshes: [{ parent: {}, position: { y: 0 }, children: [{ userData: { normalizedGameplayRadius: 1 }, scale: { x: 5 } }] }] });
    window.game.effects = [shape('wizard'), shape('other'), shape('wizard', false)];
    installTeleportNativeObserver('wizard');
    const wrapper = window.game.handleServerMessage;
    installTeleportNativeObserver('wizard');
    expect(window.game.handleServerMessage).toBe(wrapper);
    const packet = { type: 'ability', payload: { sourceId: 'wizard', skillName: 'Teleport', radius: 5 } };
    window.game.handleServerMessage(packet);
    expect(f.receive).toHaveBeenCalledTimes(1);
    expect(window.__teleportNative.casts[0].boundaries).toEqual([
        { x: 4, z: 8, radius: 5, visibleRadius: 5, attached: true, y: 0 }
    ]);
    expect(window.game.effects).toHaveLength(3);
});

test('expired protection and bounded history cannot manufacture an active effect', () => {
    const { source } = fixture();
    source.invulnerableActive = false; source.invulnerabilityTimer = 0;
    source.attachedStatusEffects.clear(); installTeleportNativeObserver('wizard');
    for (let i = 0; i < 50; i++) window.game.handleServerMessage({ type: 'state' });
    expect(window.__teleportNative.protection).toHaveLength(32);
    expect(window.__teleportNative.protection.every(p => !p.active && !p.attached && !p.duration)).toBe(true);
    expect(window.__teleportNative.bestProtection).toBeNull();
});

test('an observed activation survives a later inactive tail without prolonging gameplay protection', () => {
    const { source } = fixture(); installTeleportNativeObserver('wizard');
    window.game.handleServerMessage({ type: 'state' });
    source.invulnerableActive = false; source.invulnerabilityTimer = 0; source.attachedStatusEffects.clear();
    for (let i = 0; i < 50; i++) window.game.handleServerMessage({ type: 'delta' });
    expect(window.__teleportNative.bestProtection).toMatchObject({ duration: 1.2, attached: true });
    expect(window.__teleportNative.protection.every(p => !p.active && !p.attached)).toBe(true);
    expect(source.invulnerabilityTimer).toBe(0);
    installTeleportNativeObserver('wizard');
    expect(window.__teleportNative.bestProtection).toBeNull();
});
