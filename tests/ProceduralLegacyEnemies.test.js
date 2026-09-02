import * as THREE from 'three';
import {
    PROCEDURAL_LEGACY_ENEMY_DEFINITIONS,
    PROCEDURAL_LEGACY_ENEMY_STATES,
    createProceduralConstruct,
    createProceduralDemonOrc,
    createProceduralImp,
    createProceduralInfernoTitan,
    createProceduralLegacyEnemy,
    createProceduralSkeleton,
    getProceduralLegacyEnemyCacheMetrics
} from '../src/art/ProceduralLegacyEnemies.js';
import { Skeleton } from '../src/entities/Skeleton.js';
import { DemonOrc } from '../src/entities/DemonOrc.js';
import { Imp } from '../src/entities/Imp.js';
import { Construct } from '../src/entities/Construct.js';
import { InfernoTitan } from '../src/entities/InfernoTitan.js';

const CASES = Object.freeze([
    ['Skeleton', createProceduralSkeleton, Skeleton, 45],
    ['DemonOrc', createProceduralDemonOrc, DemonOrc, 50],
    ['Imp', createProceduralImp, Imp, 45],
    ['Construct', createProceduralConstruct, Construct, 50],
    ['InfernoTitan', createProceduralInfernoTitan, InfernoTitan, 55]
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

describe('procedural regional legacy enemies', () => {
    test.each(CASES)('%s is grounded, bounded, detailed, and region-specific', (type, create, _EntityClass, minimumMeshes) => {
        const enemy = create();
        const definition = PROCEDURAL_LEGACY_ENEMY_DEFINITIONS[type];
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

    test.each(CASES)('%s has five finite, semantically articulated authoritative states', (type, create) => {
        const enemy = create();
        const clips = Object.fromEntries(enemy.userData.animations.map((clip) => [clip.name, clip]));

        expect(Object.keys(clips)).toEqual(PROCEDURAL_LEGACY_ENEMY_STATES);
        PROCEDURAL_LEGACY_ENEMY_STATES.forEach((state) => expect(clips[state].tracks.length).toBeGreaterThanOrEqual(8));
        expect(clips.Attack.tracks.some((track) => track.name.includes('Weapon.rotation[z]'))).toBe(true);
        expect(clips.Death.tracks.some((track) => track.name.endsWith('Body.position[y]'))).toBe(true);

        for (const state of PROCEDURAL_LEGACY_ENEMY_STATES) {
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

    test.each(CASES)('%s instances share rendering resources but never rig pose', (type, create) => {
        const first = create();
        const second = create();
        const firstVisible = [];
        const secondVisible = [];
        first.traverse((child) => { if (child.isMesh && child.visible) firstVisible.push(child); });
        second.traverse((child) => { if (child.isMesh && child.visible) secondVisible.push(child); });

        expect(first).not.toBe(second);
        expect(firstVisible[0].geometry).toBe(secondVisible[0].geometry);
        expect(firstVisible[0].material).toBe(secondVisible[0].material);
        const firstBody = first.getObjectByName(`Rig_${type}Body`);
        const secondBody = second.getObjectByName(`Rig_${type}Body`);
        expect(firstBody).not.toBe(secondBody);
        const restY = firstBody.position.y;
        firstBody.position.y += 4;
        first.userData.resetPose();
        expect(firstBody.position.y).toBeCloseTo(restY);
        expect(secondBody.position.y).toBeCloseTo(restY);
    });

    test.each(CASES)('%s preserves combat radius and installs one latency-tolerant interaction hitbox', (type, create, EntityClass) => {
        const mesh = create();
        const first = new EntityClass(`${type}-first`);
        const second = new EntityClass(`${type}-second`);
        const definition = PROCEDURAL_LEGACY_ENEMY_DEFINITIONS[type];
        expect(first.radius).toBe(definition.combatRadius);
        first.name = '';
        second.name = '';

        first.setMesh(mesh);
        second.setMesh(mesh);
        const hitboxes = [];
        mesh.traverse((child) => {
            if (child.name === 'ActorInteractionHitbox') hitboxes.push(child);
        });
        expect(hitboxes).toHaveLength(1);
        expect(hitboxes[0].userData.entityId).toBe(`${type}-second`);
        expect(mesh.userData.interactionPadding).toBe(0.75);
        expect(hitboxes[0].geometry.parameters).toEqual(expect.objectContaining({
            width: (definition.bounds.radius + mesh.userData.interactionPadding) * 2,
            height: definition.bounds.height,
            depth: (definition.bounds.radius + mesh.userData.interactionPadding) * 2
        }));
        expect(hitboxes[0].position.y).toBe(definition.bounds.height / 2);
    });

    test('Skeleton remains raycastable across one live movement sample outside its visual bounds', () => {
        const mesh = createProceduralSkeleton();
        const skeleton = new Skeleton('moving-skeleton');
        skeleton.name = '';
        skeleton.setMesh(mesh);
        mesh.updateMatrixWorld(true);

        const definition = PROCEDURAL_LEGACY_ENEMY_DEFINITIONS.Skeleton;
        const sampleDrift = 0.6;
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(definition.bounds.radius + sampleDrift, definition.bounds.height / 2, 5),
            new THREE.Vector3(0, 0, -1)
        );
        const hits = raycaster.intersectObject(mesh.getObjectByName('ActorInteractionHitbox'));

        expect(sampleDrift).toBeLessThan(mesh.userData.interactionPadding);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].object.userData.entityId).toBe('moving-skeleton');
    });

    test('factory routing is explicit and caches all regional resources once', () => {
        for (const [type] of CASES) expect(createProceduralLegacyEnemy(type).userData.proceduralActorType).toBe(type);
        expect(() => createProceduralLegacyEnemy('UnknownEnemy')).toThrow('Unknown procedural legacy enemy');
        expect(getProceduralLegacyEnemyCacheMetrics()).toEqual({ geometries: 152, materials: 37 });
    });
});
