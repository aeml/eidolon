import * as THREE from 'three';
import { jest } from '@jest/globals';
import {
    PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS,
    PROCEDURAL_ABYSSAL_BOSS_STATES,
    createProceduralAbyssalGoliath,
    createProceduralAbyssalBoss,
    createProceduralDrownedChoir,
    createProceduralMaelstromWarden,
    createProceduralThalorath,
    createProceduralTiderendLeviathan,
    getProceduralAbyssalBossCacheMetrics
} from '../src/art/ProceduralAbyssalBosses.js';
import { TiderendLeviathan } from '../src/entities/TiderendLeviathan.js';
import { DrownedChoir } from '../src/entities/DrownedChoir.js';
import { AbyssalGoliath } from '../src/entities/AbyssalGoliath.js';
import { MaelstromWarden } from '../src/entities/MaelstromWarden.js';
import { Thalorath } from '../src/entities/Thalorath.js';

const CASES = Object.freeze([
    ['TiderendLeviathan', createProceduralTiderendLeviathan, TiderendLeviathan, 75],
    ['DrownedChoir', createProceduralDrownedChoir, DrownedChoir, 75],
    ['AbyssalGoliath', createProceduralAbyssalGoliath, AbyssalGoliath, 65],
    ['MaelstromWarden', createProceduralMaelstromWarden, MaelstromWarden, 75],
    ['Thalorath', createProceduralThalorath, Thalorath, 90]
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

describe('procedural Abyssal Well boss family', () => {
    test.each(CASES)('%s is grounded, bounded, detailed, and intentionally themed', (type, create, _EntityClass, minimumMeshes) => {
        const boss = create();
        const definition = PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS[type];
        const bounds = new THREE.Box3().setFromObject(boss);
        const metrics = sceneMetrics(boss);

        expect(boss.userData).toEqual(expect.objectContaining({
            proceduralEnemyFamily: true,
            proceduralBossFamily: 'abyssal-well',
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
        expect(Object.keys(clips)).toEqual(PROCEDURAL_ABYSSAL_BOSS_STATES);
        PROCEDURAL_ABYSSAL_BOSS_STATES.forEach((state) => expect(clips[state].tracks.length).toBeGreaterThanOrEqual(9));
        expect(clips.Attack.tracks.some((animationTrack) => animationTrack.name.includes('Weapon.rotation'))).toBe(true);
        expect(clips.Death.tracks.some((animationTrack) => animationTrack.name.endsWith('Body.position[y]'))).toBe(true);

        for (const state of PROCEDURAL_ABYSSAL_BOSS_STATES) {
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
        const definition = PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS[type];
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

    test.each(CASES)('%s can enter its idle roaming path without a runtime reference failure', (type, _create, EntityClass) => {
        const boss = new EntityClass(`${type}-roam`);
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
        try {
            expect(() => boss.roam()).not.toThrow();
            expect(boss.targetPosition).toBeInstanceOf(THREE.Vector3);
        } finally {
            randomSpy.mockRestore();
        }
    });

    test('routing is explicit and all regional resources remain cached', () => {
        for (const [type] of CASES) expect(createProceduralAbyssalBoss(type).userData.proceduralActorType).toBe(type);
        expect(() => createProceduralAbyssalBoss('UnknownBoss')).toThrow('Unknown procedural Abyssal Well boss');
        const metrics = getProceduralAbyssalBossCacheMetrics();
        for (const [type] of CASES) createProceduralAbyssalBoss(type);
        expect(getProceduralAbyssalBossCacheMetrics()).toEqual(metrics);
        expect(metrics.geometries).toBeGreaterThanOrEqual(100);
        expect(metrics.materials).toBe(30);
    });
});
