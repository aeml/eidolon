import * as THREE from 'three';
import { jest } from '@jest/globals';
import { GameEngine } from '../src/core/GameEngine.js';

function actor(id, meshType, x = 0, z = 0) {
    return { id, meshType, position: new THREE.Vector3(x, 0.5, z) };
}

function makeEngine() {
    const player = actor('player-local', 'Fighter');
    const engine = {
        player,
        currentInstanceId: 'dungeon-feedback',
        remotePlayers: new Map(),
        combatFeedbackCueTimestamps: new Map(),
        spawnTransientEffect: jest.fn(() => true),
        floatingTextManager: { spawn: jest.fn() },
        playAudioCue: jest.fn(),
        isPlayerClassEntity: (entity) => ['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(entity?.meshType),
        isNearbyCombatEvent: jest.fn(() => true),
        resolveCombatFeedbackKind: GameEngine.prototype.resolveCombatFeedbackKind,
        renderCombatFeedback: GameEngine.prototype.renderCombatFeedback,
        handleServerMessage: GameEngine.prototype.handleServerMessage,
        showNearbyRemoteDamageFeedback: jest.fn(() => true)
    };
    return engine;
}

describe('authoritative combat feedback visuals', () => {
    test.each([
        ['physical', 'Fighter', 'fighter_strike'],
        ['physical', 'Rogue', 'rogue_strike'],
        ['arcane', 'Wizard', 'wizard_strike'],
        ['holy', 'Cleric', 'cleric_strike'],
        ['bleed', 'Rogue', 'bleed_tick'],
        ['poison', 'Rogue', 'poison_tick'],
        ['reflect', 'Fighter', 'reflect_strike'],
        ['lava_pool', null, 'lava_tick'],
        ['sandstorm', null, 'sandstorm_tick'],
        ['lightning_zone', null, 'lightning_tick'],
        ['wind_gust', null, 'wind_tick']
    ])('maps server damage kind %s to %s', (kind, meshType, expected) => {
        const engine = makeEngine();
        const source = meshType ? actor('source', meshType) : null;
        expect(engine.resolveCombatFeedbackKind({ kind, sourceId: 'source' }, source, engine.player, 'damage')).toBe(expected);
    });

    test.each([
        ['holy', 'Cleric', 'other', 'cleric_heal'],
        ['healing_light_hot', 'Cleric', 'other', 'restoration_tick'],
        ['guardian_embrace', 'Cleric', 'other', 'restoration_tick'],
        ['spirit_guardians', 'Cleric', 'other', 'restoration_tick'],
        ['lifesteal', 'Fighter', 'player-local', 'lifesteal'],
        ['self_restore', 'Fighter', 'player-local', 'self_restore'],
        ['self_restore', 'Cleric', 'player-local', 'self_restore'],
        ['divine_intervention', 'Cleric', 'player-local', 'self_restore']
    ])('maps server healing kind %s to %s', (kind, meshType, targetId, expected) => {
        const engine = makeEngine();
        const source = actor('player-local', meshType);
        expect(engine.resolveCombatFeedbackKind({
            kind, sourceId: 'player-local', targetId
        }, source, engine.player, 'heal')).toBe(expected);
    });

    test('damage messages retain floating numbers and add a compact typed reaction', () => {
        const engine = makeEngine();
        const enemy = actor('enemy-1', 'Skeleton', 2, 3);
        engine.remotePlayers.set(enemy.id, enemy);
        engine.handleServerMessage({
            type: 'damage',
            payload: {
                sourceId: engine.player.id,
                targetId: enemy.id,
                amount: 72,
                kind: 'physical',
                instanceId: 'dungeon-feedback'
            }
        });
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith(72, enemy.position, '#ffff00');
        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'combat_feedback', expect.objectContaining({ x: 2, z: 3 }), 0xffffff,
            expect.objectContaining({
                feedbackKind: 'fighter_strike', amount: 72,
                sourceId: engine.player.id, targetId: enemy.id,
                instanceId: 'dungeon-feedback'
            })
        );
    });

    test('heal messages use their authoritative restoration kind', () => {
        const engine = makeEngine();
        engine.player.meshType = 'Cleric';
        engine.handleServerMessage({
            type: 'heal',
            payload: {
                sourceId: engine.player.id,
                targetId: engine.player.id,
                amount: 41,
                kind: 'healing_light_hot',
                instanceId: 'dungeon-feedback'
            }
        });
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('+41', engine.player.position, '#55ff9b');
        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'combat_feedback', expect.any(THREE.Vector3), 0xffffff,
            expect.objectContaining({ feedbackKind: 'restoration_tick', amount: 41 })
        );
    });

    test('filters other instances and unrelated distant fights', () => {
        const engine = makeEngine();
        const enemy = actor('enemy-1', 'Skeleton', 2, 3);
        engine.remotePlayers.set(enemy.id, enemy);
        expect(engine.renderCombatFeedback({
            sourceId: engine.player.id, targetId: enemy.id, amount: 10,
            kind: 'physical', instanceId: 'other-dungeon'
        }, 'damage')).toBe(false);
        engine.isNearbyCombatEvent.mockReturnValue(false);
        expect(engine.renderCombatFeedback({
            sourceId: 'enemy-far', targetId: enemy.id, amount: 10,
            kind: 'physical', instanceId: 'dungeon-feedback'
        }, 'damage')).toBe(false);
        expect(engine.spawnTransientEffect).not.toHaveBeenCalled();
    });

    test('keeps combat messages safe before a production effect scene exists', () => {
        const engine = makeEngine();
        const enemy = actor('enemy-1', 'Skeleton', 2, 3);
        engine.remotePlayers.set(enemy.id, enemy);
        delete engine.spawnTransientEffect;
        expect(engine.renderCombatFeedback({
            sourceId: engine.player.id, targetId: enemy.id, amount: 10,
            kind: 'physical', instanceId: 'dungeon-feedback'
        }, 'damage')).toBe(false);
    });

    test('throttles only matching target/kind reactions while preserving different afflictions', () => {
        const engine = makeEngine();
        const enemy = actor('enemy-1', 'Skeleton', 2, 3);
        engine.remotePlayers.set(enemy.id, enemy);
        const base = {
            sourceId: engine.player.id, targetId: enemy.id, amount: 10,
            instanceId: 'dungeon-feedback'
        };
        expect(engine.renderCombatFeedback({ ...base, kind: 'bleed' }, 'damage')).toBe(true);
        expect(engine.renderCombatFeedback({ ...base, kind: 'bleed' }, 'damage')).toBe(false);
        expect(engine.renderCombatFeedback({ ...base, kind: 'poison' }, 'damage')).toBe(true);
        expect(engine.spawnTransientEffect).toHaveBeenCalledTimes(2);
    });
});
