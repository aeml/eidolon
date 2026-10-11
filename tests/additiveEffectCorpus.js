import * as THREE from 'three';
import { listPlayerAbilityPresentations } from '../src/skills/abilityVisualManifest.js';
import { getAbilityAoeRadius, getAbilityAoeArc } from '../src/skills/abilityRadii.js';
import { createProceduralAbilityCastEffect } from '../src/art/ProceduralAbilityCasts.js';
import { PROCEDURAL_STATUS_EFFECT_DEFINITIONS, createProceduralStatusEffect,
    updateProceduralStatusEffect, releaseProceduralStatusEffect } from '../src/art/ProceduralStatusEffects.js';
import { PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS, createProceduralCombatFeedbackEffect } from '../src/art/ProceduralCombatFeedback.js';

export function additiveEffectCorpus(scene, quality) {
    const cases = [];
    for (const ability of listPlayerAbilityPresentations()) {
        const source = { meshType: ability.className, position: new THREE.Vector3(), mesh: { quaternion: new THREE.Quaternion() }, skillRunes: {} };
        ability.layers.forEach((layer, abilityLayer) => {
            const effect = createProceduralAbilityCastEffect(scene, layer.type, new THREE.Vector3(), layer.color,
                { source, abilityName: ability.skillName, abilityLayer, quality,
                    radius: getAbilityAoeRadius(ability.className, ability.skillName, source) || 6,
                    arc: getAbilityAoeArc(ability.className, ability.skillName), direction: new THREE.Vector3(0, 0, -1) });
            cases.push({ kind: 'cast', label: `${ability.className}:${ability.skillName}:${abilityLayer}:${layer.type}`,
                root: effect.root, advance: dt => effect.update(dt), dispose: () => effect.dispose() });
        });
    }
    for (const status of Object.keys(PROCEDURAL_STATUS_EFFECT_DEFINITIONS)) {
        const root = createProceduralStatusEffect(status, { quality }); scene.add(root);
        let time = 0;
        cases.push({ kind: 'status', label: status, root,
            advance: dt => updateProceduralStatusEffect(root, time += dt, dt),
            dispose: () => { root.removeFromParent(); releaseProceduralStatusEffect(root); } });
    }
    for (const feedbackKind of Object.keys(PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS)) {
        const effect = createProceduralCombatFeedbackEffect(scene, new THREE.Vector3(0, 1, 0), { feedbackKind, quality, amount: 100 });
        cases.push({ kind: 'feedback', label: feedbackKind, root: effect.root,
            advance: dt => effect.update(dt), dispose: () => effect.dispose() });
    }
    return cases;
}
