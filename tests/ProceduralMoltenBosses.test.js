import * as THREE from 'three';
import {
    PROCEDURAL_MOLTEN_BOSS_DEFINITIONS,
    PROCEDURAL_MOLTEN_BOSS_STATES,
    createProceduralCindermaw,
    createProceduralForgemasterPyrax,
    createProceduralLordInfernax,
    createProceduralMoltenBoss,
    createProceduralObsidianGuardian,
    createProceduralScorchedTwins,
    getProceduralMoltenBossCacheMetrics
} from '../src/art/ProceduralMoltenBosses.js';
import { Cindermaw } from '../src/entities/Cindermaw.js';
import { ScorchedTwins } from '../src/entities/ScorchedTwins.js';
import { ForgemasterPyrax } from '../src/entities/ForgemasterPyrax.js';
import { ObsidianGuardian } from '../src/entities/ObsidianGuardian.js';
import { LordInfernax } from '../src/entities/LordInfernax.js';

const CASES = Object.freeze([
    ['Cindermaw', createProceduralCindermaw, Cindermaw, 70],
    ['ScorchedTwins', createProceduralScorchedTwins, ScorchedTwins, 65],
    ['ForgemasterPyrax', createProceduralForgemasterPyrax, ForgemasterPyrax, 65],
    ['ObsidianGuardian', createProceduralObsidianGuardian, ObsidianGuardian, 70],
    ['LordInfernax', createProceduralLordInfernax, LordInfernax, 75]
]);

function sceneMetrics(root) {
    let visibleMeshes = 0;
    let nonFiniteTransforms = 0;
    root.updateMatrixWorld(true);
    root.traverse((child) => {
        if (child.isMesh && child.visible) visibleMeshes += 1;
        if (child.matrixWorld.elements.some((value) => !Number.isFinite(value))) nonFiniteTransforms += 1;
    });
    return { visibleMeshes, nonFiniteTransforms };
}

describe('procedural Molten Core boss family', () => {
    test.each(CASES)('%s is grounded, bounded, detailed, and intentionally themed', (type, create, _EntityClass, minimumMeshes) => {
        const boss = create();
        const definition = PROCEDURAL_MOLTEN_BOSS_DEFINITIONS[type];
        const bounds = new THREE.Box3().setFromObject(boss);
        const metrics = sceneMetrics(boss);

        expect(boss.userData).toEqual(expect.objectContaining({
            proceduralEnemyFamily: true,
            proceduralBossFamily: 'molten-core',
            proceduralActorType: type,
            artStyle: definition.artStyle,
            region: definition.region,
            faction: definition.faction,
            combatRadius: definition.combatRadius,
            sharedGeometry: true,
            bounds: definition.bounds
        }));
        expect(boss.userData.assetFallback).toBeUndefined();
        expect(metrics.visibleMeshes).toBeGreaterThanOrEqual(minimumMeshes);
        expect(metrics.nonFiniteTransforms).toBe(0);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
        expect(bounds.min.y).toBeLessThan(0.02);
        expect(bounds.max.y).toBeLessThanOrEqual(definition.bounds.height);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-definition.bounds.radius);
        expect(bounds.max.x).toBeLessThanOrEqual(definition.bounds.radius);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-definition.bounds.radius);
        expect(bounds.max.z).toBeLessThanOrEqual(definition.bounds.radius);
    });

    test.each(CASES)('%s has five finite and articulated boss states', (type, create) => {
        const boss = create();
        const clips = Object.fromEntries(boss.userData.animations.map((clip) => [clip.name, clip]));
        expect(Object.keys(clips)).toEqual(PROCEDURAL_MOLTEN_BOSS_STATES);
        PROCEDURAL_MOLTEN_BOSS_STATES.forEach((state) => expect(clips[state].tracks.length).toBeGreaterThanOrEqual(9));
        expect(clips.Attack.tracks.some((animationTrack) => animationTrack.name.includes('Weapon.rotation'))).toBe(true);
        expect(clips.Death.tracks.some((animationTrack) => animationTrack.name.endsWith('Body.position[y]'))).toBe(true);

        for (const state of PROCEDURAL_MOLTEN_BOSS_STATES) {
            boss.userData.resetPose();
            const mixer = new THREE.AnimationMixer(boss);
            mixer.clipAction(clips[state]).reset().play();
            mixer.update(clips[state].duration * 0.5);
            expect(sceneMetrics(boss).nonFiniteTransforms).toBe(0);
            mixer.stopAllAction();
            mixer.uncacheRoot(boss);
        }
    });

    test.each(CASES)('%s instances share render resources without sharing pose', (type, create) => {
        const first = create();
        const second = create();
        const firstMeshes = [];
        const secondMeshes = [];
        first.traverse((child) => { if (child.isMesh && child.visible) firstMeshes.push(child); });
        second.traverse((child) => { if (child.isMesh && child.visible) secondMeshes.push(child); });
        expect(first).not.toBe(second);
        expect(firstMeshes[0].geometry).toBe(secondMeshes[0].geometry);
        expect(firstMeshes[0].material).toBe(secondMeshes[0].material);

        const firstBody = first.getObjectByName(`Rig_${type}Body`);
        const secondBody = second.getObjectByName(`Rig_${type}Body`);
        const restY = firstBody.position.y;
        firstBody.position.y += 4;
        first.userData.resetPose();
        expect(firstBody.position.y).toBeCloseTo(restY);
        expect(secondBody.position.y).toBeCloseTo(restY);
    });

    test.each(CASES)('%s preserves its combat radius and owns one exact interaction hitbox', (type, create, EntityClass) => {
        const actorMesh = create();
        const first = new EntityClass(`${type}-first`);
        const second = new EntityClass(`${type}-second`);
        const definition = PROCEDURAL_MOLTEN_BOSS_DEFINITIONS[type];
        expect(first.radius).toBe(definition.combatRadius);
        first.name = '';
        second.name = '';
        first.setMesh(actorMesh);
        second.setMesh(actorMesh);

        const hitboxes = [];
        actorMesh.traverse((child) => {
            if (child.name === 'ActorInteractionHitbox') hitboxes.push(child);
        });
        expect(hitboxes).toHaveLength(1);
        expect(hitboxes[0].userData.entityId).toBe(`${type}-second`);
        expect(actorMesh.userData.interactionPadding).toBe(0.75);
        expect(hitboxes[0].geometry.parameters).toEqual(expect.objectContaining({
            width: (definition.bounds.radius + actorMesh.userData.interactionPadding) * 2,
            height: definition.bounds.height,
            depth: (definition.bounds.radius + actorMesh.userData.interactionPadding) * 2
        }));
        expect(hitboxes[0].position.y).toBe(definition.bounds.height / 2);
    });

    test('routing is explicit and all regional resources remain cached', () => {
        for (const [type] of CASES) expect(createProceduralMoltenBoss(type).userData.proceduralActorType).toBe(type);
        expect(() => createProceduralMoltenBoss('UnknownBoss')).toThrow('Unknown procedural Molten Core boss');
        const metrics = getProceduralMoltenBossCacheMetrics();
        for (const [type] of CASES) createProceduralMoltenBoss(type);
        expect(getProceduralMoltenBossCacheMetrics()).toEqual(metrics);
        expect(metrics.geometries).toBeGreaterThanOrEqual(55);
        expect(metrics.materials).toBe(30);
    });
});
