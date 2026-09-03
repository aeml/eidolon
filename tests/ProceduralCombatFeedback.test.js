import * as THREE from 'three';
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
            expect(meshes(root).filter((part) => part.visible).length).toBeGreaterThanOrEqual(6);
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
