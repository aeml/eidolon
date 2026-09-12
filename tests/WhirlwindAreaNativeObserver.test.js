import { jest } from '@jest/globals';
import * as THREE from 'three';
import { GameEngine } from '../src/core/GameEngine.js';
import { installWhirlwindAreaObserver } from './e2e/whirlwind-area-observer.js';

function fixture() {
    const receive = jest.fn(function () { expect(this).toBe(window.game); return 'delivered'; });
    window.game = { player: { id: 'owner', meshType: 'Fighter', position: new THREE.Vector3(), skillRunes: {}, state: 'IDLE' },
        effects: [], handleServerMessage: receive, spawnTransientEffect: GameEngine.prototype.spawnTransientEffect,
        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        uiManager: { getGraphicsQuality: () => 'low' } };
    installWhirlwindAreaObserver(); return receive;
}
afterEach(() => { window.game?.effects.forEach(effect => effect.dispose()); delete window.game; delete window.__whirlwindArea; });

test('raw owner receipts preserve rejection, missing fields and forwarding exactly once', () => {
    const receive = fixture();
    const rejected = { skillName: 'Whirlwind', accepted: false };
    expect(window.game.handleServerMessage({ type: 'ability_result', payload: rejected })).toBe('delivered');
    window.game.handleServerMessage({ type: 'ability', payload: { sourceId: 'other', skillName: 'Whirlwind', radius: 99 } });
    window.game.handleServerMessage({ type: 'state', payload: [
        { id: 'other', whirlwindActive: true, whirlwindRadius: 99 },
        { id: 'owner', whirlwindActive: true }
    ] });
    expect(receive).toHaveBeenCalledTimes(3);
    expect(window.__whirlwindArea).toMatchObject({ results: [rejected], casts: [], states: [{ radius: undefined, duration: undefined }], expired: false });
});

test('only a subsequent explicit owner clear establishes expiry', () => {
    fixture();
    const send = value => window.game.handleServerMessage({ type: 'delta', payload: { u: [value] } });
    send({ id: 'owner', whirlwindActive: false });
    expect(window.__whirlwindArea.expired).toBe(false);
    send({ id: 'owner', whirlwindActive: true, whirlwindRadius: 8.1, whirlwindDuration: 1.9 });
    send({ id: 'other', whirlwindActive: false }); send({ id: 'owner', whirlwindDuration: 0 });
    expect(window.__whirlwindArea.expired).toBe(false);
    send({ id: 'owner', whirlwindActive: false }); expect(window.__whirlwindArea.expired).toBe(true);
});

test('real rendered geometry is observed without changing its lifetime or update result', () => {
    fixture(); const game = window.game;
    expect(game.spawnTransientEffect('spin', game.player.position, 0xd7dbe0,
        { source: game.player, abilityName: 'Whirlwind', radius: 8.1, arc: 2 * Math.PI })).toBe(true);
    const effect = game.player.whirlwindCastEffect;
    effect.authoritativeSeen = true;
    expect(effect.update(.2)).toBeUndefined();
    expect(window.__whirlwindArea.effects).toHaveLength(1);
    expect(window.__whirlwindArea.effects[0].frames[0]).toMatchObject({ elapsed: .2, active: true, acknowledged: true,
        quality: 'low', visible: true, attached: true });
    expect(window.__whirlwindArea.effects[0].frames[0].radius).toBeCloseTo(8.1, 8);
    game.spawnTransientEffect('spin', game.player.position, 0xd7dbe0,
        { source: game.player, abilityName: 'Whirlwind', radius: 6.12, arc: 2 * Math.PI, authoritativeShape: true });
    expect(game.player.whirlwindCastEffect).toBe(effect);
    expect(effect.duration).toBe(1); expect(effect.elapsed).toBe(.2);
    effect.update(.2);
    expect(window.__whirlwindArea.effects[0].frames[1].radius).toBeCloseTo(6.12, 8);
    effect.update(1);
    expect(window.__whirlwindArea.effects[0].frames.at(-1)).toMatchObject({ active: false, attached: false, radius: null });
});

test('reinstall resets records without nesting production wrappers', () => {
    const receive = fixture(), wrapped = window.game.handleServerMessage, spawn = window.game.spawnTransientEffect;
    installWhirlwindAreaObserver();
    expect(window.game.handleServerMessage).toBe(wrapped); expect(window.game.spawnTransientEffect).toBe(spawn);
    window.game.handleServerMessage({ type: 'ability', payload: { sourceId: 'owner', skillName: 'Whirlwind', radius: 6.12 } });
    expect(receive).toHaveBeenCalledTimes(1); expect(window.__whirlwindArea.casts).toHaveLength(1);
    installWhirlwindAreaObserver(); expect(window.__whirlwindArea.casts).toEqual([]);
});

test('original handler failure is not converted into an accepted receipt', () => {
    fixture(); const failure = new Error('delivery failed');
    window.game.handleServerMessage = () => { throw failure; }; installWhirlwindAreaObserver();
    expect(() => window.game.handleServerMessage({ type: 'ability_result', payload: { skillName: 'Whirlwind', accepted: true } })).toThrow(failure);
    expect(window.__whirlwindArea.results).toEqual([]);
});
