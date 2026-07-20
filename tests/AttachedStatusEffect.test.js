import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Actor } from '../src/entities/Actor.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Wizard } from '../src/entities/Wizard.js';
import {
    ACTOR_STATUS_VISUAL_STATES,
    AttachedStatusEffect,
    getStatusVisualDefinition
} from '../src/entities/AttachedStatusEffect.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { GameEngine } from '../src/core/GameEngine.js';

function attachEngine(actor, quality = 'high') {
    const effectGroup = new THREE.Group();
    actor.gameEngine = {
        renderSystem: { effectGroup, graphicsQuality: quality }
    };
    return effectGroup;
}

describe('attached status effect lifecycle', () => {
    test('every declared state has an explicit visual identity', () => {
        Object.keys(ACTOR_STATUS_VISUAL_STATES).forEach((statusKey) => {
            expect(getStatusVisualDefinition(statusKey)).toEqual(expect.objectContaining({
                style: expect.any(String),
                color: expect.any(Number),
                accent: expect.any(Number),
                radius: expect.any(Number)
            }));
        });
    });

    test('world-space effect follows an actor without inheriting model scale or facing', () => {
        const owner = new Fighter('fighter-status');
        owner.mesh = new THREE.Group();
        owner.mesh.scale.setScalar(4);
        owner.mesh.rotation.y = 1.7;
        owner.mesh.position.set(7, 0.4, -3);
        const scene = new THREE.Group();
        const effect = new AttachedStatusEffect(scene, owner, 'iron_fortress');

        expect(effect.group.parent).toBe(scene);
        expect(effect.group.position.toArray()).toEqual([7, 0.4, -3]);
        expect(effect.group.scale.toArray()).toEqual([1, 1, 1]);
        expect(effect.group.rotation.y).toBe(0);

        owner.mesh.position.set(-4, 1.2, 9);
        effect.update(0.25);
        expect(effect.group.position.toArray()).toEqual([-4, 1.2, 9]);
        effect.dispose();
    });

    test('actor sync creates once, reconstructs after scene clear, and expires once', () => {
        const actor = new Fighter('fighter-sync');
        actor.mesh = new THREE.Group();
        const scene = attachEngine(actor);
        actor.ironFortressTimer = 10;

        expect(actor.syncAttachedStatusEffects(0.1)).toBe(1);
        const first = actor.attachedStatusEffects.get('iron_fortress');
        actor.syncAttachedStatusEffects(0.1);
        expect(actor.attachedStatusEffects.get('iron_fortress')).toBe(first);
        expect(scene.children).toEqual([first.group]);

        scene.clear();
        actor.syncAttachedStatusEffects(0.1);
        expect(scene.children).toEqual([first.group]);

        const dispose = jest.spyOn(first, 'dispose');
        actor.ironFortressTimer = 0;
        actor.syncAttachedStatusEffects(0.1);
        actor.syncAttachedStatusEffects(0.1);
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(actor.attachedStatusEffects.size).toBe(0);
        expect(scene.children).toHaveLength(0);
    });

    test('death and disposal clear every status resource and managed callback', () => {
        jest.useFakeTimers();
        try {
            const actor = new Actor('actor-cleanup', CONSTANTS.ENTITIES.FIGHTER);
            actor.mesh = new THREE.Group();
            const scene = attachEngine(actor);
            actor.guardianRoarTimer = 5;
            actor.poisonTimer = 5;
            actor.syncAttachedStatusEffects(0);
            expect(scene.children).toHaveLength(2);
            const callback = jest.fn();
            actor.scheduleTask(callback, 50);

            actor.die();
            jest.advanceTimersByTime(100);
            expect(callback).not.toHaveBeenCalled();
            expect(actor.attachedStatusEffects.size).toBe(0);
            expect(scene.children).toHaveLength(0);
            actor.dispose();
        } finally {
            jest.useRealTimers();
        }
    });

    test('server duration-only snapshots refresh remote visuals and debuffs', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.showRemoteSupportStateReadability = jest.fn();
        const wizard = new Wizard('remote-wizard');
        wizard.isRemote = true;
        wizard.mesh = new THREE.Group();
        const scene = attachEngine(wizard);

        engine.syncRemoteSupportEffects(wizard, {
            arcaneShieldActive: true,
            arcaneShieldHp: 125,
            arcaneShieldDuration: 7.5
        });
        expect(wizard.arcaneShieldTimer).toBe(7.5);
        expect(wizard.attachedStatusEffects.has('arcane_shield')).toBe(true);

        engine.syncRemoteSupportEffects(wizard, { arcaneShieldDuration: 3.25 });
        expect(wizard.arcaneShieldTimer).toBe(3.25);
        expect(scene.children).toHaveLength(1);

        engine.syncPlayerStatusDetails(wizard, {
            poisoned: true,
            poisonDuration: 4,
            poisonDamage: 12
        });
        wizard.syncAttachedStatusEffects(0);
        expect(wizard.attachedStatusEffects.has('poisoned')).toBe(true);

        engine.syncPlayerStatusClears(wizard, { poisoned: false });
        wizard.syncAttachedStatusEffects(0);
        expect(wizard.attachedStatusEffects.has('poisoned')).toBe(false);
        wizard.dispose();
    });

    test.each([
        ['iron_fortress', 'ironFortressActive', 'ironFortressDuration', 'ironFortressTimer'],
        ['guardian_roar', 'guardianRoarActive', 'guardianRoarDuration', 'guardianRoarTimer'],
        ['berserker_edge', 'berserkerModeActive', 'berserkerModeDuration', 'berserkerEdgeTimer'],
        ['last_stand', 'lastStandActive', 'lastStandDuration', 'lastStandTimer'],
        ['serrated_edges', 'serratedEdgesActive', 'serratedEdgesDuration', 'serratedEdgesTimer'],
        ['poison_coating', 'poisonCoatingActive', 'poisonCoatingDuration', 'poisonCoatingTimer'],
        ['stealth', 'stealthActive', 'stealthDuration', 'stealthTimer'],
        ['blessing_zeal', 'zealActive', 'zealDuration', 'blessingZealTimer']
    ])('reconstructs authoritative %s visuals for local and remote actors',
        (statusKey, activeKey, durationKey, timerKey) => {
            const engine = Object.create(GameEngine.prototype);
            engine.showRemoteSupportStateReadability = jest.fn();
            const actor = new Fighter(`remote-${statusKey}`);
            actor.isRemote = true;
            actor.mesh = new THREE.Group();
            const scene = attachEngine(actor);

            engine.syncRemoteSupportEffects(actor, {
                [activeKey]: true,
                [durationKey]: 7.5
            });
            expect(actor[timerKey]).toBe(7.5);
            expect(actor.attachedStatusEffects.has(statusKey)).toBe(true);
            expect(scene.children).toHaveLength(1);

            engine.syncRemoteSupportEffects(actor, { [durationKey]: 3.25 });
            expect(actor[timerKey]).toBe(3.25);
            expect(actor.attachedStatusEffects.has(statusKey)).toBe(true);

            engine.syncRemoteSupportEffects(actor, {
                [activeKey]: false,
                [durationKey]: 0
            });
            expect(actor[timerKey]).toBe(0);
            expect(actor.attachedStatusEffects.has(statusKey)).toBe(false);
            expect(scene.children).toHaveLength(0);
            actor.dispose();
        });

    test('repeated status churn has stable scene and resource counts', () => {
        const actor = new Fighter('fighter-soak');
        actor.mesh = new THREE.Group();
        const scene = attachEngine(actor);
        let expectedMetrics = null;

        for (let cycle = 0; cycle < 30; cycle++) {
            actor.lastStandTimer = 2;
            actor.syncAttachedStatusEffects(0.016);
            const metrics = actor.getAttachedStatusEffectMetrics();
            expectedMetrics ||= metrics;
            expect(metrics).toEqual(expectedMetrics);
            expect(scene.children).toHaveLength(1);
            actor.lastStandTimer = 0;
            actor.syncAttachedStatusEffects(0.016);
            expect(scene.children).toHaveLength(0);
            expect(actor.getAttachedStatusEffectMetrics()).toEqual({
                effects: 0,
                meshes: 0,
                geometries: 0,
                materials: 0
            });
        }
    });
});
