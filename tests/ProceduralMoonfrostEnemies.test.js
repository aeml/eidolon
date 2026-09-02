import * as THREE from 'three';
import {
    PROCEDURAL_MOONFROST_ENEMY_DEFINITIONS,
    PROCEDURAL_MOONFROST_ENEMY_STATES,
    createProceduralAquaGolem,
    createProceduralFrostGuardian,
    createProceduralMoonfrostEnemy,
    createProceduralMountainTroll,
    createProceduralSiren,
    getProceduralMoonfrostEnemyCacheMetrics
} from '../src/art/ProceduralMoonfrostEnemies.js';
import { AquaGolem } from '../src/entities/AquaGolem.js';
import { FrostGuardian } from '../src/entities/FrostGuardian.js';
import { MountainTroll } from '../src/entities/MountainTroll.js';
import { Siren } from '../src/entities/Siren.js';

const CASES = Object.freeze([
    ['MountainTroll', createProceduralMountainTroll, MountainTroll, 42],
    ['AquaGolem', createProceduralAquaGolem, AquaGolem, 42],
    ['Siren', createProceduralSiren, Siren, 45],
    ['FrostGuardian', createProceduralFrostGuardian, FrostGuardian, 42]
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

describe('procedural Moonfrost enemy family', () => {
    test.each(CASES)('%s is grounded, bounded, detailed, and intentionally themed', (type, create, _EntityClass, minimumMeshes) => {
        const enemy = create();
        const definition = PROCEDURAL_MOONFROST_ENEMY_DEFINITIONS[type];
        const bounds = new THREE.Box3().setFromObject(enemy);
        const metrics = sceneMetrics(enemy);

        expect(enemy.userData).toEqual(expect.objectContaining({
            proceduralEnemyFamily: true,
            proceduralActorType: type,
            artStyle: definition.artStyle,
            region: definition.region,
            faction: definition.faction,
            combatRadius: definition.combatRadius,
            sharedGeometry: true,
            bounds: definition.bounds
        }));
        expect(enemy.userData.assetFallback).toBeUndefined();
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

    test.each(CASES)('%s has five finite and articulated animation states', (type, create) => {
        const enemy = create();
        const clips = Object.fromEntries(enemy.userData.animations.map((clip) => [clip.name, clip]));

        expect(Object.keys(clips)).toEqual(PROCEDURAL_MOONFROST_ENEMY_STATES);
        PROCEDURAL_MOONFROST_ENEMY_STATES.forEach((state) => expect(clips[state].tracks.length).toBeGreaterThanOrEqual(9));
        expect(clips.Attack.tracks.some((animationTrack) => animationTrack.name.includes('Weapon.rotation[z]'))).toBe(true);
        expect(clips.Death.tracks.some((animationTrack) => animationTrack.name.endsWith('Body.position[y]'))).toBe(true);

        for (const state of PROCEDURAL_MOONFROST_ENEMY_STATES) {
            enemy.userData.resetPose();
            const clip = clips[state];
            const mixer = new THREE.AnimationMixer(enemy);
            mixer.clipAction(clip).reset().play();
            mixer.update(clip.duration * 0.5);
            expect(sceneMetrics(enemy).nonFiniteTransforms).toBe(0);
            mixer.stopAllAction();
            mixer.uncacheRoot(enemy);
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

    test.each(CASES)('%s preserves authoritative radius and owns one exact interaction hitbox', (type, create, EntityClass) => {
        const actorMesh = create();
        const first = new EntityClass(`${type}-first`);
        const second = new EntityClass(`${type}-second`);
        const definition = PROCEDURAL_MOONFROST_ENEMY_DEFINITIONS[type];
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
        expect(hitboxes[0].geometry.parameters).toEqual(expect.objectContaining({
            width: definition.bounds.radius * 2,
            height: definition.bounds.height,
            depth: definition.bounds.radius * 2
        }));
        expect(hitboxes[0].position.y).toBe(definition.bounds.height / 2);
    });

    test('factory routing is explicit and regional resources remain cached', () => {
        for (const [type] of CASES) expect(createProceduralMoonfrostEnemy(type).userData.proceduralActorType).toBe(type);
        expect(() => createProceduralMoonfrostEnemy('UnknownEnemy')).toThrow('Unknown procedural Moonfrost enemy');
        const metrics = getProceduralMoonfrostEnemyCacheMetrics();
        for (const [type] of CASES) createProceduralMoonfrostEnemy(type);
        expect(getProceduralMoonfrostEnemyCacheMetrics()).toEqual(metrics);
        expect(metrics.geometries).toBeGreaterThanOrEqual(70);
        expect(metrics.materials).toBe(24);
    });
});
