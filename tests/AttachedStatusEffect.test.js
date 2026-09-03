import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { Actor } from '../src/entities/Actor.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Wizard } from '../src/entities/Wizard.js';
import {
    ACTOR_STATUS_VISUAL_STATES,
    AttachedStatusEffect,
    getStatusVisualDefinition
} from '../src/entities/AttachedStatusEffect.js';
import {
    PROCEDURAL_STATUS_EFFECT_DEFINITIONS,
    createProceduralStatusEffect,
    getProceduralStatusEffectCacheMetrics,
    releaseProceduralStatusEffect,
    updateProceduralStatusEffect
} from '../src/art/ProceduralStatusEffects.js';
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
    test('maps every authoritative replicated buff and debuff field to an intentional status visual', () => {
        const protobufSource = fs.readFileSync(
            path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'internal', 'proto', 'state.pb.go'),
            'utf8'
        );
        const serverFields = {
            iron_fortress: 'IronFortressActive',
            guardian_roar: 'GuardianRoarActive',
            berserker_edge: 'BerserkerModeActive',
            last_stand: 'LastStandActive',
            serrated_edges: 'SerratedEdgesActive',
            poison_coating: 'PoisonCoatingActive',
            stealth: 'StealthActive',
            spell_focus: 'SpellFocusActive',
            arcane_shield: 'ArcaneShieldActive',
            time_warp: 'TimeWarpActive',
            swift: 'SwiftActive',
            guardian_embrace: 'GuardianEmbraceActive',
            blessing_resolve: 'BlessingResolveActive',
            divine_intervention: 'DivineInterventionActive',
            blessing_zeal: 'ZealActive',
            weak_point_mark: 'WeakPointMarked',
            mark_weakness: 'MarkWeakness',
            stunned: 'Stunned',
            rooted: 'Rooted',
            slowed: 'Slowed',
            bleeding: 'Bleeding',
            poisoned: 'Poisoned'
        };

        Object.entries(serverFields).forEach(([statusKey, field]) => {
            expect(protobufSource).toContain(field);
            expect(ACTOR_STATUS_VISUAL_STATES[statusKey]).toEqual(expect.any(Function));
            expect(getStatusVisualDefinition(statusKey)?.motif).toEqual(expect.any(String));
        });
        // Frozen remains the explicit offline compatibility control state; the
        // multiplayer server represents Frost Nova through root/slow fields.
        expect(ACTOR_STATUS_VISUAL_STATES.frozen).toEqual(expect.any(Function));
        expect(getStatusVisualDefinition('frozen')?.motif).toBe('frost-prison');
    });

    test('every declared state has an explicit visual identity', () => {
        expect(Object.keys(PROCEDURAL_STATUS_EFFECT_DEFINITIONS).sort())
            .toEqual(Object.keys(ACTOR_STATUS_VISUAL_STATES).sort());
        const motifs = new Set();
        const artStyles = new Set();
        Object.keys(ACTOR_STATUS_VISUAL_STATES).forEach((statusKey) => {
            const visual = getStatusVisualDefinition(statusKey);
            expect(visual).toEqual(expect.objectContaining({
                family: expect.any(String),
                polarity: expect.stringMatching(/^(buff|debuff)$/),
                motif: expect.any(String),
                artStyle: expect.any(String),
                radius: expect.any(Number)
            }));
            expect(visual.artStyle.length).toBeGreaterThan(12);
            expect(visual.palette).toEqual(expect.objectContaining({
                dark: expect.any(Number),
                base: expect.any(Number),
                accent: expect.any(Number),
                pale: expect.any(Number)
            }));
            motifs.add(visual.motif);
            artStyles.add(visual.artStyle);
        });
        expect(motifs.size).toBe(Object.keys(ACTOR_STATUS_VISUAL_STATES).length);
        expect(artStyles.size).toBe(Object.keys(ACTOR_STATUS_VISUAL_STATES).length);
    });

    test('every high and low quality status is multi-part, finite, and semantically tagged', () => {
        Object.keys(ACTOR_STATUS_VISUAL_STATES).forEach((statusKey) => {
            const high = createProceduralStatusEffect(statusKey, { quality: 'high' });
            const low = createProceduralStatusEffect(statusKey, { quality: 'low' });
            updateProceduralStatusEffect(high, 1.5, 0.016);
            updateProceduralStatusEffect(low, 1.5, 0.016);
            const highParts = [];
            const lowParts = [];
            high.traverse((part) => { if (part.isMesh && part.visible) highParts.push(part); });
            low.traverse((part) => { if (part.isMesh && part.visible) lowParts.push(part); });

            expect(high.userData).toEqual(expect.objectContaining({
                proceduralStatusEffect: true,
                statusKey,
                motif: getStatusVisualDefinition(statusKey).motif,
                artStyle: getStatusVisualDefinition(statusKey).artStyle,
                sharedGeometry: true,
                sharedMaterials: true
            }));
            expect(highParts.length).toBeGreaterThanOrEqual(5);
            expect(lowParts.length).toBeGreaterThanOrEqual(3);
            expect(lowParts.length).toBeLessThanOrEqual(highParts.length);
            high.traverse((part) => {
                expect([
                    part.position.x, part.position.y, part.position.z,
                    part.scale.x, part.scale.y, part.scale.z,
                    part.quaternion.x, part.quaternion.y, part.quaternion.z, part.quaternion.w
                ].every(Number.isFinite)).toBe(true);
            });
            releaseProceduralStatusEffect(high);
            releaseProceduralStatusEffect(low);
        });
        expect(getProceduralStatusEffectCacheMetrics()).toEqual({
            geometries: expect.any(Number),
            materials: expect.any(Number)
        });
        expect(getProceduralStatusEffectCacheMetrics().geometries).toBeGreaterThan(8);
        expect(getProceduralStatusEffectCacheMetrics().materials).toBeGreaterThan(20);
    });

    test('instances share immutable resources without sharing pose or disposing the cache', () => {
        const first = createProceduralStatusEffect('arcane_shield');
        const second = createProceduralStatusEffect('arcane_shield');
        const firstSeal = first.getObjectByName('arcane_shield:OuterSeal');
        const secondSeal = second.getObjectByName('arcane_shield:OuterSeal');
        expect(firstSeal.geometry).toBe(secondSeal.geometry);
        expect(firstSeal.material).toBe(secondSeal.material);
        first.position.set(7, 2, -4);
        expect(second.position.toArray()).toEqual([0, 0, 0]);

        const disposeGeometry = jest.spyOn(firstSeal.geometry, 'dispose');
        const disposeMaterial = jest.spyOn(firstSeal.material, 'dispose');
        releaseProceduralStatusEffect(first);
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
        expect(secondSeal.parent).not.toBeNull();
        disposeGeometry.mockRestore();
        disposeMaterial.mockRestore();
        releaseProceduralStatusEffect(second);
    });

    test('unknown status identities fail closed', () => {
        expect(() => createProceduralStatusEffect('generic_glow')).toThrow(/generic_glow/);
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

    test('freeze readability never mutates a pooled actor material', () => {
        const sharedMaterial = new THREE.MeshBasicMaterial({ color: 0x7b5a3a });
        const actor = new Fighter('frozen-owner');
        actor.mesh = new THREE.Group();
        actor.mesh.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sharedMaterial));
        attachEngine(actor);
        actor.frozenTimer = 1;

        actor.update(0.1, null, null, []);

        expect(sharedMaterial.color.getHex()).toBe(0x7b5a3a);
        expect(actor.frozenTimer).toBeCloseTo(0.9);
        expect(actor.attachedStatusEffects.has('frozen')).toBe(true);
        actor.dispose();
        sharedMaterial.dispose();
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
