import * as THREE from 'three';
import { jest } from '@jest/globals';
import { GameEngine } from '../src/core/GameEngine.js';
import { Actor } from '../src/entities/Actor.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { stopWhirlwindPresentation } from '../src/skills/whirlwindPresentation.js';
import { eidolon } from '../src/proto/state_pb.js';

function fixture(quality, extended, remote = false) {
    const source = { id: 'spin-test', meshType: 'Fighter', state: 'IDLE', isRemote: remote,
        position: new THREE.Vector3(50000, 0, 50000), mesh: new THREE.Group(),
        skillRunes: extended ? { Whirlwind: 'whirlwind_extended' } : {},
        playAbilityAnimation: jest.fn(), playAnimation: jest.fn() };
    const engine = { effects: [], isMultiplayer: true, player: remote ? null : source,
        uiManager: { getGraphicsQuality: () => quality },
        renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
        showRemoteSupportStateReadability: jest.fn(),
        spawnTransientEffect: GameEngine.prototype.spawnTransientEffect,
        syncRemoteSupportEffects: GameEngine.prototype.syncRemoteSupportEffects };
    return { source, engine };
}

describe('Whirlwind presentation', () => {
    test('a final in-flight snapshot cannot recreate an expired spin', () => {
        const { source, engine } = fixture('high', false, true);
        engine.syncRemoteSupportEffects(source, { whirlwindActive: true, whirlwindDuration: 0.03 });
        source.whirlwindCastEffect.update(0.04);
        expect(source.whirlwindCastEffect).toBeNull();
        engine.syncRemoteSupportEffects(source, { whirlwindActive: true, whirlwindDuration: 0.01 });
        expect(engine.effects).toHaveLength(1);
        expect(source.whirlwindCastEffect).toBeNull();
        engine.syncRemoteSupportEffects(source, { whirlwindActive: false, whirlwindDuration: 0 });
        engine.syncRemoteSupportEffects(source, { whirlwindActive: true, whirlwindDuration: 0.98 });
        expect(engine.effects).toHaveLength(2);
        stopWhirlwindPresentation(source);
    });

    test('stale inactive snapshots preserve a prediction, but a rejected cast cancels it', () => {
        const { source, engine } = fixture('high', false);
        Actor.prototype.spawnAbilityPresentation.call(source, engine, 'Whirlwind', source.position);
        source.currentAbilityAnimation = { skillName: 'Whirlwind' };
        engine.syncRemoteSupportEffects(source, { whirlwindActive: false, whirlwindDuration: 0 });
        expect(source.whirlwindCastEffect.isActive).toBe(true);
        expect(stopWhirlwindPresentation(source, { predictedOnly: true })).toBe(true);
        expect(source.whirlwindCastEffect).toBeNull();
        expect(source.currentAbilityAnimation).toBeNull();
        expect(source.playAnimation).toHaveBeenCalledWith('Idle', true, true);
        expect(engine.renderSystem.effectGroup.children).toHaveLength(0);
    });

    test('a rejected repeat cast does not cancel the already acknowledged spin', () => {
        const { source, engine } = fixture('high', true);
        engine.syncRemoteSupportEffects(source, { whirlwindActive: true, whirlwindDuration: 1.6 });
        try {
            expect(stopWhirlwindPresentation(source, { predictedOnly: true })).toBe(false);
            expect(source.whirlwindCastEffect.isActive).toBe(true);
            expect(source.whirlwindRemaining).toBe(1.6);
        } finally { stopWhirlwindPresentation(source); }
    });

    test.each(['death', 'removed', 'scene disposal'])('%s clears the owner and effect without replaying idle on a corpse', reason => {
        const { source, engine } = fixture('low', true);
        engine.syncRemoteSupportEffects(source, { whirlwindActive: true, whirlwindDuration: 2 });
        source.currentAbilityAnimation = { skillName: 'Whirlwind' };
        const effect = source.whirlwindCastEffect;
        if (reason === 'death') source.state = 'DEAD';
        if (reason === 'removed') source.isActive = false;
        if (reason === 'scene disposal') effect.dispose();
        else effect.update(0.02);
        effect.dispose(); // Scene cleanup may encounter the expired entry again.
        expect(source.whirlwindCastEffect).toBeNull();
        expect(source.whirlwindActive).toBe(false);
        expect(source.currentAbilityAnimation).toBeNull();
        expect(effect.root.parent).toBeNull();
        if (reason === 'death') expect(source.playAnimation).not.toHaveBeenCalled();
    });

    test('protobuf active and default-false snapshots start and stop the same observer effect', () => {
        const { source, engine } = fixture('high', true, true);
        const snapshot = fields => eidolon.state.Entity.decode(eidolon.state.Entity.encode({ id: source.id, ...fields }).finish());
        engine.syncRemoteSupportEffects(source, snapshot({ whirlwindActive: true, whirlwindDuration: 1.4 }));
        expect(source.whirlwindCastEffect.authoritativeSeen).toBe(true);
        engine.syncRemoteSupportEffects(source, snapshot({}));
        expect(source.whirlwindCastEffect).toBeNull();
        expect(engine.renderSystem.effectGroup.children).toHaveLength(0);
    });

    for (const quality of ['high', 'low']) {
        for (const extended of [false, true]) {
            for (const remote of [false, true]) {
                test(`${quality}, extended=${extended}, remote=${remote}: spin follows the caster for its full duration`, () => {
                    const { source, engine } = fixture(quality, extended, remote);
                    if (remote) AbilityController.prototype.triggerRemoteAbilityVisuals.call({ engine }, source, 'Whirlwind', 50000, 50000);
                    else Actor.prototype.spawnAbilityPresentation.call(source, engine, 'Whirlwind', source.position);
                    try {
                        const effect = engine.effects[0];
                        const duration = extended ? 2 : 1;
                        expect(effect.duration).toBe(duration);
                        source.position.x += 4;
                        effect.update(duration - 0.05);
                        expect(effect.isActive).toBe(true);
                        expect(effect.root.position.x).toBe(source.position.x);
                        expect(effect.root.userData.gameplayRadius).toBe(6);
                        effect.update(0.1);
                        expect(effect.isActive).toBe(false);
                        expect(effect.root.parent).toBeNull();
                    } finally { for (const effect of engine.effects) effect.dispose(); }
                });
            }
        }
        test(`${quality}: a late observer sees only the remaining spin and an explicit stop cancels it`, () => {
            const { source, engine } = fixture(quality, true, true);
            engine.syncRemoteSupportEffects(source, { whirlwindActive: true, whirlwindDuration: 0.6 });
            try {
                expect(engine.effects).toHaveLength(1);
                const effect = engine.effects[0];
                expect(effect.duration).toBeCloseTo(0.6);
                expect(source.playAbilityAnimation).toHaveBeenCalledWith('Whirlwind', expect.objectContaining({ duration: 0.6 }));
                // A delayed ability event must not double the active mesh or
                // reset a partially completed spin to the full rune duration.
                AbilityController.prototype.triggerRemoteAbilityVisuals.call({ engine }, source, 'Whirlwind', 50000, 50000);
                expect(engine.effects).toHaveLength(1);
                expect(effect.duration).toBeCloseTo(0.6);
                engine.syncRemoteSupportEffects(source, { whirlwindActive: false, whirlwindDuration: 0 });
                expect(effect.isActive).toBe(false);
                expect(effect.root.parent).toBeNull();
            } finally { for (const effect of engine.effects) effect.dispose(); }
        });
    }

    test.each([false, true])('actor animation uses the authored rune duration, extended=%s', extended => {
        const { source } = fixture('high', extended);
        const scale = jest.fn();
        source.animations = { Attack: {} };
        source.currentAction = { getClip: () => ({ duration: 1 }), setEffectiveTimeScale: scale };
        source.playAnimation = () => true;
        Actor.prototype.playAbilityAnimation.call(source, 'Whirlwind');
        expect(source.currentAbilityAnimation.duration).toBe(extended ? 2 : 1);
        expect(scale).toHaveBeenCalledWith(extended ? 0.5 : 1);
    });
});
