import * as THREE from 'three';
import {
    PROCEDURAL_OVERWORLD_ENEMY_DEFINITIONS,
    PROCEDURAL_OVERWORLD_ENEMY_STATES,
    createProceduralCloudElemental,
    createProceduralCycloneAvatar,
    createProceduralInfernalBehemoth,
    createProceduralMagmaGolem,
    createProceduralOverworldEnemy,
    createProceduralPhoenixSentinel,
    createProceduralSandstormDjinn,
    createProceduralScorchedWraith,
    createProceduralStormHarpy,
    createProceduralTempestGiant,
    createProceduralThunderRoc,
    getProceduralOverworldEnemyCacheMetrics
} from '../src/art/ProceduralOverworldEnemies.js';
import { SandstormDjinn } from '../src/entities/SandstormDjinn.js';
import { MagmaGolem } from '../src/entities/MagmaGolem.js';
import { ScorchedWraith } from '../src/entities/ScorchedWraith.js';
import { InfernalBehemoth } from '../src/entities/InfernalBehemoth.js';
import { PhoenixSentinel } from '../src/entities/PhoenixSentinel.js';
import { StormHarpy } from '../src/entities/StormHarpy.js';
import { CloudElemental } from '../src/entities/CloudElemental.js';
import { ThunderRoc } from '../src/entities/ThunderRoc.js';
import { TempestGiant } from '../src/entities/TempestGiant.js';
import { CycloneAvatar } from '../src/entities/CycloneAvatar.js';

const CASES = Object.freeze([
    ['SandstormDjinn', createProceduralSandstormDjinn, SandstormDjinn, 60, 'cinder-wastes'],
    ['MagmaGolem', createProceduralMagmaGolem, MagmaGolem, 75, 'cinder-wastes'],
    ['ScorchedWraith', createProceduralScorchedWraith, ScorchedWraith, 58, 'cinder-wastes'],
    ['InfernalBehemoth', createProceduralInfernalBehemoth, InfernalBehemoth, 48, 'cinder-wastes'],
    ['PhoenixSentinel', createProceduralPhoenixSentinel, PhoenixSentinel, 75, 'cinder-wastes'],
    ['StormHarpy', createProceduralStormHarpy, StormHarpy, 58, 'stormcrown-reach'],
    ['CloudElemental', createProceduralCloudElemental, CloudElemental, 65, 'stormcrown-reach'],
    ['ThunderRoc', createProceduralThunderRoc, ThunderRoc, 80, 'stormcrown-reach'],
    ['TempestGiant', createProceduralTempestGiant, TempestGiant, 80, 'stormcrown-reach'],
    ['CycloneAvatar', createProceduralCycloneAvatar, CycloneAvatar, 80, 'stormcrown-reach']
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

describe('procedural Cinder Wastes and Stormcrown enemy families', () => {
    test.each(CASES)('%s is grounded, bounded, detailed, and region-specific', (type, create, _EntityClass, minimumMeshes, family) => {
        const enemy = create();
        const definition = PROCEDURAL_OVERWORLD_ENEMY_DEFINITIONS[type];
        const bounds = new THREE.Box3().setFromObject(enemy);
        const metrics = sceneMetrics(enemy);

        expect(enemy.userData).toEqual(expect.objectContaining({
            proceduralEnemyFamily: true,
            proceduralOverworldFamily: family,
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

    test.each(CASES)('%s owns five finite and articulated animation states', (type, create) => {
        const enemy = create();
        const clips = Object.fromEntries(enemy.userData.animations.map((clip) => [clip.name, clip]));
        expect(Object.keys(clips)).toEqual(PROCEDURAL_OVERWORLD_ENEMY_STATES);
        PROCEDURAL_OVERWORLD_ENEMY_STATES.forEach((state) => expect(clips[state].tracks.length).toBeGreaterThanOrEqual(9));
        expect(clips.Attack.tracks.some((animationTrack) => animationTrack.name.includes('Weapon.rotation'))).toBe(true);
        expect(clips.Death.tracks.some((animationTrack) => animationTrack.name.endsWith('Body.position[y]'))).toBe(true);

        for (const state of PROCEDURAL_OVERWORLD_ENEMY_STATES) {
            enemy.userData.resetPose();
            const mixer = new THREE.AnimationMixer(enemy);
            mixer.clipAction(clips[state]).reset().play();
            mixer.update(clips[state].duration * 0.5);
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

    test.each(CASES)('%s preserves its combat radius and owns one exact interaction hitbox', (type, create, EntityClass) => {
        const actorMesh = create();
        const first = new EntityClass(`${type}-first`);
        const second = new EntityClass(`${type}-second`);
        const definition = PROCEDURAL_OVERWORLD_ENEMY_DEFINITIONS[type];
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

    test('factory routing is exhaustive and all overworld resources stay cached', () => {
        for (const [type] of CASES) expect(createProceduralOverworldEnemy(type).userData.proceduralActorType).toBe(type);
        expect(() => createProceduralOverworldEnemy('UnknownEnemy')).toThrow('Unknown procedural overworld enemy');
        const metrics = getProceduralOverworldEnemyCacheMetrics();
        for (const [type] of CASES) createProceduralOverworldEnemy(type);
        expect(getProceduralOverworldEnemyCacheMetrics()).toEqual(metrics);
        expect(metrics.geometries).toBeGreaterThanOrEqual(170);
        expect(metrics.materials).toBe(60);
    });
});
