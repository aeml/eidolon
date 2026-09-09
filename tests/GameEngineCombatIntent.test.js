import * as THREE from 'three';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = {
        eidolon: {
            state: {
                StateEnvelope: {
                    decode: jest.fn()
                }
            }
        }
    };
    return { default: mock, ...mock };
});

const { GameEngine } = await import('../src/core/GameEngine.js');

function createActorLike({ id, name, position, hostile = true, state = 'IDLE' }) {
    return {
        id,
        name,
        position: position || new THREE.Vector3(),
        hostile,
        state,
        isActive: true,
        constructor: { name: 'Skeleton' }
    };
}

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.player = {
        abilityName: 'Fireball',
        constructor: { name: 'Wizard' },
        position: new THREE.Vector3(0, 0, 0),
        stats: { damage: 30 }
    };
    engine.hoveredEntity = null;
    engine.combatIntent = null;
    engine.combatIntentSignature = '';
    engine.highlightedCombatTarget = null;
    engine.combatTargetHighlight = null;
    engine.uiManager = {
        updateCombatIntent: jest.fn(),
        clearCombatIntent: jest.fn()
    };
    engine.renderSystem = {
        scene: {
            add: jest.fn(),
            remove: jest.fn()
        }
    };
    engine.abilityController = {
        pendingAbilityTarget: null,
        pendingAbilitySkill: null,
        getAbilityIntentSkillName: () => 'Fireball',
        getAbilityIntentRange: () => 12,
        getAbilityCastRange: () => 12,
        buildCombatActionPreview: () => ({ attackPower: 30, manaCost: 30, abilityName: 'Fireball' })
    };
    engine.isHostileActorTarget = (entity) => Boolean(entity?.hostile && entity?.isActive && entity?.state !== 'DEAD');
    engine.getBasicAttackRangeForPlayer = GameEngine.prototype.getBasicAttackRangeForPlayer;
    engine.getEffectiveCombatTarget = GameEngine.prototype.getEffectiveCombatTarget;
    engine.serializeCombatIntent = GameEngine.prototype.serializeCombatIntent;
    engine.buildCombatIntentState = GameEngine.prototype.buildCombatIntentState;
    engine.createCombatTargetHighlight = GameEngine.prototype.createCombatTargetHighlight;
    engine.positionCombatTargetHighlight = GameEngine.prototype.positionCombatTargetHighlight;
    engine.attachCombatTargetHighlight = GameEngine.prototype.attachCombatTargetHighlight;
    engine.detachCombatTargetHighlight = GameEngine.prototype.detachCombatTargetHighlight;
    engine.updateCombatTargetHighlight = GameEngine.prototype.updateCombatTargetHighlight;
    engine.refreshCombatIntentState = GameEngine.prototype.refreshCombatIntentState;
    engine.clearCombatIntentState = GameEngine.prototype.clearCombatIntentState;
    return engine;
}

describe('GameEngine combat intent', () => {
    test('cast cost and attack power changes invalidate the same-target engine cache', () => {
        const engine = createEngineHarness();
        const first = { entityId: 'same', preview: { attackPower: 5, manaCost: 30, abilityName: 'Fireball' } };
        expect(engine.serializeCombatIntent(first)).not.toBe(engine.serializeCombatIntent({
            ...first, preview: { ...first.preview, manaCost: 27 } }));
        expect(engine.serializeCombatIntent(first)).not.toBe(engine.serializeCombatIntent({
            ...first, preview: { ...first.preview, attackPower: 7 } }));
        engine.hoveredEntity = createActorLike({ id: 'missing-controller' });
        delete engine.abilityController.buildCombatActionPreview;
        expect(engine.buildCombatIntentState().preview.manaCost).toBeNull();
        expect(engine.buildCombatIntentState().preview).not.toHaveProperty('ability');
    });
    test('replicated target level reaches the card and invalidates its cache', () => {
        const engine = createEngineHarness();
        engine.hoveredEntity = { ...createActorLike({ id: 'level-target' }), level: 7 };
        const first = engine.buildCombatIntentState();
        expect(first.targetLevel).toBe(7);
        engine.hoveredEntity.level = 8;
        expect(engine.serializeCombatIntent(engine.buildCombatIntentState()))
            .not.toBe(engine.serializeCombatIntent(first));
        engine.hoveredEntity.level = NaN;
        expect(engine.buildCombatIntentState().targetLevel).toBeNull();
    });
    test('builds move-into-range state for hovered hostile targets outside cast range', () => {
        const engine = createEngineHarness();
        engine.hoveredEntity = createActorLike({
            id: 'enemy-1',
            name: 'Skeleton Archer',
            position: new THREE.Vector3(20, 0, 0)
        });

        const intent = engine.buildCombatIntentState();

        expect(intent.entityId).toBe('enemy-1');
        expect(intent.status).toBe('move_into_range');
        expect(intent.inAbilityRange).toBe(false);
        expect(intent.preview.abilityName).toBe('Fireball');
    });

    test('prefers pending ability target over hovered target', () => {
        const engine = createEngineHarness();
        engine.hoveredEntity = createActorLike({
            id: 'enemy-hovered',
            name: 'Hovered Enemy',
            position: new THREE.Vector3(6, 0, 0)
        });
        engine.abilityController.pendingAbilityTarget = createActorLike({
            id: 'enemy-pending',
            name: 'Pending Enemy',
            position: new THREE.Vector3(10, 0, 0)
        });

        const intent = engine.buildCombatIntentState();
        expect(intent.entityId).toBe('enemy-pending');
        expect(intent.name).toBe('Pending Enemy');
    });

    test('refresh updates UI for hostile targets and clears when target is gone', () => {
        const engine = createEngineHarness();
        engine.hoveredEntity = createActorLike({
            id: 'enemy-1',
            name: 'Skeleton Archer',
            position: new THREE.Vector3(8, 0, 0)
        });

        engine.refreshCombatIntentState();
        expect(engine.uiManager.updateCombatIntent).toHaveBeenCalledTimes(1);
        expect(engine.combatIntent.status).toBe('in_range');

        engine.hoveredEntity = null;
        engine.abilityController.pendingAbilityTarget = null;
        engine.refreshCombatIntentState();
        expect(engine.uiManager.clearCombatIntent).toHaveBeenCalledTimes(1);
    });
});
