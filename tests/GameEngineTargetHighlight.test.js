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

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.renderSystem = {
        scene: {
            add(obj) {
                obj.parent = this;
            },
            remove(obj) {
                if (obj) obj.parent = null;
            }
        }
    };
    engine.isHostileActorTarget = (entity) => Boolean(entity?.hostile && entity?.isActive && entity?.state !== 'DEAD');
    engine.combatTargetHighlight = null;
    engine.highlightedCombatTarget = null;
    engine.createCombatTargetHighlight = GameEngine.prototype.createCombatTargetHighlight;
    engine.positionCombatTargetHighlight = GameEngine.prototype.positionCombatTargetHighlight;
    engine.attachCombatTargetHighlight = GameEngine.prototype.attachCombatTargetHighlight;
    engine.detachCombatTargetHighlight = GameEngine.prototype.detachCombatTargetHighlight;
    engine.updateCombatTargetHighlight = GameEngine.prototype.updateCombatTargetHighlight;
    engine.clearCombatIntentState = GameEngine.prototype.clearCombatIntentState;
    engine.uiManager = {
        clearCombatIntent: jest.fn(),
        clearDungeonEntranceHint: jest.fn()
    };
    engine.abilityController = {
        pendingAbilityTarget: { id: 'target' },
        pendingAbilitySkill: 'Fireball'
    };
    engine.dungeonEntranceHint = { text: 'hint' };
    return engine;
}

function createTarget(id, x, z) {
    return {
        id,
        hostile: true,
        isActive: true,
        state: 'IDLE',
        position: new THREE.Vector3(x, 0, z),
        constructor: { name: 'Skeleton' }
    };
}

describe('GameEngine combat target highlight', () => {
    test('attaches a reusable highlight to the current combat target', () => {
        const engine = createEngineHarness();
        const target = createTarget('enemy-1', 10, 4);
        engine.combatIntent = { entity: target };

        engine.updateCombatTargetHighlight();

        expect(engine.combatTargetHighlight).toBeTruthy();
        expect(engine.combatTargetHighlight.visible).toBe(true);
        expect(engine.highlightedCombatTarget).toBe(target);
        expect(engine.combatTargetHighlight.position.x).toBe(10);
        expect(engine.combatTargetHighlight.position.z).toBe(4);
    });

    test('clears highlight when no hostile combat target remains', () => {
        const engine = createEngineHarness();
        const target = createTarget('enemy-1', 10, 4);
        engine.combatIntent = { entity: target };
        engine.updateCombatTargetHighlight();

        engine.combatIntent = null;
        engine.updateCombatTargetHighlight();

        expect(engine.highlightedCombatTarget).toBeNull();
        expect(engine.combatTargetHighlight.visible).toBe(false);
    });

    test('clearCombatIntentState detaches the highlight and clears queued combat hint state', () => {
        const engine = createEngineHarness();
        const target = createTarget('enemy-1', 10, 4);
        engine.combatIntent = { entity: target };
        engine.combatIntentSignature = 'enemy-1';
        engine.updateCombatTargetHighlight();

        engine.clearCombatIntentState();

        expect(engine.combatIntent).toBeNull();
        expect(engine.combatIntentSignature).toBe('');
        expect(engine.highlightedCombatTarget).toBeNull();
        expect(engine.combatTargetHighlight.visible).toBe(false);
        expect(engine.combatTargetHighlight.parent).toBeNull();
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
        expect(engine.abilityController.pendingAbilitySkill).toBeNull();
        expect(engine.dungeonEntranceHint).toBeNull();
        expect(engine.uiManager.clearCombatIntent).toHaveBeenCalledTimes(1);
        expect(engine.uiManager.clearDungeonEntranceHint).toHaveBeenCalledTimes(1);
    });
});
