import * as THREE from 'three';
import { jest } from '@jest/globals';
import {
    PROCEDURAL_ABILITY_CAST_ALIAS_DEFINITIONS,
    PROCEDURAL_ABILITY_CAST_DEFINITIONS,
    createProceduralAbilityCastEffect,
    getProceduralAbilityCastCacheMetrics
} from '../src/art/ProceduralAbilityCasts.js';
import { createTransientEffect } from '../src/core/TransientEffects.js';
import {
    getAbilityPresentation,
    listPlayerAbilityPresentations
} from '../src/skills/abilityVisualManifest.js';
import {
    PLAYER_ABILITY_AOE_RADII,
    getAbilityAoeArc,
    getAbilityAoeRadius,
    isAoeBoundaryVisualType
} from '../src/skills/abilityRadii.js';

function sourceFor(className, runes = {}) {
    return {
        meshType: className,
        position: new THREE.Vector3(0, 0, 0),
        mesh: { quaternion: new THREE.Quaternion() },
        skillRunes: runes
    };
}

function visibleMeshes(root) {
    const meshes = [];
    root.traverse((part) => {
        if (part.isMesh && part.visible) meshes.push(part);
    });
    return meshes;
}

describe('procedural ability cast effects', () => {
    test('all 52 canonical abilities have unique intentional cast identities', () => {
        const manifest = listPlayerAbilityPresentations();
        const definitions = Object.entries(PROCEDURAL_ABILITY_CAST_DEFINITIONS)
            .flatMap(([className, abilities]) => Object.entries(abilities)
                .map(([abilityName, entry]) => ({ className, abilityName, ...entry })));

        expect(definitions).toHaveLength(52);
        expect(definitions.map(({ className, abilityName }) => `${className}:${abilityName}`).sort())
            .toEqual(manifest.map(({ className, skillName }) => `${className}:${skillName}`).sort());
        expect(new Set(definitions.map((entry) => entry.motif)).size).toBe(52);
        expect(new Set(definitions.map((entry) => entry.artStyle)).size).toBe(52);
        definitions.forEach((entry) => {
            expect(entry.artStyle.length).toBeGreaterThan(12);
            expect(['shield', 'blade', 'fang', 'crystal', 'feather', 'bar', 'relic']).toContain(entry.relic);
        });
    });

    test('every canonical layer renders as a multi-part tagged construction at High and Low quality', () => {
        for (const ability of listPlayerAbilityPresentations()) {
            const source = sourceFor(ability.className);
            const registry = PLAYER_ABILITY_AOE_RADII[ability.className]?.[ability.skillName];
            const radius = getAbilityAoeRadius(ability.className, ability.skillName, source)
                || Object.values(registry?.runes || {})[0]
                || null;
            const arc = getAbilityAoeArc(ability.className, ability.skillName);
            for (const quality of ['high', 'low']) {
                ability.layers.forEach((layer, abilityLayer) => {
                    const boundaryLayer = isAoeBoundaryVisualType(layer.type) && radius;
                    const scene = new THREE.Group();
                    const effect = createProceduralAbilityCastEffect(
                        scene,
                        layer.type,
                        new THREE.Vector3(2, 0, 3),
                        layer.color,
                        {
                            source,
                            abilityName: ability.skillName,
                            requestedAbilityName: ability.skillName,
                            abilityLayer,
                            quality,
                            direction: new THREE.Vector3(0.4, 0, 1).normalize(),
                            ...(boundaryLayer ? { radius, ...(arc ? { arc } : {}) } : {})
                        }
                    );
                    const root = effect.meshes[0];
                    expect(root.parent).toBe(scene);
                    expect(root.userData).toEqual(expect.objectContaining({
                        proceduralAbilityCast: true,
                        abilityClass: ability.className,
                        abilityName: ability.skillName,
                        requestedAbilityName: ability.skillName,
                        abilityLayer,
                        layerType: layer.type,
                        motif: PROCEDURAL_ABILITY_CAST_DEFINITIONS[ability.className][ability.skillName].motif,
                        quality,
                        sharedGeometry: true,
                        sharedMaterials: true
                    }));
                    expect(visibleMeshes(root).length).toBeGreaterThanOrEqual(quality === 'high' ? 5 : 3);

                    const exactBoundary = root.children.find((part) =>
                        part.userData.gameplayBoundary && part.userData.normalizedGameplayRadius === 1
                    );
                    if (boundaryLayer) {
                        expect(exactBoundary).toBeDefined();
                        expect(exactBoundary.userData.gameplayRadius).toBe(radius);
                        expect(exactBoundary.scale.x).toBeCloseTo(radius, 8);
                        if (arc) expect(exactBoundary.userData.gameplayArc).toBeCloseTo(arc, 8);
                    } else {
                        expect(exactBoundary).toBeUndefined();
                    }

                    const boundaryScale = exactBoundary?.scale.clone();
                    effect.update(effect.duration * 0.45);
                    if (exactBoundary) expect(exactBoundary.scale.toArray()).toEqual(boundaryScale.toArray());
                    root.traverse((part) => {
                        expect([
                            part.position.x, part.position.y, part.position.z,
                            part.scale.x, part.scale.y, part.scale.z,
                            part.quaternion.x, part.quaternion.y, part.quaternion.z, part.quaternion.w
                        ].every(Number.isFinite)).toBe(true);
                    });
                    effect.dispose();
                    expect(scene.children).toHaveLength(0);
                });
            }
        }
    });

    test('every authoritative radius has a manifest layer that can draw its exact boundary', () => {
        for (const [className, abilities] of Object.entries(PLAYER_ABILITY_AOE_RADII)) {
            for (const abilityName of Object.keys(abilities)) {
                const presentation = getAbilityPresentation(className, abilityName);
                if (!presentation) throw new Error(`${className}/${abilityName} has no presentation`);
                if (!presentation.layers.some((layer) => isAoeBoundaryVisualType(layer.type))) {
                    throw new Error(`${className}/${abilityName} has no boundary-aware layer`);
                }
            }
        }
    });

    test('Frost Nova keeps a dedicated rimeglass alias instead of inheriting Flame Whip fire', () => {
        const scene = new THREE.Group();
        const effect = createProceduralAbilityCastEffect(
            scene,
            'ring',
            new THREE.Vector3(),
            0x72cfff,
            {
                source: sourceFor('Wizard'),
                abilityName: 'Flame Whip',
                requestedAbilityName: 'Frost Nova',
                radius: 8
            }
        );
        expect(PROCEDURAL_ABILITY_CAST_ALIAS_DEFINITIONS.Wizard['Frost Nova'].motif).toBe('rimeglass-nova');
        expect(effect.meshes[0].userData).toEqual(expect.objectContaining({
            abilityName: 'Flame Whip',
            requestedAbilityName: 'Frost Nova',
            motif: 'rimeglass-nova',
            gameplayRadius: 8
        }));
        effect.dispose();
    });

    test('the production transient dispatcher fails closed for named casts and preserves generic utility effects', () => {
        const scene = new THREE.Group();
        const castEffect = createTransientEffect(scene, 'burst', new THREE.Vector3(), 0xff6a24, {
            source: sourceFor('Wizard'),
            abilityName: 'Fireball',
            abilityLayer: 0
        });
        expect(castEffect.meshes[0].userData.proceduralAbilityCast).toBe(true);
        castEffect.dispose();

        expect(() => createTransientEffect(scene, 'burst', new THREE.Vector3(), 0xffffff, {
            source: sourceFor('Wizard'),
            abilityName: 'Unnamed Spell'
        })).toThrow(/Unnamed Spell/);
        const utility = createTransientEffect(scene, 'impact', new THREE.Vector3(), 0xffffff);
        expect(utility.meshes[0].userData.proceduralAbilityCast).not.toBe(true);
        utility.dispose();
    });

    test('instances reuse immutable cache resources without sharing transforms or disposing peers', () => {
        const scene = new THREE.Group();
        const options = { source: sourceFor('Cleric'), abilityName: 'Healing Light', abilityLayer: 1 };
        const first = createProceduralAbilityCastEffect(scene, 'burst', new THREE.Vector3(), 0xc8ffe0, options);
        const second = createProceduralAbilityCastEffect(scene, 'burst', new THREE.Vector3(4, 0, 0), 0xc8ffe0, options);
        const firstHeart = first.root.getObjectByName('Cleric:Healing Light:1:burst:ImpactHeart');
        const secondHeart = second.root.getObjectByName('Cleric:Healing Light:1:burst:ImpactHeart');
        expect(firstHeart.geometry).toBe(secondHeart.geometry);
        expect(firstHeart.material).toBe(secondHeart.material);
        expect(first.root.position.toArray()).not.toEqual(second.root.position.toArray());

        const disposeGeometry = jest.spyOn(firstHeart.geometry, 'dispose');
        const disposeMaterial = jest.spyOn(firstHeart.material, 'dispose');
        first.dispose();
        expect(disposeGeometry).not.toHaveBeenCalled();
        expect(disposeMaterial).not.toHaveBeenCalled();
        expect(secondHeart.parent).not.toBeNull();
        disposeGeometry.mockRestore();
        disposeMaterial.mockRestore();
        second.dispose();
        expect(getProceduralAbilityCastCacheMetrics().geometries).toBeGreaterThan(8);
        expect(getProceduralAbilityCastCacheMetrics().materials).toBeGreaterThan(100);
    });
});
