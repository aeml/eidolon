import * as THREE from 'three';
import { jest } from '@jest/globals';
import {
    PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS,
    createProceduralCombatFeedbackEffect,
    getProceduralCombatFeedbackCacheMetrics
} from '../src/art/ProceduralCombatFeedback.js';
import { createTransientEffect } from '../src/core/TransientEffects.js';

const KINDS = Object.freeze([
    'fighter_strike', 'rogue_strike', 'wizard_strike', 'cleric_strike',
    'enemy_strike', 'reflect_strike', 'bleed_tick', 'poison_tick',
    'lava_tick', 'sandstorm_tick', 'lightning_tick', 'wind_tick',
    'cleric_heal', 'restoration_tick', 'lifesteal', 'self_restore'
]);

function meshes(root) {
    const result = [];
    root.traverse((part) => {
        if (part.isMesh) result.push(part);
    });
    return result;
}

describe('procedural combat feedback', () => {
    test.each(KINDS.filter(kind => !kind.endsWith('_strike')))('%s is a bounded body cue, not a decorative area ring', feedbackKind => {
        const old = globalThis.matchMedia;
        try {
            for (const reduce of [false, true]) {
                globalThis.matchMedia = () => ({ matches: reduce });
                const scene = new THREE.Group(), position = new THREE.Vector3(5, 3, 9);
                const a = createProceduralCombatFeedbackEffect(scene, position, { feedbackKind, amount: 100 });
                const b = createProceduralCombatFeedbackEffect(scene, position, { feedbackKind, amount: 100 });
                const parts = [...a.root.children], starts = parts.map(p => p.position.clone());
                const rotations = parts.map(p => p.quaternion.clone());
                expect(parts.every(p => !/RingGeometry|TorusGeometry/.test(p.geometry.type))).toBe(feedbackKind !== 'wind_tick');
                // Wind keeps a small upright crescent, never a ground ring.
                expect(parts.every(p => /TickMote/.test(p.name))).toBe(true);
                a.update(.2); for (let i = 0; i < 10; i++) b.update(.02);
                parts.forEach((part, i) => {
                    expect(part.position.distanceTo(b.root.children[i].position)).toBeLessThan(1e-6);
                    expect(part.scale.distanceTo(b.root.children[i].scale)).toBeLessThan(1e-6);
                    expect(part.quaternion.equals(rotations[i])).toBe(true);
                    expect(Math.hypot(part.position.x, part.position.z)).toBeLessThan(.8);
                    if (reduce) expect(part.position.equals(starts[i])).toBe(true);
                    else if (a.root.userData.restorative) expect(part.position.y).toBeGreaterThan(starts[i].y);
                    else expect(part.position.y).toBeLessThan(starts[i].y);
                });
                expect(a.root.position.equals(position)).toBe(true);
                a.update(1); b.dispose();
                expect(scene.children).toHaveLength(0);
                expect(a.disposed).toBe(true);
            }
        } finally {
            if (old) globalThis.matchMedia = old; else delete globalThis.matchMedia;
        }
    });

    test('direct hits face the source, expire quickly and preserve resources across frame sizes', () => {
        const scene = new THREE.Group(), options = { feedbackKind: 'fighter_strike', amount: 20,
            impactDirection: { x: 1, z: 0 } };
        const first = createProceduralCombatFeedbackEffect(scene, new THREE.Vector3(0, 2, 0), options);
        const second = createProceduralCombatFeedbackEffect(scene, new THREE.Vector3(0, 2, 0), options);
        expect(first.root.rotation.y).toBeCloseTo(Math.PI / 2);
        expect(first.duration).toBe(.28);
        expect(first.root.children.some(part => /WoundSeal|WitnessHalo/.test(part.name))).toBe(false);
        expect(first.root.children).toHaveLength(6);
        const dispose = jest.spyOn(first.root.children[0].material, 'dispose');
        first.update(.12);
        for (let i = 0; i < 6; i++) second.update(.02);
        first.root.children.forEach((part, i) => {
            expect(part.position.distanceTo(second.root.children[i].position)).toBeLessThan(1e-6);
            expect(part.scale.distanceTo(second.root.children[i].scale)).toBeLessThan(1e-6);
        });
        first.update(.2); second.dispose();
        expect(first.isActive).toBe(false);
        expect(scene.children).toHaveLength(0);
        expect(dispose).not.toHaveBeenCalled();
    });

    test('reduced motion retains the contact flash without travelling sparks', () => {
        const old = globalThis.matchMedia;
        globalThis.matchMedia = () => ({ matches: true });
        try {
            const effect = createProceduralCombatFeedbackEffect(new THREE.Group(), new THREE.Vector3(0, 2, 0), {
                feedbackKind: 'wizard_strike', quality: 'low', impactDirection: { x: NaN, z: 1 }
            });
            expect(effect.root.rotation.y).toBe(0);
            expect(effect.root.children).toHaveLength(4);
            effect.update(.1);
            for (const part of effect.root.children.filter(part => part.userData.motion === 'contact-spark')) {
                expect(part.position.length()).toBe(0);
                expect(part.scale.x).toBeGreaterThan(0);
            }
            effect.dispose();
        } finally {
            if (old) globalThis.matchMedia = old; else delete globalThis.matchMedia;
        }
    });

    test('compact party feedback uses fewer meshes and smaller intensity without changing its identity', () => {
        const scene = new THREE.Group(), position = new THREE.Vector3();
        const options = { feedbackKind: 'wizard_strike', amount: 100, quality: 'high' };
        const full = createProceduralCombatFeedbackEffect(scene, position, options);
        const compact = createProceduralCombatFeedbackEffect(scene, position, { ...options, feedbackDensity: 'compact' });
        expect(meshes(compact.root).filter(mesh => mesh.visible).length).toBeLessThan(meshes(full.root).filter(mesh => mesh.visible).length);
        expect(compact.root.userData.intensity).toBeCloseTo(full.root.userData.intensity * .7);
        expect(compact.root.userData.feedbackKind).toBe(full.root.userData.feedbackKind);
    });
    test('the manifest gives every damage, affliction, hazard, and restoration family a unique identity', () => {
        expect(Object.keys(PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS).sort()).toEqual([...KINDS].sort());
        const motifs = new Set();
        const styles = new Set();
        Object.values(PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS).forEach((definition) => {
            expect(definition.family.length).toBeGreaterThan(3);
            expect(definition.motif.length).toBeGreaterThan(8);
            expect(definition.artStyle.length).toBeGreaterThan(16);
            motifs.add(definition.motif);
            styles.add(definition.artStyle);
        });
        expect(motifs.size).toBe(KINDS.length);
        expect(styles.size).toBe(KINDS.length);
    });

    test.each(KINDS)('%s builds a visible, finite High/Low reaction with independent cleanup', (feedbackKind) => {
        for (const quality of ['high', 'low']) {
            const scene = new THREE.Group();
            const effect = createProceduralCombatFeedbackEffect(scene, new THREE.Vector3(2, 0, -3), {
                feedbackKind,
                quality,
                amount: 275,
                sourceId: 'source',
                targetId: 'target',
                instanceId: 'instance-feedback'
            });
            const root = effect.root;
            const definition = PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS[feedbackKind];
            expect(root.name).toBe(`ProceduralCombatFeedback:${feedbackKind}`);
            expect(root.userData).toEqual(expect.objectContaining({
                proceduralCombatFeedback: true,
                feedbackKind,
                feedbackFamily: definition.family,
                motif: definition.motif,
                artStyle: definition.artStyle,
                restorative: definition.restorative,
                quality,
                amount: 275,
                sourceId: 'source',
                targetId: 'target',
                instanceId: 'instance-feedback',
                sharedGeometry: true,
                sharedMaterials: true
            }));
            expect(meshes(root).filter((part) => part.visible)).toHaveLength(
                feedbackKind.endsWith('_strike') ? (quality === 'low' ? 4 : 6) : (quality === 'low' ? 2 : 4));
            effect.update(0.22);
            root.traverse((part) => {
                expect(part.position.toArray().every(Number.isFinite)).toBe(true);
                expect(part.scale.toArray().every(Number.isFinite)).toBe(true);
            });
            effect.dispose();
            expect(root.parent).toBeNull();
            expect(effect.disposed).toBe(true);
        }
    });

    test('the transient dispatcher selects named feedback and fails closed for an unknown identity', () => {
        const scene = new THREE.Group();
        const effect = createTransientEffect(scene, 'combat_feedback', new THREE.Vector3(), 0xffffff, {
            feedbackKind: 'bleed_tick'
        });
        expect(effect.root.userData.feedbackKind).toBe('bleed_tick');
        expect(() => createTransientEffect(scene, 'combat_feedback', new THREE.Vector3(), 0xffffff, {
            feedbackKind: 'generic_flash'
        })).toThrow('Unknown procedural combat feedback: generic_flash');
    });

    test('amount scaling stays readable and bounded', () => {
        const tiny = createProceduralCombatFeedbackEffect(new THREE.Group(), new THREE.Vector3(), {
            feedbackKind: 'fighter_strike', amount: 1
        });
        const huge = createProceduralCombatFeedbackEffect(new THREE.Group(), new THREE.Vector3(), {
            feedbackKind: 'fighter_strike', amount: 100000000
        });
        expect(tiny.root.userData.intensity).toBeGreaterThanOrEqual(0.72);
        expect(huge.root.userData.intensity).toBeLessThanOrEqual(1.4);
    });

    test('cached resources survive disposal of a sibling instance', () => {
        const scene = new THREE.Group();
        const first = createProceduralCombatFeedbackEffect(scene, new THREE.Vector3(), {
            feedbackKind: 'cleric_heal'
        });
        const second = createProceduralCombatFeedbackEffect(scene, new THREE.Vector3(1, 0, 0), {
            feedbackKind: 'cleric_heal'
        });
        const sharedGeometry = meshes(first.root)[0].geometry;
        expect(meshes(second.root).some((part) => part.geometry === sharedGeometry)).toBe(true);
        first.dispose();
        expect(second.root.parent).toBe(scene);
        expect(sharedGeometry.attributes.position).toBeDefined();
        const before = getProceduralCombatFeedbackCacheMetrics();
        createProceduralCombatFeedbackEffect(scene, new THREE.Vector3(), { feedbackKind: 'cleric_heal' });
        expect(getProceduralCombatFeedbackCacheMetrics()).toEqual(before);
        expect(before.geometries).toBeGreaterThan(5);
        expect(before.materials).toBeGreaterThan(0);
    });
});
