import * as THREE from 'three';
import { createVisualMotionClock } from '../src/core/MotionPreference.js';
import { createProceduralAbilityCastEffect } from '../src/art/ProceduralAbilityCasts.js';
import { listPlayerAbilityPresentations } from '../src/skills/abilityVisualManifest.js';
import { createProceduralAreaField, updateProceduralAreaField, releaseProceduralAreaField, PROCEDURAL_AREA_FIELD_DEFINITIONS } from '../src/art/ProceduralAreaFields.js';
import { createProceduralStatusEffect, updateProceduralStatusEffect, releaseProceduralStatusEffect, PROCEDURAL_STATUS_EFFECT_DEFINITIONS } from '../src/art/ProceduralStatusEffects.js';
import { SpiritGuardiansEffect } from '../src/entities/SpiritGuardiansEffect.js';

const reduced = enabled => { document.documentElement.dataset.reducedMotion = String(enabled); };
afterEach(() => { delete document.documentElement.dataset.reducedMotion; });
function pose(root) {
    const result = [];
    root.traverse(part => result.push({ name: part.name, position: part.position.toArray(),
        rotation: part.quaternion.toArray(), scale: part.scale.toArray(), visible: part.visible,
        instances: part.instanceMatrix ? Array.from(part.instanceMatrix.array) : null }));
    return result;
}

test('presentation clocks pause live, resume without catch-up and keep the actual elapsed time separate', () => {
    const clock = createVisualMotionClock();
    expect(clock.update(1, 1).time).toBe(1);
    reduced(true); expect(clock.update(4, 3).time).toBe(1); expect(clock.delta).toBe(0);
    reduced(false); expect(clock.update(5, 1).time).toBe(2); expect(clock.delta).toBe(1);
    expect(clock.previous).toBe(5);
});

for (const quality of ['high', 'low']) {
    test(`${quality}: all 52 class casts retain their visible shapes and retire while ornament motion is reduced`, () => {
        for (const ability of listPlayerAbilityPresentations()) for (const [abilityLayer, layer] of ability.layers.entries()) {
            reduced(false);
            const scene = new THREE.Group(), source = { meshType: ability.className, position: new THREE.Vector3(), mesh: new THREE.Group() };
            const effect = createProceduralAbilityCastEffect(scene, layer.type, new THREE.Vector3(), layer.color,
                { source, abilityName: ability.skillName, abilityLayer, quality, direction: new THREE.Vector3(1, 0, 0) });
            effect.update(.01);
            const before = pose(effect.root);
            reduced(true); effect.update(.02); effect.update(.02);
            expect(pose(effect.root)).toEqual(before);
            expect(effect.root.parent).toBe(scene);
            expect(effect.elapsed).toBeCloseTo(.05);
            effect.update(effect.duration + 1);
            expect(effect.isActive).toBe(false); expect(effect.root.parent).toBeNull();
        }
    });

    test(`${quality}: every persistent field freezes decoration without changing radius or ownership`, () => {
        for (const type of Object.keys(PROCEDURAL_AREA_FIELD_DEFINITIONS)) {
            reduced(false);
            const field = createProceduralAreaField(type, 12, { quality });
            const scene = new THREE.Group(); scene.add(field);
            updateProceduralAreaField(field, .2, .2);
            const before = pose(field);
            reduced(true);
            updateProceduralAreaField(field, .4, .2); updateProceduralAreaField(field, 1, .6);
            expect(pose(field)).toEqual(before);
            expect(field.userData.gameplayRadius).toBe(12);
            expect(field.parent).toBe(scene);
            reduced(false); updateProceduralAreaField(field, 1.2, .2);
            expect(pose(field)).not.toEqual(before);
            releaseProceduralAreaField(field); expect(field.parent).toBeNull();
        }
    });

    test(`${quality}: every status retains static symbols, including rested instance motes and healing range`, () => {
        for (const key of Object.keys(PROCEDURAL_STATUS_EFFECT_DEFINITIONS)) {
            reduced(false);
            const root = createProceduralStatusEffect(key, { quality, gameplayRadius: 16 });
            updateProceduralStatusEffect(root, .2, .2);
            const before = pose(root);
            reduced(true); updateProceduralStatusEffect(root, .4, .2); updateProceduralStatusEffect(root, .8, .4);
            expect(pose(root)).toEqual(before);
            if (key === 'guardian_embrace') expect(root.userData.gameplayRadius).toBe(16);
            releaseProceduralStatusEffect(root);
            expect(root.children).toHaveLength(0);
        }
    });
}

test('reduced guardians keep five figures, follow the caster and update boosted rune radius without orbit or flashing', () => {
    reduced(true);
    const source = { id: 'cleric', state: 'IDLE', position: new THREE.Vector3(), mesh: new THREE.Group(), spiritRadius: 20 };
    const scene = new THREE.Group(), effect = new SpiritGuardiansEffect(scene, source, { boosted: true });
    const before = effect.guardians.map(pose), opacity = effect.pulseRing.material.opacity;
    source.position.set(5, 3, 7); effect.update(.5);
    expect(effect.guardians.map(pose)).toEqual(before);
    expect(effect.group.position.toArray()).toEqual([5, 3.12, 7]);
    expect(effect.pulseRing.material.opacity).toBe(opacity);
    expect(effect.guardians).toHaveLength(5); expect(effect.elapsed).toBe(.5);
    source.spiritRadius = 30; effect.setVariant(); effect.update(.1);
    expect(effect.pulseRing.geometry.parameters.outerRadius).toBe(30);
    expect(effect.pulseRing.scale.toArray()).toEqual([1, 1, 1]);
    effect.dispose(); expect(effect.group.parent).toBeNull(); expect(effect.resources.size).toBe(0);
});
