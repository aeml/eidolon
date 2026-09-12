import { jest } from '@jest/globals';
import * as THREE from 'three';
import { GameEngine } from '../src/core/GameEngine.js';
import { installEarthshakerAreaObserver } from './e2e/earthshaker-area-observer.js';

function fixture() {
    const receive = jest.fn(function () { expect(this).toBe(window.game); return 'forwarded'; });
    window.game = { player: { id: 'owner', meshType: 'Fighter', position: new THREE.Vector3(10, 0, 20) },
        effects: [], handleServerMessage: receive, spawnTransientEffect: GameEngine.prototype.spawnTransientEffect,
        uiManager: { getGraphicsQuality: () => 'low' },
        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 } };
    installEarthshakerAreaObserver();
    return receive;
}
afterEach(() => { window.game?.effects.forEach(effect => effect.dispose()); delete window.game; delete window.__earthshakerArea; });

test('raw own receipts retain rejection and missing fields without inventing geometry', () => {
    const receive = fixture();
    const rejected = { skillName: 'Earthshaker', accepted: false };
    expect(window.game.handleServerMessage({ type: 'ability_result', payload: rejected })).toBe('forwarded');
    const missing = { sourceId: 'owner', skillName: 'Earthshaker' };
    window.game.handleServerMessage({ type: 'ability', payload: missing });
    window.game.handleServerMessage({ type: 'ability', payload: { sourceId: 'other', skillName: 'Earthshaker', radius: 99 } });
    expect(receive).toHaveBeenCalledTimes(3);
    expect(window.__earthshakerArea).toEqual({ results: [rejected], casts: [missing], effects: [] });
});

test.each(['circle', 'line'])('%s observation uses attached world matrices, not the asserted gameplay radius', shapeKind => {
    fixture(); const game = window.game;
    game.spawnTransientEffect('wave', game.player.position, 0xb66b35, { source: game.player, abilityName: 'Earthshaker',
        radius: 8.1, arc: 2*Math.PI, shapeKind, authoritativeShape: true, direction: new THREE.Vector3(1, 0, 0) });
    const effect = game.effects[0];
    effect.abilityShape.radius = 900; // Deliberate contradictory metadata; mesh is still8.1.
    expect(effect.update(.2)).toBeUndefined();
    const record = window.__earthshakerArea.effects[0];
    expect(record.frames[0]).toMatchObject({ active: true, acknowledged: true, kind: shapeKind,
        quality: 'low', attached: true, visible: true, boundaryCount: shapeKind === 'line' ? 4 : 1 });
    expect(record.frames[0].radius).toBeCloseTo(8.1, 8);
    expect(record.frames[0].origin).toEqual([10, 0, 20]);
    if (shapeKind === 'line') {
        expect(record.frames[0].halfWidth).toBeCloseTo(2.025, 8);
        expect(record.frames[0].ends[1][0]-record.frames[0].ends[0][0]).toBeCloseTo(8.1, 8);
        expect(record.frames[0].ends[1][2]-record.frames[0].ends[0][2]).toBeCloseTo(0, 8);
    }
    effect.update(1);
    expect(record.frames.at(-1)).toMatchObject({ active: false, attached: false, visible: false, radius: null });
});

test('delayed phase is observed separately and an unacknowledged prediction is never marked accepted', () => {
    fixture(); const game = window.game;
    game.spawnTransientEffect('wave', game.player.position, 0xb66b35, { source: game.player, abilityName: 'Earthshaker',
        radius: 4.725, arc: 2*Math.PI, shapeKind: 'circle', phase: 'aftershock' });
    game.effects[0].update(.1);
    expect(window.__earthshakerArea.effects[0].phase).toBe('aftershock');
    expect(window.__earthshakerArea.effects[0].frames[0].acknowledged).toBe(false);
});

test('reinstall clears observations without nesting wrappers or changing game effects', () => {
    const receive = fixture(), game = window.game;
    const message = game.handleServerMessage, spawn = game.spawnTransientEffect;
    installEarthshakerAreaObserver();
    expect(game.handleServerMessage).toBe(message); expect(game.spawnTransientEffect).toBe(spawn);
    game.handleServerMessage({ type: 'ability', payload: { sourceId: 'owner', skillName: 'Earthshaker' } });
    expect(receive).toHaveBeenCalledTimes(1);
    installEarthshakerAreaObserver();
    expect(window.__earthshakerArea).toEqual({ results: [], casts: [], effects: [] });
});

test('production handler exceptions remain failures, not manufactured accepted receipts', () => {
    fixture(); const failure = new Error('delivery failed');
    window.game.handleServerMessage = () => { throw failure; }; installEarthshakerAreaObserver();
    expect(() => window.game.handleServerMessage({ type: 'ability_result', payload: { skillName: 'Earthshaker', accepted: true } })).toThrow(failure);
    expect(window.__earthshakerArea.results).toEqual([]);
});
